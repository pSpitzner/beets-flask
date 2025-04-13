import os
import shutil
from pathlib import Path
from typing import TypedDict

from quart import Blueprint, jsonify

from beets_flask.database import db_session_factory
from beets_flask.disk import Folder, dir_files, dir_size, log, path_to_folder
from beets_flask.inbox import (
    get_inbox_folders,
    get_inbox_for_path,
)
from beets_flask.server.utility import get_folder_params
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

    TODO: Add parameter to delete only empty folders.
    TODO: Add parameter to delete only folders which have been imported.
    """

    folder_hashes, folder_paths, params = await get_folder_params()
    for fp in folder_paths:
        shutil.rmtree(fp)
    return jsonify("Ok")


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
