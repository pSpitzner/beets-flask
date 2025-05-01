from __future__ import annotations

import asyncio
from enum import Enum
from typing import TYPE_CHECKING, Awaitable, Callable, ParamSpec, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from beets_flask.database import db_session_factory
from beets_flask.database.models.states import (
    CandidateStateInDb,
    FolderInDb,
    SessionState,
    SessionStateInDb,
)
from beets_flask.importer.progress import FolderStatus
from beets_flask.importer.session import (
    AddCandidatesSession,
    AutoImportSession,
    BootlegImportSession,
    CandidateChoice,
    ImportChoice,
    ImportSession,
    PreviewSession,
    UndoSession,
)
from beets_flask.importer.states import Progress
from beets_flask.importer.types import DuplicateAction
from beets_flask.logger import log
from beets_flask.redis import import_queue, preview_queue
from beets_flask.server.exceptions import (
    InvalidUsageException,
    exception_as_return_value,
)
from beets_flask.server.websocket.status import (
    JobStatusUpdate,
    emit_folder_status,
    send_status_update,
)

from .job import ExtraJobMeta, _set_job_meta

if TYPE_CHECKING:
    from rq.job import Job
    from rq.queue import Queue


def emit_update_on_job_change(job, connection, result, *args, **kwargs):
    """
    Callback for rq enqueue functions to emit a job status update via websocket.

    See https://python-rq.org/docs/#success-callback
    """
    log.debug(f"job update for socket {job=} {connection=} {result=} {args=} {kwargs=}")

    try:
        asyncio.run(
            send_status_update(
                JobStatusUpdate(
                    message="Job status update",
                    num_jobs=1,
                    job_metas=[job.get_meta()],
                )
            )
        )
    except Exception as e:
        log.error(f"Failed to emit job update: {e}", exc_info=True)


P = ParamSpec("P")  # Parameters
R = TypeVar("R")  # Return


def _enqueue(
    queue: Queue,
    f: Callable[P, R | Awaitable[R]],
    *args: P.args,
    **kwargs: P.kwargs,
) -> Job:
    """Enqueue a job in redis.

    Helper that sets some shared behavior and allows
    to for proper type hinting.
    """

    job = queue.enqueue(
        f,
        *args,
        **kwargs,
        on_success=emit_update_on_job_change,
    )
    return job


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


@emit_folder_status(before=FolderStatus.PENDING)
async def enqueue(
    hash: str,
    path: str,
    kind: EnqueueKind,
    extra_meta: ExtraJobMeta | None = None,
    **kwargs,
) -> Job:
    """Delegate a preview or import to a redis worker, depending on its kind.

    Parameters
    ----------
    hash : str
        The hash of the folder to enqueue.
    path : str
        The path of the folder to enqueue.
    kind : EnqueueKind
        The kind of the folder to enqueue.
    extra_meta: ExtraJobMeta, optional
        Extra meta data to pass to the job. E.g. use this to assign a reference
        for the frontend to the job, so we can track it via the websocket.
    kwargs : dict
        Additional arguments to pass to the worker functions. Depend on the kind,
        use with care.
    """
    if extra_meta is None:
        extra_meta = ExtraJobMeta()

    match kind:
        case EnqueueKind.PREVIEW:
            job = enqueue_preview(hash, path, extra_meta, **kwargs)
        case EnqueueKind.PREVIEW_ADD_CANDIDATES:
            job = enqueue_preview_add_candidates(hash, path, extra_meta, **kwargs)
        case EnqueueKind.IMPORT_AUTO:
            job = enqueue_import_auto(hash, path, extra_meta, **kwargs)
        case EnqueueKind.IMPORT_CANDIDATE:
            job = enqueue_import_candidate(hash, path, extra_meta, **kwargs)
        case EnqueueKind.IMPORT_BOOTLEG:
            job = enqueue_import_bootleg(hash, path, extra_meta, **kwargs)
        case EnqueueKind.IMPORT_UNDO:
            job = enqueue_import_undo(hash, path, extra_meta, **kwargs)
        case _:
            raise InvalidUsageException(f"Unknown kind {kind}")

    log.debug(f"Enqueued {job.id=} {job.meta=}")

    return job


# --------------------------- Enqueue entry points --------------------------- #
# Mainly input validation and submitting to the redis queue


def enqueue_preview(hash: str, path: str, extra_meta: ExtraJobMeta, **kwargs) -> Job:
    if len(kwargs.keys()) > 0:
        raise InvalidUsageException("EnqueueKind.PREVIEW does not accept any kwargs.")
    job = _enqueue(preview_queue, run_preview, hash, path)
    _set_job_meta(job, hash, path, EnqueueKind.PREVIEW, extra_meta)
    return job


def enqueue_preview_add_candidates(
    hash: str, path: str, extra_meta: ExtraJobMeta, **kwargs
) -> Job:
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
    job = _enqueue(
        preview_queue,
        run_preview_add_candidates,
        hash,
        path,
        search_ids=search_ids,
        search_artist=search_artist,
        search_album=search_album,
    )
    _set_job_meta(job, hash, path, EnqueueKind.PREVIEW_ADD_CANDIDATES, extra_meta)
    return job


