from quart import Blueprint

from beets_flask.disk import Folder, path_to_dict
from beets_flask.inbox import get_inbox_folders

inbox_bp2 = Blueprint("inbox2", __name__, url_prefix="/inbox2")


@inbox_bp2.route("/tree", methods=["GET"])
async def get_tree():
    """Get all paths inside the inbox folder(s)."""

    inbox_folders = get_inbox_folders()

    # Create dict representation of inbox folders
    folders: list[Folder] = []
    for folder in inbox_folders:
        folders.append(path_to_dict(folder))

    return folders
