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
from beets_flask.routes.backend.errors import InvalidUsage
from beets_flask.routes.backend.sse import update_client_view


def enqueue(tagId: str, session: Session | None = None):
    """
    Delegate the tag to a redis worker, depending on its kind.
    """

    tag = Tag.get_by(Tag.id == tagId, session=session)

    if tag is None:
        raise InvalidUsage(f"Tag {tagId} not found in database")

    kind = tag.kind
    if kind == "preview":
        rq.get_queue("preview").enqueue(runPreview, tagId)
    elif kind == "import":
        rq.get_queue("import").enqueue(runImport, tagId)
    else:
        raise ValueError(f"Unknown kind {kind}")


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
            bt.status = "imported" if bs.status == "ok" else "failed"
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
    Get the status of a tag by its id or path
    """

    with db_session(session) as s:
        bt = None
        if id is not None:
            bt = Tag.get_by(Tag.id == id, session=s)
        elif path is not None:
            bt = Tag.get_by(Tag.album_folder == path, session=s)

        if bt is None:
            raise InvalidUsage(f"Tag not found in database")

        return bt.status
