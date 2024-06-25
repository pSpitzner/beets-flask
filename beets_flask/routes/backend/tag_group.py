"""
TagGroup related API endpoints

TagGroups are just a way to group tags together. A typical use case would be a playlist that has some indvidual tracks from various albums (but all full albums should be imported)

We might just merge this into tag.py blueprint?
"""

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import select
from datetime import datetime, timedelta

from beets_flask.disk import path_to_dict, get_inbox_folders
from beets_flask.models import Tag, TagGroup
from beets_flask.db_engine import db_session, with_db_session, Session
from beets_flask.routes.backend.errors import InvalidUsage
from beets_flask.utility import log
from beets_flask.config import config

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
    """
    Get a group by its id (name). There are a few pre-defined groups:
    - recent: the most recent tags
    - archive: tags that are tagged as archived
    - inbox: tags for folders still in the inbox
    """

    group_id = group_id.rstrip("/")

    if group_id == "recent":
        return TagGroup.as_dict_from_list(
            id="recent",
            tag_ids=get_recent_tags(),
        )
    elif group_id == "archive":
        return TagGroup.as_dict_from_list(
            id="archive",
            tag_ids=get_archived_tags(),
        )
    elif group_id == "inbox":
        return TagGroup.as_dict_from_list(
            id="inbox",
            tag_ids=get_inbox_tags(),
        )

    with db_session() as session:
        g = TagGroup.get_by(TagGroup.id == group_id, session=session)
        if g is None:
            raise InvalidUsage(f"Group {group_id} not found")
        return g.to_dict()


# ------------------------------------------------------------------------------------ #
#                              Pre-defined special groups                              #
# ------------------------------------------------------------------------------------ #


def get_recent_tags() -> list[str]:
    """Get the most recent tags. Number of days can be set in the config file."""

    recent_days: int = config["tags"]["recent_days"].as_number()  # type: ignore

    with db_session() as session:
        stmt = select(Tag).where(
            Tag.updated_at > (datetime.now() - timedelta(days=recent_days))
        )
        tags = session.execute(stmt).scalars().all()
        return [tag.id for tag in tags]


def get_archived_tags() -> list[str]:
    """Get all tags that are tagged as archived"""

    with db_session() as session:
        stmt = select(Tag).where(Tag.archived == True)
        tags = session.execute(stmt).scalars().all()
        return [tag.id for tag in tags]


def get_inbox_tags() -> list[str]:
    """Get all tags that correspond to folders that are still in the inbox"""

    def get_album_folders(d):
        if d["type"] == "directory":
            if d["is_album"]:
                yield d["full_path"]
            for k, v in d["children"].items():
                yield from get_album_folders(v)

    # should we reset the cache here?
    # path_to_dict.cache.clear()  # type: ignore
    inboxes = [path_to_dict(f) for f in get_inbox_folders()]

    album_folders = []
    for inbox in inboxes:
        album_folders.extend(get_album_folders(inbox))

    with db_session() as session:
        stmt = select(Tag).where(Tag.album_folder.in_(album_folders))
        tags = session.execute(stmt).scalars().all()
        return [tag.id for tag in tags]
