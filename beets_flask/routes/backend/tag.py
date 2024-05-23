""" Task related API endpoints

Tasks are beet tasks that are created by the user or automatically by the system.
"""

from flask import Blueprint
from sqlalchemy import select

from ...models.tag_group import TagGroup
from ...models import Tag
from ...db_engine import db_session

tag_bp = Blueprint("tag", __name__, url_prefix="/tag")


@tag_bp.route("/", methods=["GET"])
def get_all():
    """Get all tags"""

    stmt = select(Tag).order_by(Tag.created_at.desc())
    tags = db_session().execute(stmt).scalars().all()
    return [tag.to_dict() for tag in tags]


@tag_bp.route("/<tag_id>", methods=["GET"])
def get_tag(tag_id):
    """Get a task by its id"""

    tag = Tag.get_by(Tag.id == tag_id)
    return tag.to_dict()


@tag_bp.route("/<tag_id>", methods=["DELETE"])
def delete_tag(tag_id):
    """Delete a tag by its id"""

    tag = Tag.get_by(Tag.id == tag_id)
    db_session().delete(tag)
    db_session().commit()

    return {"message": "Tag deleted"}


@tag_bp.route("/add", methods=["GET"])
def add_tag():
    """Test adding a tag"""
    tag = Tag(album_folder="test", kind="album")
    db_session().add(tag)
    db_session().commit()

    return tag.to_dict()
