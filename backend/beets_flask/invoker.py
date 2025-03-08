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

- We want to indicate status progress before session
    starts, and we want to do it for tasks, as they correspond
    to album folders. For that, we need taskStates in the Db
    before SessionStates!
    The current default case is one task per session.
    Other idea: new backend route with pending folders?
"""

from __future__ import annotations

import traceback
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

import requests
from rq import get_current_job
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
from beets_flask.database import Tag, db_session_factory
from beets_flask.database.models.states import FolderInDb, SessionStateInDb
from beets_flask.disk import Folder
from beets_flask.importer.session import ImportSessionNew, PreviewSessionNew
from beets_flask.importer.stages import Progress
from beets_flask.importer.states import CandidateState, SessionState, TaskState
from beets_flask.redis import import_queue, preview_queue, redis_conn, tag_queue
from beets_flask.server.routes.errors import InvalidUsage
from beets_flask.server.routes.status import update_client_view

if TYPE_CHECKING:
    from rq.job import Job
    from sqlalchemy.orm import Session


def enqueue(hash: str, path: str, kind: str, session: Session | None = None):
    """Delegate an existing tag to a redis worker, depending on its kind."""

    hash = FolderInDb.ensure_hash_consistency(hash, path)
    # TODO: maybe we want to require a new enqueue if hashes do not match?
    # For now we just roll with the new one.

    # update_client_view(
    #     type="tag",
    #     tagId=tag.id,
    #     tagPath=tag.album_folder,
    #     attributes={
    #         "kind": tag.kind,
    #         "status": tag.status,
    #         "updated_at": tag.updated_at.isoformat(),
    #     },
    #     message="Tag enqueued",
    # )

    if kind == "preview":
        job = preview_queue.enqueue(run_preview, hash, path, kind)
        __set_job_meta(job, hash, path, kind)
    elif kind == "import":
        job = import_queue.enqueue(run_import, hash, path, kind)
        __set_job_meta(job, hash, path, kind)
    elif kind == "import_as_is":
        job = import_queue.enqueue(run_import, hash, path, kind)
        __set_job_meta(job, hash, path, kind)
    elif kind == "auto":
        job = preview_queue.enqueue(run_preview, hash, path, kind)
        __set_job_meta(job, hash, path, "auto_preview")
        job = import_queue.enqueue(auto_import, hash, path, kind, depends_on=job)
        __set_job_meta(job, hash, path, "auto_import")
    else:
        raise ValueError(f"Unknown kind {kind}")

    log.debug(f"Enqueued {job.id=} {job.meta=}")

    return job


@job(timeout=600, queue=tag_queue, connection=redis_conn)
def run_preview(hash: str, path: str, kind: str, force_retag: bool = False):
    """Start a preview Session on an existing tag.

    Parameters
    ----------
    force_retag : bool, optional
        If true, we force identifying new matches, the current session (if
        existing) will be replaced with a new one. Default False.

    Returns
    -------
        str: the match url, if we found one, else None.
    """

    with db_session_factory() as db_session:
        log.info(f"Preview task on {hash=} {path=} {kind=}")
        f_on_disk = FolderInDb.ensure_hash_consistency(hash, path)
        if hash != f_on_disk.hash:
            log.warning(
                f"Folder content has changed since the job was scheduled for {path}. "
                + f"Using new content ({f_on_disk.hash}) instead of {hash}"
            )

        # update_client_view

        p_session = PreviewSessionNew(SessionState(f_on_disk))
        try:
            # TODO: Think about if session exists in db, create new if force_retag?
            # this concerns auto and retagging.
            p_session.run_sync()
        except Exception as e:
            log.exception(e)
        finally:
            s_state_indb = SessionStateInDb.from_live_state(p_session.state)
            db_session.merge(s_state_indb)
            db_session.commit()
            # update_client_view

        log.info(f"Preview done. {f_on_disk.hash=} {path=} {kind=}")


@job(timeout=600, queue=import_queue, connection=redis_conn)
def run_import(hash: str, path: str, kind: str, match_url: str | None = None):
    """Start Import session for a tag.

    Relies on a preview to have been generated before.
    If it was not, we do it here (blocking the import thread).
    We do not import if no match is found according to your beets config.

    Parameters
    ----------
    tagId:str
        The ID of the tag to be imported, used to load info from db.
    import_as_is:
        If true, we import as-is, **grouping albums** and ignoring the match_url.
        Effectively like `beet import --group-albums -A`.
        Default False.

    Returns
    -------
        List of track paths after import, as strings. (empty if nothing imported)

    """
    with db_session_factory() as db_session:
        log.info(f"Import task on {hash=} {path=} {kind=}")
        f_on_disk = FolderInDb.ensure_hash_consistency(hash, path)
        if hash != f_on_disk.hash:
            log.warning(
                f"Folder content has changed since the job was scheduled for {path}. "
                + f"Using new content ({f_on_disk.hash}) instead of {hash}"
            )

        # TODO: FIX the following to use the new session
        if kind == "import_as_is":
            raise NotImplementedError("Import as-is not implemented yet")
            """
            if as_is:
                bs = AsIsImportSession(
                    path=bt.album_folder,
                    tag_id=bt.id,
                )
            else:
            """

        s_state_indb = SessionStateInDb.get_by(
            SessionStateInDb.folder_hash == f_on_disk.hash
        )

        if s_state_indb is None:
            # This also happens when folder content was updated
            log.debug(f"Creating new session state for {f_on_disk.hash}")
            s_state_live = SessionState(f_on_disk)
        else:
            log.debug(f"Using existing session state for {f_on_disk.hash}")
            s_state_live = s_state_indb.to_live_state()

        # we need this expunge, otherwise we cannot overwrite session states:
        # If object id is in session we cant add a new object to the session with the
        # same id this will raise (see below session.merge)
        db_session.expunge_all()

        i_session = ImportSessionNew(s_state_live, match_url=match_url)
        try:
            i_session.run_sync()
        except Exception as e:
            log.exception(e)
        finally:
            s_state_indb = SessionStateInDb.from_live_state(i_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()


@job(timeout=600, queue=import_queue, connection=redis_conn)
def auto_import(hash: str, path: str, kind: str) -> list[str] | None:
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
    with db_session_factory() as session:
        log.info(f"Auto Import task on {hash=} {path=} {kind=}")
        f_on_disk = FolderInDb.ensure_hash_consistency(hash, path)
        if hash != f_on_disk.hash:
            raise InvalidUsage(
                f"Folder content has changed since the job was scheduled for {path}. "
                + f"This is not supported for auto-imports, please re-run preview."
            )

        s_state_indb = SessionStateInDb.get_by(SessionStateInDb.folder_hash == hash)
        if s_state_indb is None:
            raise InvalidUsage(
                f"Session state not found for {hash=}, this should not happen. "
                + "Please run preview before queueing auto-import."
            )

        # TODO: AutoImport Session
        # config = get_config()

        # strong_rec_thresh = config["match"]["strong_rec_thresh"].get(float)
        # if bt.distance is None or bt.distance > strong_rec_thresh:  # type: ignore
        #     log.info(
        #         f"Skipping auto import of {bt.album_folder=} with {bt.distance=} > {strong_rec_thresh=}"
        #     )
        #     return []

        # return run_import(
        #     tagId,
        # )


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
    with db_session_factory(session) as s:
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
    with db_session_factory() as session:
        stmt = delete(Tag).where(Tag.status.in_(with_status))
        result = session.execute(stmt)
        log.debug(
            f"Deleted {result.rowcount} tags with statuses: {', '.join(with_status)}"
        )
        session.commit()


def __set_job_meta(job: Job, hash: str, path: str, kind: str):
    job.meta["folder_hash"] = hash
    job.meta["folder_path"] = path
    job.meta["job_kind"] = kind
    job.save_meta()
