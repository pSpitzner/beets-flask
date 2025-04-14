import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import TypedDict

from beets_flask.redis import wait_for_job_results
from quart import jsonify
from rq.job import Job
from sqlalchemy import select

from beets_flask import invoker
from beets_flask.database import db_session_factory
from beets_flask.database.models.states import FolderInDb, SessionStateInDb
from beets_flask.importer.progress import FolderStatus, Progress
from beets_flask.logger import log
from beets_flask.server.routes.errors import InvalidUsage, NotFoundError
from beets_flask.server.utility import get_folder_params, pop_query_param

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
        self.blueprint.route("/add_candidates", methods=["POST"])(self.add_candidates)

    async def get_by_folder(self):
        """Returns the most recent session state for a given folder hash or path."""

        folder_hashes, folder_paths, _ = await get_folder_params(allow_mismatch=True)

        if len(folder_hashes) != 1 and len(folder_paths) != 1:
            raise InvalidUsage(
                "Provide one folder hash OR one folder path", status_code=400
            )

        hash = None
        path = None
        if len(folder_hashes) != 1 or folder_hashes[0] is None:
            path = folder_paths[0]
        else:
            hash = folder_hashes[0]

        with db_session_factory() as db_session:
            item = self.model.get_by_hash_and_path(
                hash=hash,
                path=path,
                db_session=db_session,
            )

            if not item:
                # TODO: by path, validation of session hash
                # raise, but we do not want to spam the
                # frontend console with errors.
                # we manually handle this in sessionQueryOptions.
                raise NotFoundError(
                    f"Item with {hash=} {path=} not found", status_code=200
                )

            return jsonify(item.to_dict())

    async def enqueue(self):
        """Start a new session for a given folder hash or enqueue a new job for an existing session.

        You need to specify the folder of the album,
        and it has to be a valid album folder.

        # Params
        - `kind` (str): The kind of the tag. See `invoker.EnqueueKind`.
        """

        folder_hashes, folder_paths, params = await get_folder_params()
        kind = pop_query_param(params, "kind", str)
        if not isinstance(kind, str):
            raise InvalidUsage(
                "kind must be one of " + str(invoker.EnqueueKind.__members__)
            )

        jobs: list[Job] = []

        for hash, path in zip(folder_hashes, folder_paths):
            jobs.append(
                await invoker.enqueue(
                    hash, path, invoker.EnqueueKind.from_str(kind), **params
                )
            )

        return jsonify(
            {
                "message": f"{len(jobs)} added as kind: {kind}",
                "jobs": [j.get_meta() for j in jobs],
            }
        )

    async def add_candidates(self):
        """Search for new candidates.

        This starts a new session for a given folder hash.
        """
        log.warning("Adding candidates")
        folder_hashes, folder_paths, params = await get_folder_params(
            allow_mismatch=True
        )

        if len(folder_hashes) != 1:
            raise InvalidUsage("Folder hash must be a single value")
        if len(folder_paths) > 1:
            raise InvalidUsage("Folder path must be a single value")

        hash = folder_hashes[0]
        path = None
        if len(folder_paths) == 1:
            path = folder_paths[0]

        # Get additional params for search with a bit of validation
        search_ids: list[str] = pop_query_param(params, "search_ids", list, default=[])
        search_artist: str | None = pop_query_param(
            params, "search_artist", str, default=None
        )
        search_album: str | None = pop_query_param(
            params, "search_album", str, default=None
        )

        search_ids = list(
            filter(
                lambda x: isinstance(x, str) and len(x) > 0,
                search_ids,
            )
        )

        if search_artist is not None and search_artist.strip() == "":
            search_artist = None
        if search_album is not None and search_album.strip() == "":
            search_album = None

        if len(search_ids) == 0 and search_artist is None and search_album is None:
            raise InvalidUsage(
                "`search_ids`, `search_artist` or `search_album` must be provided!"
            )
        log.warning(f"{search_ids=}, {search_artist=}, {search_album=}")

        # Trigger job in queue
        job = await invoker.enqueue(
            hash,
            path,
            invoker.EnqueueKind.PREVIEW_ADD_CANDIDATES,
            search_ids=search_ids,
            search_artist=search_artist,
            search_album=search_album,
        )

        try:
            # FIXME: In theory we could return a list of
            # new candidates here and only fetch a
            # partial update in the frontend
            res = await wait_for_job_results(job)
        except Exception as e:
            return (
                jsonify(
                    {
                        "message": f"Job failed: {e}",
                        "job": job.get_meta(),
                    },
                ),
                500,
            )

        return jsonify(
            {
                "message": f"search_candidates for {len(folder_hashes)} folders",
                "jobs": [job.get_meta()],
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
