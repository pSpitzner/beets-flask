from datetime import datetime
from typing import Optional, TypedDict
from flask import Blueprint, request, jsonify
from beets_flask.db_engine import db_session
from beets_flask.disk import (
    get_inbox_folders,
    path_to_dict,
    get_inbox_for_path,
    retag_inbox,
)
from beets_flask.utility import AUDIO_EXTENSIONS
from beets_flask.models import Tag

import os

from pathlib import Path

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
        path_to_dict.cache.clear()  # type: ignore
    inboxes = []
    for path in get_inbox_folders():
        inboxes.append(path_to_dict(path))

    return inboxes


@inbox_bp.route("/path/<path:folder>", methods=["DELETE"])
def delete_inbox(folder):
    """
    Delete the specified inbox folder and all its contents.

    !This is not reversible
    """

    inbox = get_inbox_for_path(folder)
    if inbox is None:
        return {"error": "Inbox not found", "status": 404}

    return {"ok": True}


@inbox_bp.route("/path/<path:folder>", methods=["GET"])
def get_folder(folder):
    """
    Get all subfolders from of the specified one
    """
    return path_to_dict("/" + folder, relative_to="/" + folder)


@inbox_bp.route("/autotag", methods=["POST"])
def autotag_inbox_folder():
    """
    Trigger a tagging process on all subfolders of a given inbox folder.

    By default, tags folders that were not tagged yet.
    To retag existing folders use `with_status` to provide a list of statuses
    that should be renewed.
    """
    data = request.get_json()
    kind = data.get("kind")
    folder = data.get("folder")
    with_status = data.get("with_status", ["notag"])

    if not folder.startswith("/"):
        folder = "/" + folder

    retag_inbox(inbox_dir=folder, kind=kind, with_status=with_status)

    return jsonify(
        {
            "message": f"enqueued retagging {folder}",
        }
    )


# ------------------------------------------------------------------------------------ #
#                                         Stats                                        #
# ------------------------------------------------------------------------------------ #


class Stats(TypedDict):
    nFiles: int
    size: int
    inboxName: str
    inboxPath: str

    # UTC Timestamp (none if nothing tagged)
    lastTagged: Optional[int]

    # Number of files already tagged
    nTagged: int
    # Size of already tagged files
    sizeTagged: int


@inbox_bp.route("/stats", methods=["GET"])
def stats_for_all():
    """
    Get the stats for all inbox folders
    """
    folders = get_inbox_folders()
    stats = [compute_stats(f) for f in folders]
    return jsonify(stats)


@inbox_bp.route("/stats/<path:folder>", methods=["GET"])
def stats_for_folder(folder: str):
    """
    Get the stats for a specific inbox folder
    """
    if not folder.startswith("/"):
        folder = "/" + folder
    stats = compute_stats(folder)
    return jsonify(stats)


def compute_stats(folder: str):
    """
    Compute the stats for the inbox folder

    # Path parameters
    folder: str (optional) - The folder to compute stats for

    """
    inbox = get_inbox_for_path(folder)
    if inbox is None:
        return {"error": "Inbox not found", "status": 404}

    ret_map: Stats = {
        "nFiles": 0,
        "size": 0,
        "nTagged": 0,
        "sizeTagged": 0,
        "inboxName": inbox["name"],
        "inboxPath": inbox["path"],
        "lastTagged": None,
    }

    # Get filesize
    with db_session() as session:
        for current_dir, _, files in os.walk(Path(folder)):
            for file in files:
                path = Path(os.path.join(current_dir, file))
                parse_file(path, ret_map, session)

    return ret_map


def parse_file(path: Path, map: Stats, session=None):
    """
    Parse a file and return the stats dict

    Parameters:
    - path (Path): The path to the file
    - map (Stats): The current stats dict
    - session (Session): Optional a session for tagged lookup
    """
    if path.suffix.lower() not in AUDIO_EXTENSIONS:
        return

    map["nFiles"] += 1
    map["size"] += path.stat().st_size

    # check if already tagged

    if session:
        tag = Tag.get_by(Tag.album_folder == f"{path.parent}", session=session)
        if tag is not None:
            map["nTagged"] += 1
            map["sizeTagged"] += path.stat().st_size
            map["lastTagged"] = int(
                max(tag.created_at.timestamp() * 1000, map["lastTagged"])
                if map["lastTagged"] is not None
                else tag.created_at.timestamp() * 1000
            )

    return map
