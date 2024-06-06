"""
Tag related API endpoints

Tags are our database represenation of a look-up or import performed by beets. can be created by the user or automatically by the system.
"""

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import select

from beets_flask.models import Tag, TagGroup
from beets_flask.db_engine import db_session, with_db_session, Session
from beets_flask.routes.backend.errors import InvalidUsage
from beets_flask.utility import log
import beets_flask.invoker as invoker

tag_bp = Blueprint("tag", __name__, url_prefix="/tag")


@tag_bp.route("/", methods=["GET"])
def get_all():
    """Get all tags"""
    with db_session() as session:
        stmt = select(Tag).order_by(Tag.created_at.desc())
        tags = session.execute(stmt).scalars().all()
        return [tag.to_dict() for tag in tags]


@tag_bp.route("/id/<tag_id>", methods=["GET"])
def get_tag_by_id(tag_id: str):
    """Get a task by its id"""
    with db_session() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        return tag.to_dict() if tag else {}


@tag_bp.route("/id/<tag_id>", methods=["DELETE"])
def delete_tag_by_id(tag_id: str):
    """Delete a tag by its id"""
    with db_session() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        session.delete(tag)
        session.commit()
        return {"message": "Tag deleted"}


@tag_bp.route("/path/<path:folder>", methods=["GET"])
def get_tag_by_folder_path(folder: str):
    """Get a tag by itsits folder path on disk"""
    with db_session() as session:
        tag = Tag.get_by(Tag.album_folder == "/" + folder, session=session)
        return tag.to_dict() if tag else {}


@tag_bp.route("/path/<path:folder>", methods=["DELETE"])
def delete_tag_by_folder_path(folder: str):
    """Delete a tag by its folder path on disk"""
    with db_session() as session:
        tag = Tag.get_by(Tag.album_folder == "/" + folder, session=session)
        session.delete(tag)
        session.commit()
        return {"message": "Tag deleted"}


@tag_bp.route("/add", methods=["POST"])
def add_tag():
    """
    Add a tag. You need to specify the folder of the album,
    and it has to be a valid album folder.
    """
    with db_session() as session:
        data = request.get_json()
        folder = data.get("folder")
        kind = data.get("kind")

        if not folder or not kind:
            raise InvalidUsage("You need to specify the folder and kind of the tag")

        tag = Tag.get_by(Tag.album_folder == folder, session=session) or Tag(
            album_folder=folder, kind=kind
        )
        session.merge(tag)

        tag.kind = kind
        session.commit()

        invoker.enqueue(tag.id, session=session)

        return jsonify(tag.to_dict())
