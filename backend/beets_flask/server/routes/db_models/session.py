from typing import TypedDict

from quart import jsonify
from rq.job import Job
from sqlalchemy import select

from beets_flask import invoker
from beets_flask.database import db_session_factory
from beets_flask.database.models.states import FolderInDb, SessionStateInDb
from beets_flask.importer.progress import FolderStatus, Progress
from beets_flask.logger import log
from beets_flask.server.routes.errors import InvalidUsage, NotFoundError
from beets_flask.server.utility import get_folder_params, get_query_param

from .base import ModelAPIBlueprint

__all__ = ["SessionAPIBlueprint"]


class SessionAPIBlueprint(ModelAPIBlueprint[SessionStateInDb]):
    def __init__(self):
        super().__init__(SessionStateInDb, url_prefix="/session")

    def _register_routes(self) -> None:
        """Register the routes for the blueprint."""
        super()._register_routes()
        self.blueprint.route("/by_folder", methods=["POST"])(self.get_by_folder)
        self.blueprint.route("/status", methods=["GET"])(self.get_status)
        self.blueprint.route("/enqueue", methods=["POST"])(self.enqueue)

    async def get_by_folder(self):
        """Returns the most recent session state for a given folder hash."""

        folder_hashes, folder_paths, _ = await get_folder_params(allow_mismatch=True)

        if len(folder_hashes) != 1:
            raise InvalidUsage("Only one folder hash is supported", status_code=400)

        hash = folder_hashes[0]

        with db_session_factory() as db_session:
            query = (
                select(self.model)
                .where((self.model.folder_hash == hash))
                .order_by(self.model.created_at.desc())
                .limit(1)
            )
            item = db_session.execute(query).scalars().first()
            if not item:
                # TODO: by path, validation of session hash
                # raise, but we do not want to spam the
                # frontend console with errors.
                # we manually handle this in sessionQueryOptions.
                raise NotFoundError(f"Item with hash {hash} not found", status_code=200)

            return jsonify(item.to_dict())

    async def enqueue(self):
        """Start a new session for a given folder hash or enqueue a new job for an existing session.

        You need to specify the folder of the album,
        and it has to be a valid album folder.

        # Params
        - `kind` (str): The kind of the tag,
            "preview", "import", "auto", "import_as_is"
        """

        folder_hashes, folder_paths, params = await get_folder_params()
        kind = get_query_param(params, "kind", str)
        if not isinstance(kind, str):
            raise InvalidUsage(
                "kind must be one of 'preview', 'import', 'auto', 'import_as_is'"
            )

        jobs: list[Job] = []

        for hash, path in zip(folder_hashes, folder_paths):
            jobs.append(
                await invoker.enqueue(hash, path, invoker.EnqueueKind.from_str(kind))
            )

        return jsonify(
            {
                "message": f"{len(jobs)} added as kind: {kind}",
                "jobs": [j.get_meta() for j in jobs],
            }
        )

    async def get_status(self):
        """Get all pending tasks."""

        folder_hashes, folder_paths, _ = await get_folder_params()

        from beets_flask.redis import queues, redis_conn

        folder_hashes, folder_paths, params = await get_folder_params()

        stats: list[FolderStatusResponse] = []

        queued: list[Job] = []
        scheduled: list[Job] = []
        started: list[Job] = []
        failed: list[Job] = []
        finished: list[Job] = []

        if len(folder_hashes) == 0:
            stmt = select(FolderInDb).order_by(FolderInDb.created_at.desc())
            with db_session_factory() as session:
                folders = session.execute(stmt).scalars().all()
                folder_hashes = [f.hash for f in folders]
                folder_paths = [f.full_path for f in folders]

        log.debug(f"Checking status for {len(folder_hashes)} folders")

        for q in queues:
            queued.extend(_get_jobs(q, connection=redis_conn))
            scheduled.extend(_get_jobs(q.scheduled_job_registry, connection=redis_conn))
            started.extend(_get_jobs(q.started_job_registry, connection=redis_conn))
            failed.extend(_get_jobs(q.failed_job_registry, connection=redis_conn))
            finished.extend(_get_jobs(q.finished_job_registry, connection=redis_conn))

        for hash, path in zip(folder_hashes, folder_paths):
            # Get metadata for folder if in any job queue
            status: FolderStatus | None = None
            for jobs, job_status in zip(
                [
                    queued,
                    scheduled,
                    started,
                    failed,
                    finished,
                ],
                [
                    FolderStatus.PENDING,
                    FolderStatus.PENDING,
                    FolderStatus.RUNNING,
                    FolderStatus.FAILED,
                    None,  # 'finished' needs further differentiation
                ],
            ):
                # meta data has hash, path and kind.
                # We need the kind to derive the status for completed folders.
                if meta := _is_hash_in_jobs(hash, jobs):
                    if job_status is None:
                        if "import" in meta["job_kind"]:
                            status = FolderStatus.IMPORTED
                        elif "preview" in meta["job_kind"]:
                            status = FolderStatus.TAGGED
                        else:
                            raise ValueError("Unknown job kind")
                    else:
                        status = job_status
                    break

            # We couldn't find the folder in any job queue. do lookup in db
            if status is None:
                log.debug(
                    f"Checking folder status via session from db: {path} ({hash})"
                )
                with db_session_factory() as db_session:
                    stmt = select(SessionStateInDb).where(
                        SessionStateInDb.folder_hash == hash
                    )
                    s_state_indb = db_session.execute(stmt).scalars().first()
                    if s_state_indb is None:
                        # We have no idea about this folder, this should not happen.
                        status = FolderStatus.UNKNOWN
                    else:
                        # PS: This progress <-> state mapping feels inconsistent.
                        # There should be a better place for this.
                        match s_state_indb.progress:
                            case Progress.NOT_STARTED:
                                status = FolderStatus.NOT_STARTED
                            case Progress.PREVIEW_COMPLETED:
                                status = FolderStatus.TAGGED
                            case Progress.COMPLETED:
                                status = FolderStatus.IMPORTED
                            case _:
                                status = FolderStatus.RUNNING

            stats.append(
                FolderStatusResponse(
                    path=path,
                    hash=hash,
                    status=status,
                )
            )

        return jsonify(stats)


class FolderStatusResponse(TypedDict):
    path: str
    hash: str
    status: FolderStatus


def _get_jobs(registry, connection):
    jobs = Job.fetch_many(registry.get_job_ids(), connection=connection)
    jobs = [j for j in jobs if j is not None]
    return jobs


def _is_hash_in_jobs(hash: str, jobs: list[Job]) -> dict[str, str] | None:
    for j in jobs:
        meta = j.get_meta(False)
        if meta.get("folder_hash") == hash:
            return meta
    return None
