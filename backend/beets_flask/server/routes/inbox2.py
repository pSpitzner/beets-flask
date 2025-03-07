from quart import Blueprint, jsonify

from beets_flask.disk import Folder, path_to_folder
from beets_flask.inbox import get_inbox_folders

inbox_bp2 = Blueprint("inbox2", __name__, url_prefix="/inbox2")


def is_it_true(value):
    return value.lower() == "true"


@inbox_bp2.route("/tree", methods=["GET"])
async def get_tree():
    """Get all paths inside the inbox folder(s)."""

    inbox_folders = get_inbox_folders()

    # Create dict representation of inbox folders
    folders: list[Folder] = []
    for folder in inbox_folders:
        folders.append(path_to_folder(folder, subdirs=False))

    return jsonify(folders)


@inbox_bp2.route("/tree/refresh", methods=["POST"])
async def refresh_cache():
    """Clear the cache for the path_to_dict function."""
    path_to_folder.cache.clear()  # type: ignore
    return "Ok"
