from __future__ import annotations

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Literal, NotRequired, TypedDict, cast

from cachetools import Cache
from quart import Blueprint, jsonify, request, Response
from sqlalchemy import func, select

from beets_flask.database import db_session_factory
from beets_flask.database.models.states import FolderInDb, SessionStateInDb
from beets_flask.disk import (
    Archive,
    FileSystemItem,
    Folder,
    dir_files,
    dir_size,
    fs_item_from_path,
    path_to_folder,
)
from beets_flask.importer.progress import FolderStatus, Progress
from beets_flask.logger import log
from beets_flask.server.exceptions import (
    InvalidUsageException,
    NotFoundException,
    SerializedException,
)
from beets_flask.server.routes.db_models.session import (
    MinimalSession,
    retrieve_folder_minimal,
    retrieve_folder_status,
)
from beets_flask.server.utility import (
    pop_folder_params,
)
from beets_flask.server.websocket.status import (
    trigger_clear_cache,
)
from beets_flask.watchdog.inbox import (
    get_inbox_folders,
    get_inbox_for_path,
)

inbox_bp = Blueprint("inbox", __name__, url_prefix="/inbox")


class InboxTreeLeaf(TypedDict):
    """Serialized file/archive entry returned by the inbox tree endpoint."""

    type: Literal["file", "archive"]
    full_path: str
    hash: str
    is_album: bool


class InboxTreeFolder(TypedDict):
    """Serialized directory entry returned by the inbox tree endpoint.

    Status and minimal session data are included only for album directories.
    Non-album directories remain structural nodes and contain only children.
    """

    type: Literal["directory"]
    full_path: str
    hash: str
    is_album: bool

    # These fields are omitted for non-album directories.
    status: NotRequired[int]
    exc: NotRequired[SerializedException | None]
    minimal: NotRequired[MinimalSession | None]
    children: list[InboxTreeLeaf | InboxTreeFolder]
    


InboxTreeItem = InboxTreeLeaf | InboxTreeFolder


@inbox_bp.route("/tree", methods=["GET"])
async def get_tree() -> Response[list[InboxTreeFolder]]:
    """Get all paths inside the inbox folder(s) with status 
    and minimal session data appended.
    """

    inbox_folders = get_inbox_folders()

    # Create dict representation of inbox folders
    folders: list[Folder] = []
    for folder in inbox_folders:
        log.info(f"Processing inbox folder: {folder}")
        folders.append(path_to_folder(folder, subdirs=False))

    folder_hashes: list[str] = []
    folder_paths: list[str] = []

    # Collect album folder hashes and paths for lookups
    def record_folder_tree(folder: FileSystemItem):
        if isinstance(folder, Folder):
            if folder.is_album:
                folder_hashes.append(folder.hash)
                folder_paths.append(folder.full_path)
            for child in folder.children:
                record_folder_tree(child)

    for folder in folders:
        # Keep the configured inbox root in the response, but only album
        # directories participate in status/session lookup.
        record_folder_tree(folder)

    status = await retrieve_folder_status(
        folder_hashes=folder_hashes, folder_paths=folder_paths
    )

    status_by_hash = {status_update.hash: status_update for status_update in status}

    minimal = await retrieve_folder_minimal(folder_hashes, folder_paths, None)


    def serialize_tree_item(item: FileSystemItem) -> InboxTreeFolder:
        result: dict[str, object] = {
            "type": item.type,
            "full_path": item.full_path,
            "hash": item.hash,
            "is_album": item.is_album,
        }

        if isinstance(item, Folder):
            # Only append status and minimal if the folder is an album
            if item.is_album:
                minimal_item = minimal.get(item.hash)
                status_update = status_by_hash.get(item.hash)
                result["minimal"] = (
                    dict(minimal_item) if minimal_item is not None else None
                )
                result["status"] = (
                    status_update.status
                    if status_update is not None
                    else FolderStatus.UNKNOWN
                )
                result["exc"] = (
                    status_update.exc if status_update is not None else None
                )
            result["children"] = [
                serialize_tree_item(child) for child in item.children
            ]

        return cast(InboxTreeFolder, result)

    return jsonify([serialize_tree_item(folder) for folder in folders])


