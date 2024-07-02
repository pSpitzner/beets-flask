"""
This module is the glue between three concepts:
- the BeetSessions (interacting with beets, implementing core functions)
- the Tags (our sql database model, grabbed by the gui to display everything static)
- the Redis Queue (to run the tasks in the background)
"""

from __future__ import annotations
from datetime import datetime

import requests

from beets_flask.models import Tag
from beets_flask.redis import rq
from beets_flask.beets_sessions import PreviewSession, MatchedImportSession
from beets_flask.utility import log
from beets_flask.db_engine import (
    db_session,
    Session,
)
from beets_flask.routes.errors import InvalidUsage
from beets_flask.routes.sse import update_client_view
from sqlalchemy import delete


def enqueue(id: str, session: Session | None = None):
    """
    Delegate an existing tag to a redis worker, depending on its kind.
    """

    with db_session(session) as s:
        tag = Tag.get_by(Tag.id == id, session=s)

        if tag is None:
            raise InvalidUsage(f"Tag {id} not found in database")

        tag.status = "pending"
        s.merge(tag)
        s.commit()
        update_client_view(
            type="tag",
            tagId=tag.id,
            tagPath=tag.album_folder,
            attributes={
                "kind": tag.kind,
                "status": tag.status,
                "updated_at": tag.updated_at.isoformat(),
            },
            message="Tag enqueued",
        )

        log.info(f"Enqueued {tag.id=} {tag.album_folder=} {tag.kind=}")

        if tag.kind == "preview":
            rq.get_queue("preview").enqueue(runPreview, id)
        elif tag.kind == "import":
            rq.get_queue("import").enqueue(runImport, id)
        else:
            raise ValueError(f"Unknown kind {tag.kind}")




def enqueue_tag_path(path: str, kind: str, session: Session | None = None):
    """
    For a given path that is taggable, update the existing tag or create a new one.
    """

    with db_session(session) as s:
        tag = Tag.get_by(Tag.album_folder == path, session=s) or Tag(
            album_folder=path, kind=kind
        )
        tag.kind = kind
        s.merge(tag)
        s.commit()
        enqueue(tag.id, session=s)


