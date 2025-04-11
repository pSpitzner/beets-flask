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

import functools
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Awaitable,
    Callable,
    Concatenate,
    ParamSpec,
    TypeVar,
)

from deprecated import deprecated
from rq.decorators import job
from rq.job import Job

from beets_flask import log
from beets_flask.database import Tag, db_session_factory
from beets_flask.database.models.states import FolderInDb, SessionStateInDb
from beets_flask.importer.progress import FolderStatus, Progress
from beets_flask.importer.session import (
    AddCandidatesSession,
    AsIsImportSession,
    AutoImportSession,
    ImportSession,
    PreviewSession,
)
from beets_flask.importer.states import SessionState
from beets_flask.redis import import_queue, preview_queue, redis_conn
from beets_flask.server.routes.errors import InvalidUsage
from beets_flask.server.websocket.status import send_folder_status_update

if TYPE_CHECKING:
    from rq.job import Job
    from sqlalchemy.orm import Session


R = TypeVar("R")
P = ParamSpec("P")


def emit_status(
    before: FolderStatus | None = None, after: FolderStatus | None = None
) -> Callable[
    [Callable[Concatenate[str, str, P], Awaitable[R]]],
    Callable[Concatenate[str, str | None, P], Awaitable[R]],
]:
    """Decorator to propagate status updates to clients.

    Parameters
    ----------
    before: FolderStatus, optional
        The status before the function is called. If none is given, no status update is sent.
    after: FolderStatus, optional
        The status after the function is called. If none is given, no status update is sent.
    """

    def decorator(
        f: Callable[Concatenate[str, str, P], Awaitable[R]],
    ) -> Callable[Concatenate[str, str | None, P], Awaitable[R]]:
        @functools.wraps(f)
        async def wrapper(hash: str, path: str | None, *args, **kwargs) -> R:
            # if only a hash is given and no path, we retrieve the path from the db
            if path is None:
                with db_session_factory() as db_session:
                    f_on_disk = FolderInDb.get_by(
                        FolderInDb.id == hash, session=db_session
                    )
                    if f_on_disk is None:
                        raise InvalidUsage(
                            f"If only hash is given, it must be in the db."
                        )
                    path = f_on_disk.full_path

            # FIXME: In theory we could keep the socket client open here
            if before is not None:
                await send_folder_status_update(
                    hash=hash,
                    path=path,
                    status=before,
                )

            ret = await f(hash, path, *args, **kwargs)

            if after is not None:
                await send_folder_status_update(
                    hash=hash,
                    path=path,
                    status=after,
                )

            return ret

        return wrapper

    return decorator


class EnqueueKind(Enum):
    """Enum for the different kinds of sessions we can enqueue."""

    PREVIEW = "preview"
    IMPORT = "import"
    IMPORT_AS_IS = "import_as_is"
    AUTO = "auto"
    ADD_CANDIDATES = "add_candidates"

    _AUTO_IMPORT = "auto_import"
    _AUTO_PREVIEW = "auto_preview"

    @classmethod
    def from_str(cls, kind: str) -> EnqueueKind:
        """Convert a string to an EnqueueKind enum.

        Parameters
        ----------
        kind : str
            The string to convert.
        """
        try:
            return cls[kind.upper()]
        except KeyError:
            raise ValueError(f"Unknown kind {kind}")


@emit_status(before=FolderStatus.PENDING)
async def enqueue(hash: str, path: str, kind: EnqueueKind, **kwargs) -> Job:
    """Delegate an existing tag to a redis worker, depending on its kind.

    Parameters
    ----------
    hash : str
        The hash of the folder to enqueue.
    path : str
        The path of the folder to enqueue.
    kind : EnqueueKind
        The kind of the folder to enqueue.
    kwargs : dict
        Additional arguments to pass to the worker functions. Might depend on the kind,
        use with care.
    """

    if kind == EnqueueKind.PREVIEW:
        job = preview_queue.enqueue(run_preview, hash, path, **kwargs)
        __set_job_meta(job, hash, path, kind)
    elif kind == EnqueueKind.IMPORT:
        job = import_queue.enqueue(run_import, hash, path, False, **kwargs)
        __set_job_meta(job, hash, path, kind)
    elif kind == EnqueueKind.IMPORT_AS_IS:
        job = import_queue.enqueue(run_import, hash, path, True, **kwargs)
        __set_job_meta(job, hash, path, kind)
    elif kind == EnqueueKind.AUTO:
        job = preview_queue.enqueue(run_preview, hash, path, **kwargs)
        __set_job_meta(job, hash, path, EnqueueKind._AUTO_PREVIEW)
        job = import_queue.enqueue(run_auto_import, hash, path, depends_on=job)
        __set_job_meta(job, hash, path, EnqueueKind._AUTO_IMPORT)
    elif kind == EnqueueKind.ADD_CANDIDATES:
        job = preview_queue.enqueue(run_add_candidates, hash, path, **kwargs)
        __set_job_meta(job, hash, path, kind)
    else:
        raise ValueError(f"Unknown kind {kind}")

    log.debug(f"Enqueued {job.id=} {job.meta=}")

    return job


