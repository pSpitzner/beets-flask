"""The invoker module is the glue between three concepts:

It combines:
- different sessions (like preview and import, interacting with beets, implementing core functions)
- states (session states, candidate states, folder states)
    - can be live (for working with in beets) or in_db (for storing in sql and sending to frontend)
- and the Redis Queue (to run the tasks in the background)
- also triggers status emission to frontend via decorators that invoke the websocket
"""

from __future__ import annotations

import functools
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Awaitable,
    Callable,
    Concatenate,
    Literal,
    ParamSpec,
    TypeVar,
)

from rq.job import Job
from sqlalchemy import select

from beets_flask import log
from beets_flask.database import db_session_factory
from beets_flask.database.models.states import (
    CandidateStateInDb,
    FolderInDb,
    SessionStateInDb,
)
from beets_flask.importer.progress import FolderStatus, Progress
from beets_flask.importer.session import (
    AddCandidatesSession,
    AutoImportSession,
    BootlegImportSession,
    ImportSession,
    PreviewSession,
    UndoSession,
)
from beets_flask.importer.states import SessionState
from beets_flask.importer.types import DuplicateAction
from beets_flask.redis import import_queue, preview_queue
from beets_flask.server.routes.exception import InvalidUsageException
from beets_flask.server.websocket.status import send_folder_status_update

if TYPE_CHECKING:
    from rq.job import Job
    from sqlalchemy.orm import Session


