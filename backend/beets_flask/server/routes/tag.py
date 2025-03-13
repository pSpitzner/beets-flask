"""Tag related API endpoints.

Tags are our database representation of a look-up or import performed by beets.
Can be created by the user or automatically by the system.
"""

from ast import Await
from functools import wraps
from typing import (
    TYPE_CHECKING,
    Any,
    Awaitable,
    Callable,
    Concatenate,
    List,
    Literal,
    ParamSpec,
    TypedDict,
)
from xml.etree.ElementInclude import include

from quart import Blueprint, Response, abort, jsonify, request
from rq.job import Job
from sqlalchemy import select

from beets_flask import invoker
from beets_flask.config import get_config
from beets_flask.database import Tag, db_session_factory
from beets_flask.database.models.states import FolderInDb
from beets_flask.disk import Folder
from beets_flask.importer.progress import FolderStatus
from beets_flask.logger import log

from .errors import InvalidUsage, get_query_param

tag_bp = Blueprint("tag", __name__, url_prefix="/tag")


def with_folders(
    f: Callable[[list[str], list[str], Any], Awaitable[Response]],
) -> Callable[..., Awaitable[Response]]:
    """Decorator for the standard scenario where we get a list of folder hashes and paths.

    Only works with functions that take the following arguments:
    - `folder_hashes` (list): A list of folder hashes
    - `folder_paths` (list): A list of folder paths
    - `params` (dict): The request parameters
    """

    @wraps(f)
    async def wrapper(*args, **kwargs):
        params = await request.get_json()
        folder_hashes = get_query_param(params, "folder_hashes", list, default=[])
        folder_paths = get_query_param(params, "folder_paths", list, default=[])

        if len(folder_hashes) != len(folder_paths):
            raise InvalidUsage(
                "folder_hashes and folder_paths must be of the same length"
            )

        return await f(folder_hashes, folder_paths, params)

    return wrapper


@tag_bp.route("/", methods=["GET"])
async def get_all():
    """Get all tags."""
    with db_session_factory() as session:
        stmt = select(Tag).order_by(Tag.created_at.desc())
        tags = session.execute(stmt).scalars().all()
        return [tag.to_dict() for tag in tags]


@tag_bp.route("/id/<tag_id>", methods=["GET"])
async def get_tag_by_id(tag_id: str):
    """Get a task by its id."""
    with db_session_factory() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        return tag.to_dict() if tag else {}


@tag_bp.route("/id/<tag_id>", methods=["DELETE"])
async def delete_tag_by_id(tag_id: str):
    """Delete a tag by its id."""
    with db_session_factory() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        if not tag:
            return {"message": "Tag not found"}, 404

        session.delete(tag)
        session.commit()
        return {"message": "Tag deleted"}


@tag_bp.route("/path/<path:folder>", methods=["GET"])
async def get_tag_by_folder_path(folder: str):
    """Get a tag by its folder path on disk."""
    with db_session_factory() as session:
        tag = Tag.get_by(Tag.album_folder == "/" + folder, session=session)
        return tag.to_dict() if tag else {}


@tag_bp.route("/path/<path:folder>", methods=["DELETE"])
async def delete_tag_by_folder_path(folder: str):
    """Delete a tag by its folder path on disk."""
    with db_session_factory() as session:
        tag = Tag.get_by(Tag.album_folder == "/" + folder, session=session)
        if not tag:
            return {"message": "Tag not found"}, 404

        session.delete(tag)
        session.commit()
        return {"message": "Tag deleted"}


@tag_bp.route("/add_old", methods=["POST"])
async def add_tag_old():
    """Add one or multiple tags.

    You need to specify the folder of the album,
    and it has to be a valid album folder.

    # Params
    - `kind` (str): The kind of the tag
    - `folders` (list): A list of folders to tag
    - OR `folder` (str): Single folder to tag

    """
    data = await request.get_json()
    kind = data.get("kind", None)
    # 24-10-21 PS@SM: lets talk about how we prefer the endpoint!
    folder = data.get("folder", None)
    folders = data.get("folders", None)

    if not ((folder and kind) or (folders and kind)):
        raise InvalidUsage("You need to specify at least a folder and kind of the tag")

    # Check if folder is array
    if not folders:
        folders = [folder]

    if kind == "import" and get_config()["gui"]["library"]["readonly"].get(bool):
        return abort(
            405,
            description={"error": "Library is configured as readonly"},
        )

    tags: list[dict] = []
    with db_session_factory() as session:
        for f in folders:
            tag = Tag.get_by(Tag.album_folder == f, session=session)
            if tag is not None:
                tag.kind = kind
            else:
                tag = Tag(album_folder=f, kind=kind)
            session.merge(tag)
            session.commit()
            invoker.enqueue(tag.id, session=session)
            tags.append(tag.to_dict())

    return jsonify(
        {
            "message": f"{len(tags)} tags added as kind: {kind}",
            "tags": tags,
        }
    )