@rq.job(timeout=600)
def runPreview(tagId: str, callback_url: str | None = None) -> str | None:
    """
    Run a PreviewSession on an existing tag.

    Args:
        callback_url (str, optional): called on success/failure. Defaults to None.

    Returns:
        str: the match url, if we found one, else None.
    """
    with db_session() as session:
        log.debug(f"Preview task on {tagId}")
        bt = Tag.get_by(Tag.id == tagId, session=session)

        if bt is None:
            raise InvalidUsage(f"Tag {tagId} not found in database")

        session.merge(bt)
        bt.kind = "preview"
        bt.status = "tagging"
        bt.updated_at = datetime.now()
        session.commit()
        update_client_view(
            type="tag",
            tagId=bt.id,
            tagPath=bt.album_folder,
            attributes={
                "kind": bt.kind,
                "status": bt.status,
                "updated_at": bt.updated_at.isoformat(),
            },
            message="Tagging started",
        )

        try:
            bs = PreviewSession(path=bt.album_folder)
            bs.run_and_capture_output()

            log.debug(bs.preview)

            bt.preview = bs.preview
            bt.distance = bs.match_dist
            bt.match_url = bs.match_url
            bt.match_album = bs.match_album
            bt.match_artist = bs.match_artist
            bt.num_tracks = bs.match_num_tracks
            bt.status = (
                "tagged"
                if (bt.match_url is not None and bs.status == "ok")
                else bs.status
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
            bt.updated_at = datetime.now()
            session.commit()
            update_client_view(
                type="tag",
                tagPath=bt.album_folder,
                tagId=bt.id,
                attributes="all",
                message=f"Tagging finished with status: {bt.status}",
            )

        if callback_url:
            requests.post(
                callback_url,
                json={"status": "beets preview done", "tag": bt.to_dict()},
            )

        log.debug(f"preview done. {bt.status=}, {bt.match_url=}")

        return bt.match_url


@rq.job(timeout=600)
def runImport(
    tagId: str, match_url: str | None = None, callback_url: str | None = None
) -> list[str]:
    """
    Run an ImportSession for our tag.
    Relies on a preview to have been generated before.
    If it was not, we do it here (blocking the import thread).
    We do not import if no match is found according to your beets config.

    Args:
        callback_url (str | None, optional): called on status change. Defaults to None.

    Returns:
        The folder all imported files share in common. Empty list if nothing was imported.
    """
    with db_session() as session:
        log.debug(f"Import task on {tagId}")

        bt = Tag.get_by(Tag.id == tagId)

        if bt is None:
            raise InvalidUsage(f"Tag {tagId} not found in database")

        bt.kind = "import"
        bt.updated_at = datetime.now()
        session.merge(bt)
        session.commit()
        update_client_view(
            type="tag",
            tagId=bt.id,
            tagPath=bt.album_folder,
            attributes={
                "kind": bt.kind,
                "status": bt.status,
                "updated_at": bt.updated_at.isoformat(),
            },
            message="Importing started",
        )

        match_url = match_url or _get_or_gen_match_url(tagId, session)
        if not match_url:
            if callback_url:
                requests.post(
                    callback_url,
                    json={
                        "status": "beets import failed: no match url found.",
                        "tag": bt.to_dict(),
                    },
                )
            return []

        try:
            bs = MatchedImportSession(path=bt.album_folder, match_url=match_url)
            bs.run_and_capture_output()

            bt.preview = bs.preview
            bt.distance = bs.match_dist
            bt.match_url = bs.match_url
            bt.match_album = bs.match_album
            bt.match_artist = bs.match_artist
            bt.num_tracks = bs.match_num_tracks
            bt.track_paths_after = bs.track_paths_after_import
            bt.status = "imported" if bs.status == "ok" else bs.status
            log.debug(bs.preview)
            log.debug(bs.status)
        except Exception as e:
            log.debug(e)
            bt.track_paths_after = []
            bt.status = "failed"
            if callback_url:
                requests.post(
                    callback_url,
                    json={"status": "beets import failed", "tag": bt.to_dict()},
                )
            return []
        finally:
            bt.updated_at = datetime.now()
            session.merge(bt)
            session.commit()
            log.debug(bt.status)
            update_client_view(
                type="tag",
                tagId=bt.id,
                tagPath=bt.album_folder,
                attributes="all",
                message=f"Importing finished with status: {bt.status}",
            )

        if callback_url:
            requests.post(
                callback_url,
                json={"status": "beets preview done", "tag": bt.to_dict()},
            )

        # cleanup_status()
        return bt.track_paths_after


def _get_or_gen_match_url(tagId, session: Session) -> str | None:
    bt = Tag.get_by(Tag.id == tagId, session=session)

    if bt is None:
        raise InvalidUsage(f"Tag {tagId} not found in database")

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
    bs = PreviewSession(path=bt.album_folder)
    bs.run_and_capture_output()
    return bs.match_url


def tag_status(
    id: str | None = None, path: str | None = None, session: Session | None = None
):
    """
    Get the status of a tag by its id or path.
    Returns "untagged" if the tag does not exist or the path was not tagged yet.
    """

    with db_session(session) as s:
        bt = None
        if id is not None:
            bt = Tag.get_by(Tag.id == id, session=s)
        elif path is not None:
            bt = Tag.get_by(Tag.album_folder == path, session=s)

        if bt is None or bt.status is None:
            return "untagged"

        return bt.status

def delete_tags(with_status : list[str]):
    """
    Delete all tags that have a certain status from the database.
    We call this during container launch, to clear up things that
    went were not finished.

    # Args:
    with_status : list
    """
    with db_session() as session:
        stmt = delete(Tag).where(Tag.status.in_(with_status))
        result = session.execute(stmt)
        log.debug(f"Deleted {result.rowcount} tags with statuses: {', '.join(with_status)}")
        session.commit()