@inbox_bp.route("/folder", methods=["POST"])
async def get_folder():
    """Get the folder structure for a given inbox folder.

    Parameters
    ----------
    folder_path : str
        The path to the folder to get the structure for.
    """
    params = await request.get_json()

    folder_hashes, folder_paths = pop_folder_params(params, allow_mismatch=True)

    if len(folder_paths) != 1 and len(folder_hashes) != 1:
        raise InvalidUsageException(
            f"Only one folder path or hash must be provided. Got: {folder_hashes=}, {folder_paths=}"
        )

    folder_path = folder_paths[0] if len(folder_paths) == 1 else None
    folder_hash = folder_hashes[0] if len(folder_hashes) == 1 else None

    # Only absolute paths are allowed
    if folder_path is not None and not Path(folder_path).is_absolute():
        raise InvalidUsageException(
            f"Only absolute paths are allowed. Got: {folder_path=}"
        )

    folder: Folder | Archive | None = None

    # If a hash is provided, try to get the folder from the inbox cache first
    # If this fails, try to get from db
    if folder_hash is not None:
        inbox_folders = get_inbox_folders()
        for inbox_folder in inbox_folders:
            for f in path_to_folder(inbox_folder, subdirs=False).walk():
                if isinstance(f, (Folder, Archive)) and f.hash == folder_hash:
                    folder = f
                    break

            if folder is not None:
                break

        if folder is None:
            with db_session_factory() as session:
                stmt = select(FolderInDb).where(FolderInDb.id == folder_hash)
                f_in_db = session.execute(stmt).scalars().first()
                if f_in_db is not None:
                    folder = f_in_db.to_live_folder()

    # If a path is provided, and we did not find the folder via hash,
    # try to create folder or get it from db
    if folder is None and folder_path is not None:
        try:
            folder_path = Path(folder_path).resolve()
            # If the path is absolute, we can create the folder directly
            _folder = fs_item_from_path(folder_path, subdirs=False)
            assert isinstance(_folder, (Folder, Archive)), (
                "Path must be a folder or archive"
            )
            folder = _folder
        except FileNotFoundError:
            # Try to lookup in db, maybe folder doesn't exist anymore?
            with db_session_factory() as session:
                stmt = (
                    select(FolderInDb)
                    .where(FolderInDb.full_path == str(folder_path))
                    .order_by(FolderInDb.updated_at.desc())
                )

                f_in_db = session.execute(stmt).scalars().first()
                if f_in_db is not None:
                    folder = f_in_db.to_live_folder()

    # If we still don't have a folder, raise an error
    if folder is None:
        raise InvalidUsageException(
            f"Could not find folder with {folder_hash=} or path {folder_path=}.",
            status_code=404,
        )

    return jsonify(folder)


@inbox_bp.route("/tree/refresh", methods=["POST"])
async def refresh_cache():
    """Clear the cache for the path_to_dict function."""
    await trigger_clear_cache()
    return "Ok"


