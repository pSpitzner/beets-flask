"""Tag related API endpoints.

Tags are our database representation of a look-up or import performed by beets. 
Can be created by the user or automatically by the system.
"""

from flask import Blueprint, abort, jsonify, request
from sqlalchemy import select

import beets_flask.invoker as invoker
from beets_flask.config import config
from beets_flask.database import Tag, db_session
from beets_flask.routes.errors import InvalidUsage

tag_bp = Blueprint("tag", __name__, url_prefix="/tag")


@tag_bp.route("/", methods=["GET"])
def get_all():
    """Get all tags."""
    with db_session() as session:
        stmt = select(Tag).order_by(Tag.created_at.desc())
        tags = session.execute(stmt).scalars().all()
        return [tag.to_dict() for tag in tags]


@tag_bp.route("/id/<tag_id>", methods=["GET"])
def get_tag_by_id(tag_id: str):
    """Get a task by its id."""
    with db_session() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        return tag.to_dict() if tag else {}


@tag_bp.route("/id/<tag_id>", methods=["DELETE"])
def delete_tag_by_id(tag_id: str):
    """Delete a tag by its id."""
    with db_session() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        session.delete(tag)
        session.commit()
        return {"message": "Tag deleted"}


@tag_bp.route("/path/<path:folder>", methods=["GET"])
def get_tag_by_folder_path(folder: str):
    """Get a tag by its folder path on disk."""
    with db_session() as session:
        tag = Tag.get_by(Tag.album_folder == "/" + folder, session=session)
        return tag.to_dict() if tag else {}


@tag_bp.route("/path/<path:folder>", methods=["DELETE"])
def delete_tag_by_folder_path(folder: str):
    """Delete a tag by its folder path on disk."""
    with db_session() as session:
        tag = Tag.get_by(Tag.album_folder == "/" + folder, session=session)
        session.delete(tag)
        session.commit()
        return {"message": "Tag deleted"}


@tag_bp.route("/add", methods=["POST"])
def add_tag():
    """Add one or multiple tags.

    You need to specify the folder of the album,
    and it has to be a valid album folder.

    # Params
    - `kind` (str): The kind of the tag
    - `folders` (list): A list of folders to tag
    - OR `folder` (str): Single folder to tag

    """
    with db_session() as session:
        data = request.get_json()
        kind = data.get("kind")
        folder = data.get("folder", None)
        folders = data.get("folders", [])

        if kind == "import" and config["gui"]["library"]["readonly"].get(bool):
            return abort(
                405,
                description={"error": "Library is configured as readonly"},
            )

        if folder is not None and len(folders) > 0:
            raise InvalidUsage("You can't specify both `folder` and `folders`")

        if not (folders or folder) or not kind:
            raise InvalidUsage(
                "You need to specify at least a folder and kind of the tag"
            )

        if len(folders) == 0:
            folders = [folder]

        tags = []
        for folder in folders:
            tag = Tag.get_by(Tag.album_folder == folder, session=session) or Tag(
                album_folder=folder, kind=kind
            )
            session.merge(tag)

            tag.kind = kind
            tags.append(tag)
            session.commit()

            invoker.enqueue(tag.id, session=session)

        return jsonify(
            {
                "message": f"{len(tags)} tags added as kind: {kind}",
                "tags": [tag.to_dict() for tag in tags],
            }
        )