def enqueue_import_candidate(
    hash: str, path: str, extra_meta: ExtraJobMeta, **kwargs
) -> Job:
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

    job = _enqueue(
        import_queue,
        run_import_candidate,
        hash,
        path,
        candidate_id=candidate_id,
        duplicate_action=duplicate_action,
    )
    _set_job_meta(job, hash, path, EnqueueKind.IMPORT_CANDIDATE, extra_meta)
    return job


def enqueue_import_auto(hash: str, path: str, extra_meta: ExtraJobMeta, **kwargs):
    """
    Enqueue an automatic import.

    Auto jobs first generate a preview (if needed) and then run an import, which always
    imports the best candidate - but only if the preview is good enough (as specified
    in the users beets config)

    This is a two step process, and previews run in another queue (thread) than imports.

    See AutoImportSession for more details.
    """

    kwargs["auto_import"] = True

    # We only assign the on_success callback (likely coming
    # via a kwarg) to the second job!
    job1 = preview_queue.enqueue(run_preview, hash, path, **kwargs)
    _set_job_meta(job1, hash, path, EnqueueKind._AUTO_PREVIEW, extra_meta)
    job2 = _enqueue(
        import_queue,
        run_import_auto,
        hash,
        path,
        **kwargs,
        depends_on=job1,  # type: ignore a bit of an hack to get depends_on working
    )
    _set_job_meta(job2, hash, path, EnqueueKind._AUTO_IMPORT, extra_meta)

    return job2


def enqueue_import_bootleg(hash: str, path: str, extra_meta: ExtraJobMeta, **kwargs):
    job = _enqueue(import_queue, run_import_bootleg, hash, path, **kwargs)
    _set_job_meta(job, hash, path, EnqueueKind.IMPORT_BOOTLEG, extra_meta)
    return job


def enqueue_import_undo(hash: str, path: str, extra_meta: ExtraJobMeta, **kwargs):
    delete_files: bool = kwargs.pop("delete_files", True)

    if len(kwargs.keys()) > 0:
        raise InvalidUsageException(
            "EnqueueKind.IMPORT_UNDO only accepts the following kwargs: "
            + "delete_files."
        )

    job = _enqueue(
        import_queue,
        run_import_undo,
        hash,
        path,
        delete_files=delete_files,
    )
    _set_job_meta(job, hash, path, EnqueueKind.IMPORT_UNDO, extra_meta)
    return job


# -------------------- Functions that run in redis workers ------------------- #
# TODO: We might want to move these to their own file, for a bit better separation of
# concerns.


# redis preview queue
@exception_as_return_value
@emit_folder_status(before=FolderStatus.PREVIEWING, after=FolderStatus.PREVIEWED)
async def run_preview(
    hash: str,
    path: str,
):
    """Fetch candidates for a folder using beets.

    Will refetch candidates if this is rerun even if candidates exist
    in the db.

    Current convention is we have one session for one folder *has*, but
    We might have multiple sessions for the same folder **path**.
    Previews will **reset** any previous session state in the database, if they
    exist for the same folder hash.

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
        # an existing state would skip the candidate lookup.
        # otherwise, the retag action would not work, as preview starting from
        s_state_live = SessionState(f_on_disk)
        p_session = PreviewSession(s_state_live)

        try:
            await p_session.run_async()
        finally:
            # Get max revision for this folder hash
            stmt = select(func.max(SessionStateInDb.folder_revision)).where(
                SessionStateInDb.folder_hash == hash,
            )
            max_rev = db_session.execute(stmt).scalar_one_or_none()
            new_rev = 0 if max_rev is None else max_rev + 1
            s_state_indb = SessionStateInDb.from_live_state(p_session.state)
            s_state_indb.folder_revision = new_rev

            db_session.merge(s_state_indb)
            db_session.commit()

    log.info(f"Preview done. {hash=} {path=}")


# redis preview queue
@exception_as_return_value
@emit_folder_status(before=FolderStatus.PREVIEWING, after=FolderStatus.PREVIEWED)
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
@emit_folder_status(before=FolderStatus.IMPORTING, after=FolderStatus.IMPORTED)
async def run_import_candidate(
    hash: str,
    path: str,
    candidate_id: CandidateChoice
    | dict[str, CandidateChoice]
    | None = ImportChoice.BEST,
    duplicate_action: DuplicateAction | dict[str, DuplicateAction] | None = None,
):
    """Imports a candidate that has been fetched in a preview session.

    Parameters
    ----------
    candidate_id : optional
        If candidate_id is none the best candidate is used.
    duplicate_action : optional
        If duplicate_action is none, the default action from the config is used.
    """
    log.info(f"Import task on {hash=} {path=}")

    if candidate_id is None:
        candidate_id = ImportChoice.BEST

    with db_session_factory() as db_session:
        s_state_live = _get_live_state_by_folder(hash, path, db_session)

        i_session = ImportSession(
            s_state_live,
            candidate_id=candidate_id,
            duplicate_action=duplicate_action,
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
@emit_folder_status(before=FolderStatus.IMPORTING, after=FolderStatus.IMPORTED)
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
@emit_folder_status(before=FolderStatus.IMPORTING, after=FolderStatus.IMPORTED)
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
@emit_folder_status(before=FolderStatus.DELETING, after=FolderStatus.DELETED)
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
