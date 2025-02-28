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
        folders.append(path_to_dict(folder, subdirs=False))

    return folders


async def get_tree_with_tasks():
    """Get all paths inside the inbox folder(s) and their candidates."""

    inbox_folders = get_inbox_folders()

    # Create dict representation of inbox folders
    folders: list[Folder] = []
    for folder in inbox_folders:
        folders.append(path_to_dict(folder, subdirs=False))

    for inbox in folders:
        for folder in iter_folder(inbox):
            # TODO: Get tasks from database
            # 1. By hash
            # 2. By folder
            folder["hash"]


def iter_folder(folder: Folder):
    yield folder
    for f in folder["children"]:
        if f["type"] == "directory":
            yield from iter_folder(f)
