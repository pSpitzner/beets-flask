from flask import Blueprint, request, jsonify
from beets_flask.disk import get_inbox_dict, path_to_dict
from beets_flask.logger import log
from beets_flask.utility import AUDIO_EXTENSIONS

inbox_bp = Blueprint("inbox", __name__, url_prefix="/inbox")


@inbox_bp.route("/", methods=["GET"])
def get_all():
    """
    Get nested dict structures for the inbox folder

    # Request args
    use_cache: bool = True
    """

    use_cache = bool(request.args.get("use_cache", False))
    inbox = get_inbox_dict(use_cache=use_cache)
    # log.debug(f"returning inbox {inbox=}")

    return inbox


@inbox_bp.route("/path/<path:folder>", methods=["GET"])
def get_folder(folder):
    """
    Get all subfolders from of the specified one
    """
    return path_to_dict("/" + folder, relative_to="/" + folder)


import os
from pathlib import Path

inbox_dir = os.environ.get("INBOX", "/music/inbox")


@inbox_bp.route("/stats", methods=["GET"])
@inbox_bp.route("/stats/<path:folder>", methods=["GET"])
def compute_stats(folder=None):
    """
    Compute the stats for the inbox folder

    # Path parameters
    folder: str (optional) - The folder to compute stats for

    """
    if not folder:
        folder = inbox_dir
    else:
        folder = os.path.join(inbox_dir, folder)

    folder = Path(folder)

    count = 0
    size_bytes = 0

    # TODO: add all audio files
    with os.scandir(folder) as it:
        for entry in it:
            if entry.is_file() and entry.name.endswith(AUDIO_EXTENSIONS):
                count += 1
                size_bytes += entry.stat().st_size

    return jsonify({"nFiles": count, "size": size_bytes})
