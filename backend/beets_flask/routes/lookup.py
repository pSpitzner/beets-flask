from datetime import datetime
from typing import Optional, TypedDict
from urllib.parse import unquote
from flask import Blueprint, request, jsonify, abort
from beets_flask.db_engine import db_session
from beets_flask.disk import is_album_folder
from beets_flask.inbox import get_inbox_folders
from beets_flask.models import Tag
from beets_flask.logger import log

import os

from pathlib import Path

from sqlalchemy import select

lookup_bp = Blueprint("lookup", __name__, url_prefix="/lookup")


class SelectionLookup(TypedDict):
    query: str
    tag: dict | None
    is_tagged: bool
    is_inbox: bool
    is_deleted: bool
    is_album_folder: bool
    # may not be up to date (we may have a tag for a deleted folder)


@lookup_bp.route("/<path:folder>", methods=["GET"])
def lookup_folder_type(folder):
    """
    Lookup one folder.
    """
    decoded_folder = unquote(folder)
    log.debug(decoded_folder)

    return jsonify(_folder_type(folder))


@lookup_bp.route("/", methods=["POST"])
def lookup_folder_types():
    """
    This is a helper to allow the frontend to take the right action for a particular selected folder.
    - an (album) folder corresponding to a tag
    - a folder that does not correspond to a tag
    - an inbox (folder)
    - a deleted folder

    # Potential problems:
    - if a folder has the same name as a previously deleted (and tagged) one
    """
    data = request.get_json()
    folders = data.get("folders", [])

    if len(folders == 0):
        return abort(
            401,
            description={"error": "You need to POST `folders`."},
        )

    results = []
    for folder in folders:
        results.append(_folder_type(folder))

    return jsonify(results)


def _folder_type(folder):
    if not folder.startswith("/"):
        folder = "/" + folder

    res = SelectionLookup(
        query=folder,
        tag=None,
        is_tagged=False,
        is_inbox=False,
        is_deleted=False,
        is_album_folder=False,
    )

    with db_session() as session:
        # if we have multiple tags for this folder, only use the first one for now!
        stmt = (
            select(Tag)
            .where(Tag.album_folder == folder)
            .order_by(Tag.updated_at.desc())
        )
        tag = session.execute(stmt).scalars().first()

        if tag is not None:
            res["tag"] = tag.to_dict()
            res["is_tagged"] = True

    if not os.path.exists(folder):
        res["is_deleted"] = True

    if folder in get_inbox_folders():
        res["is_inbox"] = True

    if is_album_folder(folder):
        res["is_album_folder"] = True

    return res
