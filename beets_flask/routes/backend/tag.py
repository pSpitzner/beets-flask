""" Task related API endpoints

Tasks are beet tasks that are created by the user or automatically by the system.
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import select

from beets_flask.models import Tag, TagGroup
from beets_flask.db_engine import db_session
from beets_flask.routes.backend.errors import InvalidUsage

tag_bp = Blueprint("tag", __name__, url_prefix="/tag")


@tag_bp.route("/", methods=["GET"])
def get_all():
    """Get all tags"""

    stmt = select(Tag).order_by(Tag.created_at.desc())
    tags = db_session().execute(stmt).scalars().all()
    return [tag.to_dict() for tag in tags]


@tag_bp.route("/id/<tag_id>", methods=["GET"])
def get_tag_by_id(tag_id: str):
    """Get a task by its id"""

    tag = Tag.get_by(Tag.id == tag_id)
    return tag.to_dict()


@tag_bp.route("/id/<tag_id>", methods=["DELETE"])
def delete_tag_by_id(tag_id: str):
    """Delete a tag by its id"""

    tag = Tag.get_by(Tag.id == tag_id)
    db_session().delete(tag)
    db_session().commit()

    return {"message": "Tag deleted"}


@tag_bp.route("/folder/<folder>", methods=["GET"])
def get_tag_by_folder(folder: str):
    """Get a tag by its folder"""

    tag = Tag.get_by(Tag.album_folder == "/" + folder)
    return tag.to_dict()


@tag_bp.route("/folder/<folder>", methods=["DELETE"])
def delete_tag_by_folder(folder: str):
    """Delete a tag by its folder"""

    tag = Tag.get_by(Tag.album_folder == "/" + folder)
    db_session().delete(tag)
    db_session().commit()

    return {"message": "Tag deleted"}


@tag_bp.route("/add", methods=["POST"])
def add_tag():
    """
    Add a tag. You need to specify the folder of the album,
    and it has to be a valid album folder.
    """

    data = request.get_json()
    folder = data.get("folder")
    kind = data.get("kind")

    if not folder or not kind:
        raise InvalidUsage("You need to specify the folder and kind of the tag")

    # Get or add the tag
    try:
        tag = Tag.get_by(Tag.album_folder == folder)
    except ValueError:
        tag = Tag(album_folder=folder, kind=kind)

    tag.kind = kind
    tag.commit()
    tag.enqueue()

    # now we would also need to submit the job to queue.
    # I am thinking that we should make the enqueuing part
    # of the tag class! then we would just call tag.enqueue()
    # and depending on `kind` push it into the right queue.

    return jsonify(tag.to_dict(), 200)
