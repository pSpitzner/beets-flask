from flask import Blueprint, request, jsonify
from beets_flask.disk import get_inbox_dict, path_to_dict
from beets_flask.logger import log

inbox_bp = Blueprint("inbox", __name__, url_prefix="/inbox")


@inbox_bp.route("/", methods=["GET"])
def get_all():
    """
    Get nested dict structures for the inbox folder

    # Request args
    use_cache: bool = True
    """

    use_cache = bool(request.args.get("use_cache", True))
    inbox = get_inbox_dict(use_cache=use_cache)
    log.debug(f"returning inbox {inbox=}")

    return inbox


@inbox_bp.route("/path/<path:folder>", methods=["GET"])
def get_folder(folder):
    """
    Get all subfolders from of the specified one
    """
    return path_to_dict("/" + folder, relative_to="/" + folder)
