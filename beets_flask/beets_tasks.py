import datetime
import logging
import requests
import os
from sqlalchemy.orm import sessionmaker

from . import disk
from . import utility as ut
from . import beets_tags
from .beets_sessions import PreviewSession, MatchedImportSession

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)

# ------------------------------------------------------------------------------------ #
#                                      Beets tasks                                     #
# ------------------------------------------------------------------------------------ #


@ut.with_app_context
@ut.rq.job(timeout=600)
def preview_task(
    id: str, callback_url: str | None = None, update_meta: bool = True
) -> str | None:
    """Run a preview on an existing tag.

    Args:
        id (str): tag id, needs to exist in sql db
        callback_url (str, optional): called on success/failure. Defaults to None.
        update_meta (bool, optional): whether to update database metadata. Defaults to True.

    Returns:
        str: the match url, if we found one, else None.
    """
    log.debug(f"Preview task on {id}")

    Session = sessionmaker(bind=ut.db.engine)
    session = Session()

    bt = beets_tags.Tag.query.filter_by(id=id).first()
    bt.task = "preview"
    bt.status = "tagging"
    bt.updated_at = datetime.datetime.now()
    if update_meta:
        bt.commit()
        ut.update_client_view("tags")

    try:
        bs = PreviewSession(path=bt.album_folder)
        bs.run_and_capture_output()

        bt.preview = bs.preview
        bt.distance = bs.match_dist
        bt.match_url = bs.match_url
        bt.num_tracks = bs.match_num_tracks
        bt.status = (
            "tagged"
            if (bt.match_url is not None and bs.status == "ok")
            else "unmatched"
        )
    except Exception as e:
        log.debug(e)
        bt.status = "failed"
        if callback_url:
            requests.post(
                callback_url,
                json={"status": "beets preview failed", "tag": bt.to_dict()},
            )
        return None
    finally:
        bt.updated_at = datetime.datetime.now()
        if update_meta:
            bt.commit()
            ut.update_client_view("tags")

    if callback_url:
        requests.post(
            callback_url,
            json={"status": "beets preview done", "tag": bt.to_dict()},
        )

    beets_tags.cleanup_status()
    match_url = bt.match_url
    if not update_meta:
        session.rollback()
    session.close()

    return match_url


@ut.with_app_context
@ut.rq.job(timeout=600)
def import_task(
    id: str, match_url: str | None = None, callback_url: str | None = None
) -> str | None:
    """Import task for a tag.
    Relies on the preview task to have been run before.
    If it was not, we do it here (blocking the import thread).
    We do not import of no match is found according to your beets config.

    Args:
        id (str): tag id, needs to exist in sql db
        callback_url (str | None, optional): called on status change. Defaults to None.
    """

    log.debug(f"Import task on {id}")

    bt = beets_tags.Tag.query.filter_by(id=id).first()
    bt.task = "import"
    bt.updated_at = datetime.datetime.now()
    bt.commit()

    match_url = match_url or _get_or_gen_match_url(id)
    if not match_url:
        if callback_url:
            requests.post(
                callback_url,
                json={
                    "status": "beets import failed: no match url found.",
                    "tag": bt.to_dict(),
                },
            )
        return None

    try:
        bs = MatchedImportSession(path=bt.album_folder, match_url=match_url)
        bs.run_and_capture_output()

        bt.preview = bs.preview
        bt.distance = bs.match_dist
        bt.match_url = bs.match_url
        bt.num_tracks = bs.match_num_tracks
        bt.status = "imported" if bs.status == "ok" else "failed"
    except Exception as e:
        log.debug(e)
        bt.status = "failed"
        if callback_url:
            requests.post(
                callback_url,
                json={"status": "beets import failed", "tag": bt.to_dict()},
            )
        return None
    finally:
        bt.updated_at = datetime.datetime.now()
        bt.commit()
        ut.update_client_view("tags")

    if callback_url:
        requests.post(
            callback_url,
            json={"status": "beets preview done", "tag": bt.to_dict()},
        )

    beets_tags.cleanup_status()

    try:
        album_folder = os.path.commonpath(bt.track_paths_after)
    except Exception as e:
        # when the import task had an issue, track_paths_after might be an empty list
        album_folder = None
    return album_folder


