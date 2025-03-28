import base64
from datetime import datetime
from typing import Any, Sequence, TypeVar

from quart import Blueprint, Quart, jsonify, request
from sqlalchemy import select

from beets_flask.database import db_session_factory
from beets_flask.database.models.base import Base
from beets_flask.database.models.states import (
    CandidateStateInDb,
    Folder,
    SessionStateInDb,
    TaskStateInDb,
)
from beets_flask.server.routes.errors import InvalidUsage
from beets_flask.server.routes.tag import with_folders

from .errors import get_query_param

T = TypeVar("T", bound=Base)

__all__ = ["blueprint_for_db_model", "register_state_models"]


def blueprint_for_db_model(model: type[T], url_prefix: str | None = None) -> Blueprint:
    """Return a blueprint for a database model.

    Can be used to automatically generate a some REST API endpoints for a database model.

    Parameters
    ----------
    model : type[Base & Serializable]
        The database model to generate the blueprint for. Has to be define a to_dict method.
    prefix : str, optional
        The prefix for the blueprint, defaults to the lowercase name of the model.

    Returns
    -------
    blueprint : Blueprint
        The blueprint for the
    """
    if url_prefix is None:
        url_prefix = model.__name__.lower()

    bp = Blueprint(url_prefix, url_prefix, url_prefix=url_prefix)

    @bp.route("/", methods=["GET"])
    async def get_all():
        params = request.args
        # Cursor is encoded as a string in the format "datetime,id" where date
        # is the creation date as integer and id is the id of the item.
        cursor = get_query_param(
            params,
            "cursor",
            __cursor_from_string,
        )
        n_items = get_query_param(
            params,
            "n_items",
            int,
            50,
        )

        items, next_cursor = _get_all(model, cursor, n_items)
        # Next url
        cursor_str = __cursor_to_string(next_cursor)

        if cursor_str is not None:
            next = f"{request.path}?cursor={cursor_str}&n_items={n_items}"
        else:
            next = None
        return {"items": items, "next": next}

    @bp.route("/id/<id>", methods=["GET"])
    async def get_by_id(id: str):
        with db_session_factory() as session:
            item = model.get_by(model.id == id, session=session)
            if not item:
                raise InvalidUsage(f"Item with id {id} not found", status_code=404)

            return item.to_dict()

    # FIXME: This is a bit of a hack, but it works for now
    if model is SessionStateInDb:

        @bp.route("/by_folder", methods=["POST"])
        @with_folders(allow_mismatch=True)
        async def get_by_folder(
            folder_hashes: list[str], folder_paths: list[str], params: Any
        ):

            hash = folder_hashes[0]

            with db_session_factory() as db_session:
                query = (
                    select(model)
                    .where((model.folder_hash == hash))
                    .order_by(model.created_at.desc())
                    .limit(1)
                )
                item = db_session.execute(query).scalars().first()
                if not item:
                    # TODO: by path
                    raise InvalidUsage(
                        f"Item with hash {hash} not found", status_code=404
                    )
                return jsonify(item.to_dict())

    return bp


def register_state_models(app: Blueprint | Quart):
    # FIXME: This should be done somewhere else imo
    app.register_blueprint(
        blueprint_for_db_model(
            SessionStateInDb,
            url_prefix="/session",
        )
    )
    app.register_blueprint(
        blueprint_for_db_model(
            TaskStateInDb,
            url_prefix="/task",
        )
    )
    app.register_blueprint(
        blueprint_for_db_model(
            CandidateStateInDb,
            url_prefix="/candidate",
        )
    )


def _get_all(
    model: type[T], cursor: tuple[datetime, str] | None = None, n_items: int = 50
):
    """Seek pagination for all items in the database.

    Returns a list of items and a cursor for the next page.
    """

    with db_session_factory() as db_session:
        query = select(model)
        if cursor:
            query = query.where(
                # cursor is a combination of date and model id, this is faster than
                # just using an offset
                (model.created_at <= cursor[0]).__and__(model.id < cursor[1])
            )
        query = query.order_by(model.created_at.desc(), model.id.desc()).limit(n_items)
        items: Sequence[T] = db_session.execute(query).scalars().all()

        # Convert items to a list of dictionaries
        items_list = [item.to_dict() for item in items]

    # Determine the next cursor
    if len(items) == n_items:
        last_item = items[-1]
        next_cursor = (last_item.created_at, last_item.id)
    else:
        next_cursor = None

    return items_list, next_cursor


def __cursor_to_string(cursor: tuple[datetime, str] | None) -> str | None:
    if cursor is None:
        return None
    return f"{cursor[0].isoformat()},{cursor[1]}".encode("utf-8").hex()


def __cursor_from_string(cursor: str | None) -> tuple[datetime, str] | None:
    if cursor is None:
        return None
    cursor = bytes.fromhex(cursor).decode("utf-8")
    c = cursor.split(",")
    if len(c) != 2:
        return None
    return datetime.fromisoformat(c[0]), c[1]
