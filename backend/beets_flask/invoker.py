"""The invoker module is the glue between three concepts.

It combines:
- the BeetSessions (interacting with beets, implementing core functions)
- the Tags (our sql database model, grabbed by the gui to display everything static)
- the Redis Queue (to run the tasks in the background)

# Thoughts on hash validation:
- Hash validation on / shortly after route request
  for doing something on folder
- Routes take hash + path and warn if current
  folder hash (cached) does not match passed
- TODO: watchdog file change invalidate hash cache
- Database:
    - get by hash, (check path, should match, md5)
    - if fails: get by path
    - outlook todo: inform user on inconsinstency
    - in any case: here, walk tree, cos we create session
- New Routes:
    - get all candidates / tasks / sessions by folder-hash or folder-path

- Tagging / creation:
    - get real current folder state from disk and work with it.
    - consistency inform stuff, but in any case
    - put current path + hash into db
    - run tagging stuff associated to this path + hash
    - put tag results into db

"""

from __future__ import annotations

import traceback
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

import requests
from rq.decorators import job
from sqlalchemy import delete

from beets_flask import log
from beets_flask.beets_sessions import (
    AsIsImportSession,
    MatchedImportSession,
    PreviewSession,
    colorize,
)
from beets_flask.config import get_config
from beets_flask.database import Tag, db_session
from beets_flask.database.models.states import SessionStateInDb
from beets_flask.importer.session import ImportSessionNew, PreviewSessionNew
from beets_flask.importer.stages import Progress
from beets_flask.importer.states import CandidateState, SessionState, TaskState
from beets_flask.redis import import_queue, preview_queue, redis_conn, tag_queue
from beets_flask.server.routes.errors import InvalidUsage
from beets_flask.server.routes.status import update_client_view

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def enqueue(id: str, session: Session | None = None):
    """Delegate an existing tag to a redis worker, depending on its kind."""
    with db_session(session) as s:
        tag = Tag.get_by(Tag.id == id, session=s)

        if tag is None:
            raise InvalidUsage(f"Tag {id} not found in database")

        tag.status = "pending"
        s.merge(tag)
        s.commit()
        # TODO: this could become a watch-dog that monitors the database for updated
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

        try:
            if tag.kind == "preview":
                preview_queue.enqueue(runPreview, id)
            elif tag.kind == "import":
                import_queue.enqueue(runImport, id)
            elif tag.kind == "import_as_is":
                import_queue.enqueue(runImport, id, as_is=True)
            elif tag.kind == "auto":
                preview_job = preview_queue.enqueue(runPreview, id)
                import_queue.enqueue(AutoImport, id, depends_on=preview_job)
            else:
                raise ValueError(f"Unknown kind {tag.kind}")
        except Exception as e:
            log.error(f"Failed to enqueue {tag.id=} {tag.album_folder=} {tag.kind=}")