R = TypeVar("R")  # Return
P = ParamSpec("P")  # Parameters


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
                        raise InvalidUsageException(
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

            try:
                ret = await f(hash, path, *args, **kwargs)
            except Exception as e:
                # if the function fails, we want to send a failed status update
                # and raise the exception again.
                await send_folder_status_update(
                    hash=hash,
                    path=path,
                    status=FolderStatus.FAILED,
                    exc=e,
                )

                raise e

            if after is not None:
                await send_folder_status_update(
                    hash=hash,
                    path=path,
                    status=after,
                )

            return ret

        return wrapper

    return decorator


def exception_as_return_value(
    f: Callable[P, Awaitable[R]],
) -> Callable[P, Awaitable[R | Exception]]:
    """Decorator to catch exceptions and return them as a values.

    This is used to catch exceptions in the redis worker and return them
    as a values we can use in the frontend. Sadly standard exeption handling
    in rq is lacking!
    """

    @functools.wraps(f)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R | Exception:
        try:
            ret = await f(*args, **kwargs)
        except Exception as e:
            log.exception(e)
            # uncomment for traceback
            # log.exception(e)
            return e

        return ret

    return wrapper


class EnqueueKind(Enum):
    """Enum for the different kinds of sessions we can enqueue."""

    PREVIEW = "preview"
    PREVIEW_ADD_CANDIDATES = "preview_add_candidates"
    IMPORT_CANDIDATE = "import_candidate"
    IMPORT_AUTO = "import_auto"
    IMPORT_UNDO = "import_undo"
    IMPORT_BOOTLEG = "import_bootleg"
    # Bootlegs are essentially asis, but does not mean to just import the asis candidate,
    # it has its own session that also groups albums, and skips previews.

    _AUTO_IMPORT = "_auto_import"
    _AUTO_PREVIEW = "_auto_preview"

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
    """Delegate a preview or import to a redis worker, depending on its kind.

    Parameters
    ----------
    hash : str
        The hash of the folder to enqueue.
    path : str
        The path of the folder to enqueue.
    kind : EnqueueKind
        The kind of the folder to enqueue.
    kwargs : dict
        Additional arguments to pass to the worker functions. Depend on the kind,
        use with care.
    """
    match kind:
        case EnqueueKind.PREVIEW:
            job = enqueue_preview(hash, path, **kwargs)
        case EnqueueKind.PREVIEW_ADD_CANDIDATES:
            job = enqueue_preview_add_candidates(hash, path, **kwargs)
        case EnqueueKind.IMPORT_CANDIDATE:
            job = enqueue_import_candidate(hash, path, **kwargs)
        case EnqueueKind.IMPORT_AUTO:
            job = enqueue_import_auto(hash, path, **kwargs)
        case EnqueueKind.IMPORT_BOOTLEG:
            job = enqueue_import_bootleg(hash, path, **kwargs)
        case EnqueueKind.IMPORT_UNDO:
            job = enqueue_import_undo(hash, path, **kwargs)
        case _:
            raise InvalidUsageException(f"Unknown kind {kind}")

    log.debug(f"Enqueued {job.id=} {job.meta=}")

    return job


# --------------------------- Enqueue entry points --------------------------- #
# Mainly input validation and submitting to the redis queue


def enqueue_preview(hash: str, path: str, **kwargs) -> Job:
    if len(kwargs.keys()) > 0:
        raise InvalidUsageException("EnqueueKind.PREVIEW does not accept any kwargs.")
    job = preview_queue.enqueue(run_preview, hash, path)
    __set_job_meta(job, hash, path, EnqueueKind.PREVIEW)
    return job


def enqueue_preview_add_candidates(hash: str, path: str, **kwargs) -> Job:
    # May contain search_ids, search_artist, search_album
    search_ids = kwargs.pop("search_ids", [])
    search_artist = kwargs.pop("search_artist", None)
    search_album = kwargs.pop("search_album", None)

    if len(kwargs.keys()) > 0:
        raise InvalidUsageException(
            "EnqueueKind.PREVIEW_ADD_CANDIDATES only accepts "
            + "the following kwargs: search_ids, search_artist, search_album."
        )

    if len(search_ids) == 0 and search_artist is None and search_album is None:
        raise InvalidUsageException(
            "EnqueueKind.PREVIEW_ADD_CANDIDATES requires at least one of "
            + "the following kwargs: search_ids, search_artist, search_album."
        )

    # kwargs are mixed between our own function and redis enqueue -.-
    # if we accidentally define a redis kwarg for our function, it will be ignored.
    # https://python-rq.org/docs/#enqueueing-jobs
    job = preview_queue.enqueue(
        run_preview_add_candidates,
        hash,
        path,
        search_ids=search_ids,
        search_artist=search_artist,
        search_album=search_album,
    )
    __set_job_meta(job, hash, path, EnqueueKind.PREVIEW_ADD_CANDIDATES)
    return job


def enqueue_import_candidate(hash: str, path: str, **kwargs) -> Job:
    """
    Imports a candidate that has been fetched in a preview session.

    Kwargs
    ------
    candidate_id : str | None
        A valid candidate id for a candidate that has been fetched in a preview
        session. If none is given, the best candidate is used.
    TODO: Also allowed: "asis" (no exact match needed, there is only one
        asis-candidate).
    """

    # May contain candidate_id
    candidate_id: str = kwargs.pop("candidate_id", None)
    duplicate_action: DuplicateAction = kwargs.pop("duplicate_action", None)

    if len(kwargs.keys()) > 0:
        raise InvalidUsageException(
            "EnqueueKind.IMPORT only accepts the following kwargs: "
            + "candidate_id, duplicate_action."
        )

    # Validate if candidate_id exists
    if candidate_id is not None:
        with db_session_factory() as db_session:
            stmt = select(CandidateStateInDb).where(
                CandidateStateInDb.id == candidate_id
            )
            candidate = db_session.execute(stmt).scalar_one_or_none()
            if candidate is None:
                raise InvalidUsageException(
                    f"Candidate with id {candidate_id} does not exist in the database."
                )

    job = import_queue.enqueue(
        run_import_candidate,
        hash,
        path,
        candidate_id=candidate_id,
        duplicate_action=duplicate_action,
    )
    __set_job_meta(job, hash, path, EnqueueKind.IMPORT_CANDIDATE)
    return job


def enqueue_import_auto(hash: str, path: str, **kwargs):
    """
    Enqueue an automatic import.

    Auto jobs first generate a preview (if needed) and then run an import, which always
    imports the best candidate - but only if the preview is good enough (as specified
    in the users beets config)

    This is a two step process, and previews run in another queue (thread) than imports.

    See AutoImportSession for more details.
    """

    kwargs["auto_import"] = True
    job1 = preview_queue.enqueue(run_preview, hash, path, **kwargs)
    __set_job_meta(job1, hash, path, EnqueueKind._AUTO_PREVIEW)
    job2 = import_queue.enqueue(run_import_auto, hash, path, depends_on=job1, **kwargs)
    __set_job_meta(job2, hash, path, EnqueueKind._AUTO_IMPORT)

    return job2


def enqueue_import_bootleg(hash: str, path: str, **kwargs):
    job = import_queue.enqueue(run_import_bootleg, hash, path, **kwargs)
    __set_job_meta(job, hash, path, EnqueueKind.IMPORT_BOOTLEG)
    return job


def enqueue_import_undo(hash: str, path: str, **kwargs):
    delete_files: bool = kwargs.pop("delete_files", True)

    if len(kwargs.keys()) > 0:
        raise InvalidUsageException(
            "EnqueueKind.IMPORT_UNDO only accepts the following kwargs: "
            + "delete_files."
        )

    job = import_queue.enqueue(run_import_undo, hash, path, delete_files=delete_files)
    __set_job_meta(job, hash, path, EnqueueKind.IMPORT_UNDO)
    return job


# -------------------- Functions that run in redis workers ------------------- #


# redis preview queue
@exception_as_return_value
@emit_status(before=FolderStatus.PREVIEWING, after=FolderStatus.PREVIEWED)
async def run_preview(
    hash: str,
    path: str,
):
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

    log.info(f"Preview task on {hash=} {path=}")

    with db_session_factory() as db_session:
        f_on_disk = FolderInDb.get_current_on_disk(hash, path)
        if hash != f_on_disk.hash:
            log.warning(
                f"Folder content has changed since the job was scheduled for {path}. "
                + f"Using new content ({f_on_disk.hash}) instead of {hash}"
            )

        # here, in preview, we always want to start from a fresh state
        # otherwise, the retag action would not work, as preview starting from
        # an existing state would skip the candidate lookup.
        s_state_live = SessionState(f_on_disk)
        p_session = PreviewSession(s_state_live)
        try:
            # TODO: Think about if session exists in db, create new if force_retag?
            # this concerns auto and retagging.
            await p_session.run_async()
        finally:
            s_state_indb = SessionStateInDb.from_live_state(p_session.state)
            db_session.merge(s_state_indb)
            db_session.commit()

    log.info(f"Preview done. {hash=} {path=}")


# redis preview queue
@exception_as_return_value
@emit_status(before=FolderStatus.PREVIEWING, after=FolderStatus.PREVIEWED)
async def run_preview_add_candidates(
    hash: str,
    path: str,
    search_ids: list[str] = [],
    search_artist: str | None = None,
    search_album: str | None = None,
):
    """Adds a candidate to an session which is already in the status tagged.

    This only works if all session tasks are tagged. I.e. preview completed.
    """
    log.info(f"Add preview candidates task on {hash=}")

    with db_session_factory() as db_session:
        s_state_live = _get_live_state_by_folder(hash, path, db_session)

        if s_state_live.progress != Progress.PREVIEW_COMPLETED:
            raise InvalidUsageException(
                f"Session state not in preview completed state for {hash=}"
            )

        a_session = AddCandidatesSession(
            s_state_live,
            search_ids=search_ids,
            search_artist=search_artist,
            search_album=search_album,
        )
        try:
            await a_session.run_async()
        finally:
            s_state_indb = SessionStateInDb.from_live_state(a_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()

    log.info(f"Add candidates done. {hash=} {path=}")


# redis import queue
@exception_as_return_value
@emit_status(before=FolderStatus.IMPORTING, after=FolderStatus.IMPORTED)
async def run_import_candidate(
    hash: str,
    path: str,
    candidate_id: str | None = None,
    duplicate_action: DuplicateAction | None = None,
):
    """Imports a candidate that has been fetched in a preview session.

    Parameters
    ----------
    candidate_id : str | None
        If candidate_id is none the best candidate is used.
    duplicate_action : DuplicateAction | None
        If duplicate_action is none, the default action from the config is used.
    """
    log.info(f"Import task on {hash=} {path=}")

    with db_session_factory() as db_session:
        s_state_live = _get_live_state_by_folder(hash, path, db_session)

        i_session = ImportSession(
            s_state_live, candidate_id=candidate_id, duplicate_action=duplicate_action
        )

        try:
            await i_session.run_async()
        finally:
            s_state_indb = SessionStateInDb.from_live_state(i_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()

    log.info(f"Import candidate done. {hash=} {path=}")


# redis import queue
@exception_as_return_value
@emit_status(before=FolderStatus.IMPORTING, after=FolderStatus.IMPORTED)
async def run_import_auto(hash: str, path: str):
    # TODO: add duplicate action
    log.info(f"Auto Import task on {hash=} {path=}")

    with db_session_factory() as db_session:
        s_state_live = _get_live_state_by_folder(hash, path, db_session)
        i_session = AutoImportSession(s_state_live)

        try:
            i_session.run_sync()
        finally:
            s_state_indb = SessionStateInDb.from_live_state(i_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()

    log.info(f"Auto Import done. {hash=} {path=}")


# redis import queue
@exception_as_return_value
@emit_status(before=FolderStatus.IMPORTING, after=FolderStatus.IMPORTED)
async def run_import_bootleg(hash: str, path: str):
    log.info(f"Bootleg Import task on {hash=} {path=}")

    with db_session_factory() as db_session:
        # TODO: add duplicate action
        # TODO: sort out how to generate previews for asis candidates
        s_state_live = _get_live_state_by_folder(
            hash, path, create_if_not_exists=True, db_session=db_session
        )
        i_session = BootlegImportSession(s_state_live)

        try:
            i_session.run_sync()
        finally:
            s_state_indb = SessionStateInDb.from_live_state(i_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()

    log.info(f"Bootleg Import done. {hash=} {path=}")


@exception_as_return_value
@emit_status(before=FolderStatus.DELETING, after=FolderStatus.DELETED)
async def run_import_undo(hash: str, path: str, delete_files: bool):
    log.info(f"Import Undo task on {hash=} {path=}")

    with db_session_factory() as db_session:
        s_state_live = _get_live_state_by_folder(hash, path, db_session)
        i_session = UndoSession(s_state_live, delete_files=delete_files)

        try:
            await i_session.run_async()
        finally:
            s_state_indb = SessionStateInDb.from_live_state(i_session.state)
            db_session.merge(instance=s_state_indb)
            db_session.commit()

    log.info(f"Import Undo done. {hash=} {path=}")


def _get_live_state_by_folder(
    hash: str, path: str, db_session: Session, create_if_not_exists=False
) -> SessionState:
    f_on_disk = FolderInDb.get_current_on_disk(hash, path)
    if hash != f_on_disk.hash:
        log.warning(
            f"Folder content has changed since the job was scheduled for {path}. "
            + f"Using new content ({f_on_disk.hash}) instead of {hash}"
        )

    s_state_indb = SessionStateInDb.get_by_hash_and_path(
        # we warn about hash change, and want the import to still run
        # but on the old hash.
        hash=hash,
        path=path,
        db_session=db_session,
    )

    if s_state_indb is None and create_if_not_exists:
        s_state_live = SessionState(f_on_disk)
        return s_state_live

    if s_state_indb is None:
        # TODO: rq error handling
        raise InvalidUsageException(
            f"No session state found for {path=} {hash=} "
            + f"fresh_hash_on_disk={f_on_disk}, this should not happen."
        )

    log.debug(f"Using existing session state for {path=}")
    s_state_live = s_state_indb.to_live_state()

    # we need this expunge, otherwise we cannot overwrite session states:
    # If object id is in session we cant add a new object to the session with the
    # same id this will raise (see below session.merge)
    db_session.expunge_all()

    return s_state_live


def __set_job_meta(job: Job, hash: str, path: str, kind: EnqueueKind):
    job.meta["folder_hash"] = hash
    job.meta["folder_path"] = path
    job.meta["job_kind"] = kind.value
    job.save_meta()


__all__ = [
    "enqueue",
    "EnqueueKind",
]