@ut.with_app_context
def _get_or_gen_match_url(id: str) -> str | None:
    bt = beets_tags.Tag.query.filter_by(id=id).first()

    if bt.match_url is not None:
        log.debug(f"Match url already exists for {bt.album_folder}: {bt.match_url}")
        return bt.match_url
    if bt.distance is None:
        log.debug(f"No unique match for {bt.album_folder}: {bt.match_url}")
        # preview task was run but no match found.
        return None

    log.debug(
        f"Running preview task to get match url for {bt.album_folder}: {bt.match_url}"
    )
    return preview_task(id, update_meta=False)


@ut.with_app_context
def beets_task(beet_ids: list[str], extra_args) -> dict:
    """Our basic beets interface. Expects a list of existing task ids.
    Below we have thin wrappers for common workflows.

    Args:
        beet_ids (uuid): beets task id that exists in sql database
        extra_args (dict): task, group_id, callback_url. task is needed.

    Returns:
        dict: groupIds and beetsIds of the queued tasks.
    """
    log.debug(f"beets task for ids: {beet_ids}")

    task = extra_args.get("task", None)
    group_id = extra_args.get("group_id", None)
    callback_url = extra_args.get("callback_url", None)

    if task is None or task.lower() not in ["preview", "import"]:
        log.debug(f"invalid task {task=}")
        raise ValueError(f"Invalid task: {task}")

    bts: list[beets_tags.Tag] = beets_tags.Tag.query.filter(
        beets_tags.Tag.id.in_(beet_ids) # type: ignore
    ).all()

    if len(bts) == 0:
        log.debug("no beets tags found for provided ids")
        raise ValueError("No beets tags found for provided ids")

    if group_id:
        log.debug(f"assigning group id {group_id}")
        for bt in bts:
            bt.group_id = group_id

    for bt in bts:
        bt.task = task
        bt.status = "pending"
        bt.track_paths = bt.eligible_track_paths()
        bt.updated_at = datetime.datetime.now()
        bt.commit()

    ut.update_client_view("tags")

    for bt in bts:
        log.info(f"Queuing {bt.task} '{bt.album_folder}' (tag id: {bt.id})")
        if str(bt.task).lower() == "preview":
            ut.rq.get_queue("preview").enqueue(preview_task, bt.id, callback_url)
        elif str(bt.task).lower() == "import":
            ut.rq.get_queue("import").enqueue(import_task, bt.id, callback_url)
        else:
            log.debug(f"Invalid task {bt.task}")

    return {
        "groupIds": [bt.group_id for bt in bts],
        "beetsIds": [bt.id for bt in bts],
    }


@ut.with_app_context
def task_for_id(ids: list[str] | str, extra_args={}) -> dict:
    log.debug(f"task for id: {ids=}")
    if isinstance(ids, str):
        ids = [ids]

    return beets_task(ids, extra_args)


@ut.with_app_context
def task_for_paths(paths: list[str] | str, extra_args={}) -> dict:
    log.debug(f"task for paths: {paths=}")
    if isinstance(paths, str):
        paths = [paths]

    album_folders = disk.album_folders_from_track_paths(paths)

    for p in paths:
        if not os.path.exists(p):
            raise ValueError(f"Path {p} does not exist")
        if os.path.isdir(p) and p not in album_folders:
            album_folders.append(p)

    ids = []
    for f in album_folders:
        # we should only have one existing tag per folder.
        this_bts = beets_tags.Tag.query.filter_by(album_folder=f).all()
        assert len(this_bts) <= 1
        if len(this_bts) == 1:
            ids.append(this_bts[0].id)
        else:
            bt = beets_tags.Tag(album_folder=f)
            bt.commit()
            ids.append(bt.id)

    return beets_task(ids, extra_args)


@ut.with_app_context
def task_for_group(group_id: str, extra_args={}) -> dict:
    log.debug(f"task for group: {group_id=}")

    gr = beets_tags.TagGroup.query.filter_by(id=group_id).first()
    if not gr:
        raise ValueError(f"Invalid groupId {group_id}")

    ids = [bt.id for bt in gr.tags]

    return beets_task(ids, extra_args)
