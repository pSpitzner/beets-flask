"""
TagGroup related API endpoints

TagGroups are just a way to group tags together. A typical use case would be a playlist that has some indvidual tracks from various albums (but all full albums should be imported)
"""

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import select

from beets_flask.models import Tag, TagGroup
from beets_flask.db_engine import db_session, with_db_session, Session
from beets_flask.routes.backend.errors import InvalidUsage
from beets_flask.utility import log

group_bp = Blueprint("tagGroup", __name__, url_prefix="/tagGroup")

@group_bp.route("/", methods=["GET"])
def get_all():
    """Get all tag Groups"""
    with db_session() as session:
        # for now, group ids are just their name
        stmt = select(TagGroup).order_by(TagGroup.id)
        groups = session.execute(stmt).scalars().all()
        return [g.to_dict() for g in groups]

@group_bp.route("/id/<path:group_id>", methods=["GET"])
def get_tag_by_id(group_id: str):
    """Get a group by its id (name)"""
    with db_session() as session:
        g = TagGroup.get_by(TagGroup.id == group_id, session=session)
        if g is None:
            raise InvalidUsage(f"Group {group_id} not found")
        return g.to_dict()