def enqueue_tag_path(path: str, kind: str, session: Session | None = None):
    """Create or update a tag by a given path.

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


@job(timeout=600, queue=tag_queue, connection=redis_conn)
def runPreview(tagId: str, force_retag: bool = False) -> str | None:
    """Start a preview Session on an existing tag.

    Parameters
    ----------
    tagId : str
        The ID of the tag to be previewed, used to load info from db.
    force_retag : bool, optional
        If true, we force identifying new matches, the current session (if
        existing) will be replaced with a new one. Default False.

    Returns
    -------
        str: the match url, if we found one, else None.
    """
    match_url = None
    with db_session() as session:
        log.info(f"Preview task on {tagId}")
        bt = Tag.get_by(Tag.id == tagId, session=session)
        if bt is None:
            raise InvalidUsage(f"Tag {tagId} not found in database")

        bt.status = "tagging"
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
            message="Tagging started",
        )

        try:
            # TODO: Check if session exists in db, create new if force_retag
            bs = PreviewSessionNew(SessionState(Path(bt.album_folder)))
            state = bs.run_sync()

            state_in_db = SessionStateInDb.from_live_state(state)
            session.add(state_in_db)
            bt.session_state_in_db = state_in_db

            bt.status = (
                "tagged"
                # If only the asis candidate exits, no match was found.
                if (
                    len(state.task_states[0].candidate_states) > 1
                    and state.progress >= Progress.LOOKING_UP_CANDIDATES
                )
                else "failed"
            )
        except Exception as e:
            log.error(e)
            bt.status = "failed"
            return None
        finally:
            session.merge(bt)
            session.commit()
            update_client_view(
                type="tag",
                tagPath=bt.album_folder,
                tagId=bt.id,
                attributes="all",
                message=f"Tagging finished with status: {bt.status}",
            )

        log.info(f"Preview done. {bt.status=}, {bt.match_url=}")
        match_url = bt.match_url

    return match_url


@job(timeout=600, queue=import_queue, connection=redis_conn)
def runImport(
    tagId: str,
    match_url: str | None = None,
    as_is: bool = False,
) -> list[str]:
    """Start Import session for a tag.

    Relies on a preview to have been generated before.
    If it was not, we do it here (blocking the import thread).
    We do not import if no match is found according to your beets config.

    Parameters
    ----------
    tagId:str
        The ID of the tag to be imported, used to load info from db.
    as_is: bool, optional
        If true, we import as-is, **grouping albums** and ignoring the match_url.
        Effectively like `beet import --group-albums -A`.
        Default False.
    match_url: str, optional
        The match url to use for import, if we have it.
    callback_url: str, optional
        Called when the import status changes.

    Returns
    -------
        List of track paths after import, as strings. (empty if nothing imported)

    """
    with db_session() as session:
        log.info(f"Import task: {as_is=} {tagId=}")
        bt = Tag.get_by_raise(Tag.id == tagId, session=session)

        bt.status = "importing"
        session.merge(bt)
        session.commit()

        # FIXME: update_client needs a refactor
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

        # Get session state (if any)
        state = (
            bt.session_state_in_db.to_live_state()
            if bt.session_state_in_db
            else SessionState(Path(bt.album_folder))
        )
        session.expunge_all()

        # TODO: FIX the following to use the new session
        """
        if as_is:
            bs = AsIsImportSession(
                path=bt.album_folder,
                tag_id=bt.id,
            )
        else:
        """

        try:
            bs = ImportSessionNew(
                state=state,
                match_url=match_url,
            )
            state = bs.run_sync()

            state_in_db = SessionStateInDb.from_live_state(state)
            session.merge(instance=state_in_db)

            # session.merge(state_in_db)
            bt.session_state_in_db = state_in_db
            bt.status = "imported" if state.progress == Progress.COMPLETED else "failed"
        except Exception as e:
            log.error(e)
            trace = traceback.format_exc()
            log.error(trace)
            bt.track_paths_after = []
            bt.status = "failed"
            return []
        finally:
            log.warning("Import stuck here?!")
            session.merge(bt)
            log.warning("Import stuck here?!")
            session.commit()
            log.info(f"Import done. {bt.status=}, {bt.match_url=}")
            update_client_view(
                type="tag",
                tagId=bt.id,
                tagPath=bt.album_folder,
                attributes="all",
                message=f"Importing finished with status: {bt.status}",
            )
            log.info(f"Client view updated for {bt.id=}")

        # cleanup_status()
        return bt.track_paths_after


@job(timeout=600, queue=import_queue, connection=redis_conn)
def AutoImport(tagId: str) -> list[str] | None:
    """Automatically run an import session.

    Runs an import on a tag after a preview has been generated.
    We check preview quality and user settings before running the import.

    Parameters
    ----------
    tagId:str
        The ID of the tag to be imported.

    Returns
    -------
        List of track paths after import, as strings. (empty if nothing imported)
    """
    with db_session() as session:
        log.info(f"AutoImport task on {tagId}")
        bt = Tag.get_by(Tag.id == tagId, session=session)
        if bt is None:
            raise InvalidUsage(f"Tag {tagId} not found in database")

        if bt.status != "tagged":
            log.info(
                f"Skipping auto import, we only import after a successful preview (status 'tagged' not '{bt.status}'). {bt.album_folder=}"
            )
            # we should consider to do an explicit duplicate check here
            # because two previews yielding the same match might finish at the same time
            return []

        if bt.kind != "auto":
            log.debug(
                f"For auto importing, tag kind needs to be 'auto' not '{bt.kind}'. {bt.album_folder=}"
            )
            return []

        config = get_config()

        if config["import"]["timid"].get(bool):
            log.info(
                "Auto importing is disabled if `import:timid=yes` is set in config"
            )
            return []

        strong_rec_thresh = config["match"]["strong_rec_thresh"].get(float)
        if bt.distance is None or bt.distance > strong_rec_thresh:  # type: ignore
            log.info(
                f"Skipping auto import of {bt.album_folder=} with {bt.distance=} > {strong_rec_thresh=}"
            )
            return []

        return runImport(
            tagId,
        )


def _get_or_gen_match_url(tagId, session: Session) -> str | None:
    bt = Tag.get_by(Tag.id == tagId, session=session)
    log.debug(f"Getting match url for {bt.to_dict() if bt else None}")
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
    """Get a tags status.

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


def delete_tags(with_status: list[str]):
    """Delete tags by status.

    Delete all tags that have a certain status from the database.
    We call this during container launch, to clear up things that
    did not finish.
    """
    with db_session() as session:
        stmt = delete(Tag).where(Tag.status.in_(with_status))
        result = session.execute(stmt)
        log.debug(
            f"Deleted {result.rowcount} tags with statuses: {', '.join(with_status)}"
        )
        session.commit()