@tag_bp.route("/add", methods=["POST"])
@with_folders
async def add_tag(folder_hashes: list[str], folder_paths: list[str], params: Any):
    """Add one or multiple tags.

    You need to specify the folder of the album,
    and it has to be a valid album folder.

    # Params
    - `kind` (str): The kind of the tag,
        "preview", "import", "auto", "import_as_is"

    """
    kind = get_query_param(params, "kind", str)
    if kind not in ["preview", "import", "auto", "import_as_is"]:
        raise InvalidUsage(
            "kind must be one of 'preview', 'import', 'auto', 'import_as_is'"
        )

    # deprication warning
    folder = get_query_param(params, "folder", str, None)
    print("Got folder", folder)
    if folder:
        raise InvalidUsage("Use /add_old instead of /add")

    jobs: List[Job] = []

    with db_session_factory() as session:
        for hash, path in zip(folder_hashes, folder_paths):
            jobs.append(invoker.enqueue(hash, path, kind, session=session))

    return jsonify(
        {
            "message": f"{len(jobs)} added as kind: {kind}",
            "jobs": [j.get_meta() for j in jobs],
        }
    )


class FolderStatusResponse(TypedDict):
    path: str
    hash: str
    status: FolderStatus


@tag_bp.route("/status", methods=["GET"])
@with_folders
async def get_status(folder_hashes: list[str], folder_paths: list[str], params: Any):
    """Get all pending tasks."""
    from beets_flask.redis import queues, redis_conn

    stats: list[FolderStatusResponse] = []

    queued: List[Job] = []
    scheduled: List[Job] = []
    started: List[Job] = []
    failed: List[Job] = []
    finished: List[Job] = []

    if len(folder_hashes) == 0:
        stmt = select(FolderInDb).order_by(FolderInDb.created_at.desc())
        with db_session_factory() as session:
            folders = session.execute(stmt).scalars().all()
            folder_hashes = [f.hash for f in folders]
            folder_paths = [f.full_path for f in folders]

    log.debug(f"Checking status for {len(folder_hashes)} folders")

    for q in queues:
        queued.extend(__get_jobs(q, connection=redis_conn))
        scheduled.extend(__get_jobs(q.scheduled_job_registry, connection=redis_conn))
        started.extend(__get_jobs(q.started_job_registry, connection=redis_conn))
        failed.extend(__get_jobs(q.failed_job_registry, connection=redis_conn))
        finished.extend(__get_jobs(q.finished_job_registry, connection=redis_conn))

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
                None,
            ],
        ):
            # meta data has hash, path and kind.
            # We need the kind to derive the status for completed folders.
            if meta := __is_hash_in_jobs(hash, jobs):
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
            # TODO: Lookup db if exists
            pass

        if isinstance(status, FolderStatus):
            stats.append(
                FolderStatusResponse(
                    path=path,
                    hash=hash,
                    status=status,
                )
            )

    return jsonify(stats)


def __get_jobs(registry, connection):
    log.debug(f"{registry} has {registry.count} jobs")
    try:
        # is a queyey
        job_ids = registry.job_ids
    except:
        # is a registry
        job_ids = registry.get_job_ids()
    log.warning(f"{registry} Job ids: {job_ids}")
    jobs = Job.fetch_many(job_ids, connection=connection)
    # jobs = registry.get_jobs()
    log.warning(f"Jobs {jobs}")
    jobs = [j for j in jobs if j is not None]
    return jobs


def __is_hash_in_jobs(hash: str, jobs: List[Job]) -> dict[str, str] | None:
    for j in jobs:
        meta = j.get_meta(False)
        log.warning(f"Meta: {meta}")
        if meta.get("folder_hash") == hash:
            return meta
    return None
