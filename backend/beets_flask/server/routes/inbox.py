import os
import shutil
from pathlib import Path
from typing import TypedDict

from cachetools import Cache
from quart import Blueprint, jsonify, request

from beets_flask.database import db_session_factory
from beets_flask.disk import Folder, dir_files, dir_size, log, path_to_folder
from beets_flask.inbox import (
    get_inbox_folders,
    get_inbox_for_path,
)
from beets_flask.server.exceptions import InvalidUsageException
from beets_flask.server.utility import pop_folder_params
from beets_flask.utility import AUDIO_EXTENSIONS

inbox_bp = Blueprint("inbox", __name__, url_prefix="/inbox")


def is_it_true(value):
    return value.lower() == "true"


@inbox_bp.route("/tree", methods=["GET"])
async def get_tree():
    """Get all paths inside the inbox folder(s)."""

    inbox_folders = get_inbox_folders()

    # Create dict representation of inbox folders
    folders: list[Folder] = []
    for folder in inbox_folders:
        folders.append(path_to_folder(folder, subdirs=False))

    return jsonify(folders)


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
