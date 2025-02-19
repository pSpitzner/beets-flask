from datetime import datetime
from typing import Sequence, TypeVar

from quart import Blueprint, request
from sqlalchemy import select

from beets_flask.database import Tag, db_session
from beets_flask.database.models.base import Base
from beets_flask.database.models.test import Test

T = TypeVar("T", bound=Base)


def _get_all(
    model: type[T], cursor: tuple[datetime, str] | None = None, n_items: int = 50
):
    """Seek pagination for all items in the database.

    Returns a list of items and a cursor for the next page.
    """

    with db_session() as session:
        query = select(model)
        if cursor:
            query = query.where(model.created_at < cursor[0] and model.id < cursor[1])
        query = query.order_by(model.created_at.desc(), model.id.desc()).limit(n_items)

        items: Sequence[T] = session.execute(query).scalars().all()

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
    return f"{cursor[0].isoformat()},{cursor[1]}"


def __cursor_from_string(cursor: str | None) -> tuple[datetime, str] | None:
    if cursor is None:
        return None
    c = cursor.split(",")
    if len(c) != 2:
        return None
    return datetime.fromisoformat(cursor[0]), cursor[1]


def rest_from_db_model(model: type[T], prefix: str | None = None) -> Blueprint:
    """Return a blueprint for a REST API for a database model.

    Can be used to automatically generate a REST API for a database model.

    Parameters
    ----------
    model : type[Base & Serializable]
        The database model to generate the REST API for. Has to have a as_dict method.
    prefix : str, optional
        The prefix for the REST API, by default None. If None, the model name in lowercase is used.

    Returns
    -------
    blueprint : Blueprint
        The blueprint for the REST API.
    """
    if prefix is None:
        prefix = model.__name__.lower()

    bp = Blueprint(prefix, prefix, url_prefix=prefix)

    @bp.route("/", methods=["GET"])
    async def get_all():

        # Cursor is encoded as a string in the format "datetime,id" where date
        # is the creation date as integer and id is the id of the item.
        params = request.args
        cursor_str = __cursor_from_string(params.get("cursor"))
        n_items = int(params.get("n_items", 50))

        items, next_cursor = _get_all(model, cursor_str, n_items)

        # Next url
        cursor_str = __cursor_to_string(next_cursor)

        if cursor_str is not None:
            # FIXME: url encode
            next = f"{request.path}?cursor={cursor_str}&n_items={n_items}"
        else:
            next = None
        return {"items": items, "next": next}

    @bp.route("/id/<id>", methods=["GET"])
    async def get_by_id(id: str):
        with db_session() as session:
            item = model.get_by(model.id == id, session=session)
            if not item:
                return "Not found", 404

            return item.to_dict()

    @bp.route("/id/<id>", methods=["DELETE"])
    async def delete_by_id(id: str):
        with db_session() as session:
            item = model.get_by(model.id == id, session=session)
            if not item:
                return "Not found", 404

            session.delete(item)
            session.commit()
            return "Deleted"

    return bp


def register_rest_api(bp: Blueprint):
    """Register a REST API blueprint with the app.

    Parameters
    ----------
    app : Quart
        The app to register the blueprint with.
    bp : Blueprint
        The blueprint to register.
    """
    bp1 = rest_from_db_model(Tag, "/test1")
    bp.register_blueprint(bp1)