@job(timeout=600, queue=preview_queue, connection=redis_conn)
@emit_status(before=FolderStatus.RUNNING, after=FolderStatus.TAGGED)
async def run_preview(hash: str, path: str):
    """Fetch candidates for a folder using beets.

    Will refetch candidates if this is rerun even if candidates exist
    in the db.

    Parameters
    ----------
    hash : str
        The hash of the folder for which to run the preview.
    path : str
        The path of the folder for which to run the preview.
    """

    with db_session_factory() as db_session:
        log.info(f"Preview task on {hash=} {path=}")
        f_on_disk = FolderInDb.get_current_on_disk(hash, path)
        if hash != f_on_disk.hash:
            log.warning(
                f"Folder content has changed since the job was scheduled for {path}. "
                + f"Using new content ({f_on_disk.hash}) instead of {hash}"
            )

        p_session = PreviewSession(SessionState(f_on_disk))
        try:
            # TODO: Think about if session exists in db, create new if force_retag?
            # this concerns auto and retagging.
            await p_session.run_async()
        except Exception as e:
            log.exception(e)
        finally:
            s_state_indb = SessionStateInDb.from_live_state(p_session.state)
            db_session.merge(s_state_indb)
            db_session.commit()

        log.info(f"Preview done. {f_on_disk.hash=} {path=}")


@job(timeout=600, queue=import_queue, connection=redis_conn)
@emit_status(before=FolderStatus.RUNNING, after=FolderStatus.IMPORTED)
async def run_import(
    hash: str, path: str, import_asis: bool, match_url: str | None = None
):
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
        log.info(f"Import task on {hash=} {path=}")
        f_on_disk = FolderInDb.get_current_on_disk(hash, path)
        if hash != f_on_disk.hash:
            log.warning(
                f"Folder content has changed since the job was scheduled for {path}. "
                + f"Using new content ({f_on_disk.hash}) instead of {hash}"
            )

        s_state_indb = SessionStateInDb.get_by(
            SessionStateInDb.folder_hash == f_on_disk.hash, session=db_session
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

        # FIXME: More generic way to import any candidate
        if import_asis:
            i_session = AsIsImportSession(s_state_live)
        else:
            i_session = ImportSession(s_state_live, match_url=match_url)

        try:
            await i_session.run_async()
        except Exception as e:
            log.exception(e)
        finally:
            s_state_indb = SessionStateInDb.from_live_state(i_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()


@job(timeout=600, queue=import_queue, connection=redis_conn)
@emit_status(before=FolderStatus.RUNNING, after=FolderStatus.IMPORTED)
async def run_auto_import(hash: str, path: str) -> list[str] | None:
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
    with db_session_factory() as db_session:
        log.info(f"Auto Import task on {hash=} {path=}")
        f_on_disk = FolderInDb.get_current_on_disk(hash, path)
        if hash != f_on_disk.hash:
            raise InvalidUsage(
                f"Folder content has changed since the job was scheduled for {path}. "
                + f"This is not supported for auto-imports, please re-run preview."
            )

        s_state_indb = SessionStateInDb.get_by(
            SessionStateInDb.folder_hash == hash, session=db_session
        )
        if s_state_indb is None:
            raise InvalidUsage(
                f"Session state not found for {hash=}, this should not happen. "
                + "Please run preview before queueing auto-import."
            )

        s_state_live = s_state_indb.to_live_state()
        i_session = AutoImportSession(s_state_live)

        try:
            i_session.run_sync()
        except Exception as e:
            log.exception(e)
        finally:
            s_state_indb = SessionStateInDb.from_live_state(i_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()


@job(timeout=600, queue=preview_queue, connection=redis_conn)
@emit_status(before=FolderStatus.RUNNING, after=FolderStatus.TAGGED)
async def run_add_candidates(
    hash: str,
    path: str,
    search_ids: list[str] = [],
    search_artist: str | None = None,
    search_album: str | None = None,
):
    """Adds a candidate to an session which is already in the status tagged.

    This only works if all session tasks are tagged. I.e. preview completed.
    """
    with db_session_factory() as db_session:
        log.info(f"Add candidates task on {hash=}")

        s_state_indb = SessionStateInDb.get_by(
            SessionStateInDb.folder_hash == hash, session=db_session
        )
        if s_state_indb is None:
            raise InvalidUsage(
                f"Session state not found for {hash=}, this should not happen. "
                + "Please run preview before queueing auto-import."
            )

        if s_state_indb.progress != Progress.PREVIEW_COMPLETED:
            raise InvalidUsage(
                f"Session state not in preview completed state for {hash=}"
            )

        s_state_live = s_state_indb.to_live_state()

        # we need this expunge, otherwise we cannot overwrite session states:
        # If object id is in session we cant add a new object to the session with the
        # same id this will raise (see below session.merge)
        db_session.expunge_all()

        a_session = AddCandidatesSession(
            s_state_live,
            search_ids=search_ids,
            search_artist=search_artist,
            search_album=search_album,
        )
        try:
            await a_session.run_async()
        except Exception as e:
            log.exception(e)
        finally:
            s_state_indb = SessionStateInDb.from_live_state(a_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()
        log.info(f"Add candidates done. {hash=} {path=}")


def __set_job_meta(job: Job, hash: str, path: str, kind: EnqueueKind):
    job.meta["folder_hash"] = hash
    job.meta["folder_path"] = path
    job.meta["job_kind"] = kind.value
    job.save_meta()


__all__ = [
    "enqueue",
    "EnqueueKind",
]
