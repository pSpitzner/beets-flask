import shutil
from pathlib import Path
from typing import TypedDict

from cachetools import Cache
from quart import Blueprint, jsonify, request
from sqlalchemy import select

from beets_flask.database import db_session_factory
from beets_flask.database.models.states import FolderInDb
from beets_flask.disk import Folder, dir_files, dir_size, log, path_to_folder
from beets_flask.inbox import (
    get_inbox_folders,
    get_inbox_for_path,
)
from beets_flask.server.exceptions import InvalidUsageException
from beets_flask.server.utility import pop_folder_params
from beets_flask.utility import AUDIO_EXTENSIONS

inbox_bp = Blueprint("inbox", __name__, url_prefix="/inbox")


@inbox_bp.route("/tree", methods=["GET"])
async def get_tree():
    """Get all paths inside the inbox folder(s)."""

    inbox_folders = get_inbox_folders()

    # Create dict representation of inbox folders
    folders: list[Folder] = []
    for folder in inbox_folders:
        folders.append(path_to_folder(folder, subdirs=False))

    return jsonify(folders)


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

    folder: Folder | None = None

    # If a hash is provided, try to get the folder from the inbox cache first
    # If this fails, try to get from db
    if folder_hash is not None:
        inbox_folders = get_inbox_folders()
        for inbox_folder in inbox_folders:
            for f in path_to_folder(inbox_folder, subdirs=False).walk():
                if isinstance(f, Folder) and f.hash == folder_hash:
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
            folder = Folder.from_path(folder_path, subdirs=False)
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
    path_to_folder.cache.clear()  # type: ignore
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

    folder_paths = [Path(folder) for folder in folder_paths]

    # Deduplicate based on both path and hash (order-preserving)
    seen = set()
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
    folders: list[Folder] = []
    for folder_path, folder_hash in folder_paths_and_hashes:
        f = Folder.from_path(folder_path, cache=cache)
        folders.append(f)
        if f.hash != folder_hash:
            raise InvalidUsageException(
                "Folder hash does not match the current folder hash! Please refresh your hashes before deleting!",
            )

    # Delete the folders
    for f in folders:
        shutil.rmtree(f.full_path)

    # Clear the cache for the deleted folders
    path_to_folder.cache.clear()  # type: ignore

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
        return {"error": "Inbox not found", "status": 404}

    p = Path(folder)
    log.error(f"Computing stats for {folder}, {p}")

    ret_map: InboxStats = {
        "name": inbox["name"],
        "path": inbox["path"],
        "nFiles": dir_files(p),
        "size": dir_size(p),
        "tagged_via_gui": -1,  # TODO
        "imported_via_gui": -1,
    }

    return ret_map