@inbox_bp.route("/delete", methods=["DELETE"])
async def delete():
    """Remove all folders provided in the request body via folder_paths.

    Parameters
    ----------
    folder_paths : list[str]
        The paths to the folders to remove.
    folder_hashes : list[str]
        The hashes of the folders to remove.
    """
    params = await request.get_json()
    folder_hashes, folder_paths = pop_folder_params(params, allow_empty=False)
    log.debug(f"Deleting folders: {folder_paths=}, {folder_hashes=}")

    # Deduplicate based on both path and hash (order-preserving)
    seen: set[tuple[Path, str]] = set()
    folder_paths_and_hashes = []
    for path, hash in zip(folder_paths, folder_hashes):
        if (path, hash) not in seen:
            seen.add((path, hash))
            folder_paths_and_hashes.append((path, hash))

    # Sort by length of the path (longest first, to delete the most nested folders first)
    folder_paths_and_hashes = sorted(
        folder_paths_and_hashes, key=lambda x: len(x[0].parts), reverse=True
    )

    # Check that all hashes are (still) valid
    cache: Cache[str, bytes] = Cache(maxsize=2**16)
    folders: list[Folder | Archive] = []
    for folder_path, folder_hash in folder_paths_and_hashes:
        f = fs_item_from_path(folder_path, cache=cache)
        if not isinstance(f, (Folder, Archive)):
            log.debug(f"Skipping deletion of {folder_path}, not a folder or archive")
            continue
        folders.append(f)
        if f.hash != folder_hash:
            raise InvalidUsageException(
                "Folder hash does not match the current folder hash! Please refresh your hashes before deleting!",
            )

    # Delete the folders
    for f in folders:
        if isinstance(f, Archive):
            os.remove(f.full_path)
        elif isinstance(f, Folder):
            shutil.rmtree(f.full_path)
        else:
            raise InvalidUsageException(
                f"Cannot delete object of type {type(f)} at {f.full_path}"
            )

    # Clear the cache for the deleted folders
    await trigger_clear_cache()

    return jsonify(
        {
            "deleted": [f.full_path for f in folders],
            "hashes": [f.hash for f in folders],
        }
    )


# ------------------------------------------------------------------------------------ #
#                                         Stats                                        #
# ------------------------------------------------------------------------------------ #


class InboxStats(TypedDict):
    name: str
    path: str

    # Number of albums tagged via GUI
    tagged_via_gui: int
    # Number of albums imported via GUI
    imported_via_gui: int

    # Bytes of the inbox folder
    size: int
    nFiles: int

    last_created: datetime | None


@inbox_bp.route("/stats", methods=["GET"])
async def stats_for_all():
    """Get the stats for all inbox folders.

    Parameters
    ----------
    folder : str (optional)
        The folder to compute stats for. If not provided, all inbox folders are used.
    """
    folders = get_inbox_folders()
    stats = [compute_stats(f) for f in folders]
    return jsonify(stats)


def compute_stats(folder: str):
    """Compute the stats for the inbox folder.

    # Path parameters
    folder: str (optional) - The folder to compute stats for

    """
    inbox = get_inbox_for_path(folder)
    if inbox is None:
        raise NotFoundException(f"Inbox folder `{folder} not found.")

    p = Path(folder)

    # Compute session stats
    with db_session_factory() as session:
        stmt = (
            select(func.count())
            .select_from(SessionStateInDb)
            .join(FolderInDb)
            .where(FolderInDb.full_path.like(f"{folder}%"))
            .where(SessionStateInDb.progress >= Progress.PREVIEW_COMPLETED)
        )
        n_tagged = session.execute(stmt).scalar_one()

        stmt = (
            select(func.count())
            .select_from(SessionStateInDb)
            .join(FolderInDb)
            .where(FolderInDb.full_path.like(f"{folder}%"))
            .where(SessionStateInDb.progress == Progress.IMPORT_COMPLETED)
        )
        n_imported = session.execute(stmt).scalar_one()

        # last created session
        stmt = (
            select(SessionStateInDb.created_at)
            .join(FolderInDb)
            .where(FolderInDb.full_path.like(f"{folder}%"))
            .order_by(SessionStateInDb.created_at.desc())
            .limit(1)
        )
        last_created = session.execute(stmt).scalars().first()

    ret_map: InboxStats = {
        "name": inbox.name,
        "path": inbox.path,
        "nFiles": dir_files(p),
        "size": dir_size(p),
        "tagged_via_gui": n_tagged,
        "imported_via_gui": n_imported,
        "last_created": last_created,
    }

    return ret_map
