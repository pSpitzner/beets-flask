from typing import TypedDict, List, Tuple, Any
from flask import Blueprint, request, jsonify
from beets_flask.disk import get_inbox_dict, path_to_dict
from beets_flask.logger import log
from beets_flask.utility import AUDIO_EXTENSIONS
from beets_flask.config import config
import os
from pathlib import Path

inbox_dirs : List[Tuple[str, str]] = config["gui"]["inbox"]["folders"].as_pairs() # type: ignore
inbox_dir = inbox_dirs[0]
inbox_bp = Blueprint("inbox", __name__, url_prefix="/inbox")


@inbox_bp.route("/", methods=["GET"])
def get_all():
    """
    Get nested dict structures for the inbox folder

    # Request args
    use_cache: bool = True
    """

    use_cache = bool(request.args.get("use_cache", False))
    if not use_cache:
        get_inbox_dict.cache.clear() # type: ignore
    inbox = get_inbox_dict()

    return inbox


@inbox_bp.route("/path/<path:folder>", methods=["GET"])
def get_folder(folder):
    """
    Get all subfolders from of the specified one
    """
    return path_to_dict("/" + folder, relative_to="/" + folder)


# ------------------------------------------------------------------------------------ #
#                                         Stats                                        #
# ------------------------------------------------------------------------------------ #

class Stats(TypedDict):
    nFiles: int
    size: int
    inboxName: str
    mountPoint: str
    lastScanned: str

@inbox_bp.route("/stats", methods=["GET"])
@inbox_bp.route("/stats/<path:folder>", methods=["GET"])
def compute_stats(folder=None):
    """
    Compute the stats for the inbox folder

    # Path parameters
    folder: str (optional) - The folder to compute stats for

    """
    if not folder:
        folder = inbox_dir[1]
    else:
        folder = os.path.join(inbox_dir[1], folder)

    folder = Path(folder)

    ret_map: Stats = {
        "nFiles": 0,
        "size": 0,
        "inboxName": inbox_dir[0],
        "mountPoint": str(folder),
        "lastScanned": ""
    }

    # Get filesize
    for current_dir, _, files in os.walk(folder):
        for file in files:
            path = Path(os.path.join(current_dir, file))
            print(path, flush=True)
            parse_file(path, ret_map)

    log.debug(f"returning stats {ret_map=}")

    return jsonify(ret_map)


def parse_file(path: Path, map: Stats):
    """
    Parse a file and return the stats dict

    Parameters:
    - path (Path): The path to the file
    - map (Stats): The current stats dict
    """
    if path.suffix.lower() not in AUDIO_EXTENSIONS:
        return

    map["nFiles"] += 1
    map["size"] += path.stat().st_size

    # TODO: Check if imported and if tagged

    return map
