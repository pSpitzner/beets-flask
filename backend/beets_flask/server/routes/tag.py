"""Tag related API endpoints.

Tags are our database representation of a look-up or import performed by beets.
Can be created by the user or automatically by the system.
"""

from typing import TYPE_CHECKING, List

from quart import Blueprint, abort, jsonify, request
from sqlalchemy import select

from beets_flask import invoker
from beets_flask.config import get_config
from beets_flask.database import Tag, db_session_factory
from beets_flask.database.models.states import FolderInDb
from beets_flask.disk import Folder
from beets_flask.logger import log

from .errors import InvalidUsage, get_query_param

if TYPE_CHECKING:
    from rq.job import Job

tag_bp = Blueprint("tag", __name__, url_prefix="/tag")


@tag_bp.route("/", methods=["GET"])
async def get_all():
    """Get all tags."""
    with db_session_factory() as session:
        stmt = select(Tag).order_by(Tag.created_at.desc())
        tags = session.execute(stmt).scalars().all()
        return [tag.to_dict() for tag in tags]


@tag_bp.route("/id/<tag_id>", methods=["GET"])
async def get_tag_by_id(tag_id: str):
    """Get a task by its id."""
    with db_session_factory() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        return tag.to_dict() if tag else {}


@tag_bp.route("/id/<tag_id>", methods=["DELETE"])
async def delete_tag_by_id(tag_id: str):
    """Delete a tag by its id."""
    with db_session_factory() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        if not tag:
            return {"message": "Tag not found"}, 404

        session.delete(tag)
        session.commit()
        return {"message": "Tag deleted"}


@tag_bp.route("/path/<path:folder>", methods=["GET"])
async def get_tag_by_folder_path(folder: str):
    """Get a tag by its folder path on disk."""
    with db_session_factory() as session:
        tag = Tag.get_by(Tag.album_folder == "/" + folder, session=session)
        return tag.to_dict() if tag else {}


@tag_bp.route("/path/<path:folder>", methods=["DELETE"])
async def delete_tag_by_folder_path(folder: str):
    """Delete a tag by its folder path on disk."""
    with db_session_factory() as session:
        tag = Tag.get_by(Tag.album_folder == "/" + folder, session=session)
        if not tag:
            return {"message": "Tag not found"}, 404

        session.delete(tag)
        session.commit()
        return {"message": "Tag deleted"}


@tag_bp.route("/add", methods=["POST"])
async def add_tag():
    """Add one or multiple tags.

    You need to specify the folder of the album,
    and it has to be a valid album folder.

    # Params
    - `kind` (str): The kind of the tag
    - `folders` (list): A list of folders to tag
    - OR `folder` (str): Single folder to tag

    """
    data = await request.get_json()
    kind = data.get("kind", None)
    # 24-10-21 PS@SM: lets talk about how we prefer the endpoint!
    folder = data.get("folder", None)
    folders = data.get("folders", None)

    if not ((folder and kind) or (folders and kind)):
        raise InvalidUsage("You need to specify at least a folder and kind of the tag")

    # Check if folder is array
    if not folders:
        folders = [folder]

    if kind == "import" and get_config()["gui"]["library"]["readonly"].get(bool):
        return abort(
            405,
            description={"error": "Library is configured as readonly"},
        )

    tags: list[dict] = []
    with db_session_factory() as session:
        for f in folders:
            tag = Tag.get_by(Tag.album_folder == f, session=session)
            if tag is not None:
                tag.kind = kind
            else:
                tag = Tag(album_folder=f, kind=kind)
            session.merge(tag)
            session.commit()
            invoker.enqueue(tag.id, session=session)
            tags.append(tag.to_dict())

    return jsonify(
        {
            "message": f"{len(tags)} tags added as kind: {kind}",
            "tags": tags,
        }
    )


@tag_bp.route("/add", methods=["POST"])
async def add_tag_new():
    """Add one or multiple tags.

    You need to specify the folder of the album,
    and it has to be a valid album folder.

    # Params
    - `kind` (str): The kind of the tag

    """
    params = await request.get_json()

    kind = get_query_param(params, "kind", str)

    # TODO: ensure list of strings.
    folder_hashes = get_query_param(params, "folder_hashes", list)
    folder_paths = get_query_param(params, "folder_paths", list)

    if kind == "import" and get_config()["gui"]["library"]["readonly"].get(bool):
        return abort(
            405,
            description={"error": "Library is configured as readonly"},
        )

    jobs: List[Job] = []

    with db_session_factory() as session:
        for hash, path in zip(folder_hashes, folder_paths):
            jobs.append(invoker.enqueue(hash, path, kind, session=session))

    return jsonify(
        {
            "message": f"{len(jobs)} added as kind: {kind}",
            "jobs": [j.get_meta() for j in jobs],
        }
    )
