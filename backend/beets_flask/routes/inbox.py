from datetime import datetime
import shutil
from typing import Optional, TypedDict
from flask import Blueprint, request, jsonify, abort
from beets_flask.db_engine import db_session
from beets_flask.disk import path_to_dict
from beets_flask.inbox import get_inbox_folders, get_inbox_for_path, retag_inbox
from beets_flask.utility import AUDIO_EXTENSIONS
from beets_flask.models import Tag
from beets_flask.logger import log

import os

from pathlib import Path
from beets_flask.disk import is_album_folder
from sqlalchemy import select

inbox_bp = Blueprint("inbox", __name__, url_prefix="/inbox")


@inbox_bp.route("/flatPaths", methods=["POST"])
def get_tree():
    """
    Get all flat paths for the inbox folder

    # Request args
    files: bool = False
    depth: int = 2
    """
    show_files = bool(request.args.get("files", False))
    depth = int(request.args.get("depth", -1))

    folders = get_inbox_folders()

    paths = []
    for folder in folders:
        for root, dirnames, filenames in os.walk(folder):
            if depth == -1 or root[len(folder) :].count(os.sep) < depth:
                for dirname in dirnames:
                    if is_album_folder(os.path.join(root, dirname)):
                        paths.append(os.path.join(root, dirname))
                if show_files:
                    for filename in filenames:
                        paths.append(os.path.join(root, filename))

    return jsonify(paths)


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


@inbox_bp.route("/path/<path:folder>", methods=["GET"])
def get_folder(folder):
    """
    Get all subfolders from of the specified one
    """
    use_cache = bool(request.args.get("use_cache", False))
    if not use_cache:
        path_to_dict.cache.clear()  # type: ignore
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
    with_status = data.get("with_status", ["untagged"])

    if not folder.startswith("/"):
        folder = "/" + folder

    log.info(f"Triggered autotag for {folder=} {with_status=} with {kind=}")
    retag_inbox(inbox_dir=folder, kind=kind, with_status=with_status)

    return jsonify(
        {
            "message": f"enqueued retagging {folder}",
        }
    )


@inbox_bp.route("/path", methods=["DELETE"])
def delete_folders():
    data = request.get_json()
    with_status = data.get("with_status", [])
    folders = data.get("folders", [])

    if len(folders) == 0:
        return abort(
            401,
            description={"error": "You need to specify the `folders` to delete."},
        )

    for f in folders:
        _delete_folder(f, with_status)

    return {"ok": True}


@inbox_bp.route("/path/<path:folder>", methods=["DELETE"])
def delete_inbox(folder):
    """
    Delete the specified inbox folder and all its contents.

    !This is not reversible
    """

    data = request.get_json()
    with_status = data.get("with_status", [])

    try:
        _delete_folder(folder, with_status)
    except Exception as e:
        return jsonify({"error": str(e), "status": 500}), 500

    return {"ok": True}


def _delete_folder(folder, with_status=[]):
    """Helper to delete a folder from a configured inbox. If `with_status` is given,
    only album_folders that correspond to tags of the given statuses are deleted (and
    any parent folders, if the folder requested for deletion was the only child)
    """
    if not folder.startswith("/"):
        folder = "/" + folder

    inbox = get_inbox_for_path(folder)
    log.info(f"Deleting from {folder=} in {inbox=} {with_status=}")

    if inbox is None:
        raise ValueError("Specified folder is not within a configured inbox")

    if len(with_status) == 0:
        _delete_folder_and_parents_until(folder, inbox["path"])
    else:
        with db_session() as session:
            stmt = select(Tag.album_folder).where(
                Tag.status.in_(with_status) & Tag.album_folder.startswith(folder)
            )
            album_folders = [row[0] for row in session.execute(stmt).all()]
            for i in album_folders:
                _delete_folder_and_parents_until(i, stop_before=inbox["path"])


def _delete_folder_and_parents_until(delete_path: str, stop_before: str):
    """
    Delete the folder and its parent folders up until (but excluding) the stop_before folder. Only traverses up the hierarchy if the child-folder is the only content. Dotfiles are ignored and do not prevent deletion.
    """

    if delete_path == stop_before:
        log.debug(f"Skipping deletion of {delete_path} (its a configured inbox)")
        return
    if not os.path.exists(delete_path):
        log.debug(f"Skipping deletion of {delete_path} (folder does not exist anymore)")
        return

    def find_highest_deletable_folder(path, stop_path):
        current = path
        while current.startswith(stop_path):
            parent = os.path.dirname(current)
            items = [i for i in os.listdir(parent) if not i.startswith(".")]
            if len(items) == 1 and parent != stop_path:
                current = parent
            else:
                break
        return current

    highest_deletable_path = find_highest_deletable_folder(delete_path, stop_before)

    log.debug(f"Deleting {highest_deletable_path}")
    shutil.rmtree(highest_deletable_path)


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
