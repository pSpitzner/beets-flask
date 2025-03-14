"""Set update and delete methods for the beets library models.

Adapted from the official beets web interface
"""

import base64
import os
from functools import wraps
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Iterable, Sequence, TypeVar

from beets import util as beets_util
from beets.dbcore import Results
from beets.library import Album, Item
from quart import Blueprint, Response, abort, g, jsonify, request, send_file

from beets_flask.config import get_config
from beets_flask.logger import log
from beets_flask.server.routes.errors import IntegrityError, NotFoundError

if TYPE_CHECKING:
    # For type hinting the global g object
    from . import g


resource_bp = Blueprint("resource", __name__)


T = TypeVar("T", bound=Item | Album)


def delete_files():
    """Return whether the current delete request should remove the selected files."""
    return request.args.get("delete") is not None


def expanded_response():
    """Check if request is for an expanded response.

    Return whether the current request is for an expanded response.
    """
    return request.args.get("expand") is not None


def minimal_response():
    """Check if request is for a minimal response.

    Normal requests contain full info, minimal ones only have item ids and names.
    """
    return request.args.get("minimal") is not None


def resource_query(
    type: type[T], patchable: bool = False
) -> Callable[..., Callable[[str], Awaitable[Response]]]:
    """Decorate a function to handle RESTful HTTP queries for resources."""

    def make_response(
        query_func: Callable[[str], Awaitable[Results[T]]],
    ) -> Callable[[str], Awaitable[Response]]:

        @wraps(query_func)
        async def wrapper(query: str) -> Response:
            # we set the route to use a path converter before us,
            # so queries is a single string.
            # edgecase: trailing escape character `\` would crash. we should
            # also avoid this in the frontend.
            if query.endswith("\\") and (len(query) - len(query.rstrip("\\"))) % 2 == 1:
                # only remove the last character if it is a single escape character
                query = query[:-1]

            entities = await query_func(query)

            method = request.method

            if method == "DELETE":
                delete_entities(entities._objects, delete_files())
                return jsonify({"deleted": True})
            elif method == "PATCH" and patchable:
                entities = update_entities(entities._objects, await request.get_json())
            elif method == "GET":
                pass
            else:
                return abort(405)

            # Return the entities
            return jsonify(
                [
                    _rep(
                        entity,
                        expand=expanded_response(),
                        minimal=minimal_response(),
                    )
                    for entity in entities
                ]
            )

        return wrapper

    return make_response


def resource(
    type: type[T], patchable: bool = False
) -> Callable[..., Callable[[int], Awaitable[Response]]]:
    """Decorate a function to handle RESTful HTTP requests for resources."""

    def make_response(
        get_func: Callable[[int], Awaitable[T]],
    ) -> Callable[[int], Awaitable[Response]]:

        @wraps(get_func)
        async def wrapper(id: int) -> Response:
            entity = await get_func(id)

            method = request.method

            if method == "DELETE":
                delete_entities([entity], delete_files())
                return jsonify({"deleted": True})
            elif method == "PATCH":
                entity = update_entities([entity], await request.get_json())[0]
            elif method == "GET":
                pass
            else:
                return abort(405)

            # Return the entity
            return jsonify(
                _rep(
                    entity,
                    expand=expanded_response(),
                    minimal=minimal_response(),
                )
            )

        return wrapper

    return make_response


@resource_bp.route("/item/<int:id>", methods=["GET", "DELETE", "PATCH"])
@resource(Item, patchable=True)
async def item(id: int):
    item = g.lib.get_item(id)
    if not item:
        raise NotFoundError(f"Item with beets_id:'{id}' not found in beets db.")

    return item


@resource_bp.route("/item/query/<path:query>", methods=["GET", "DELETE", "PATCH"])
@resource_query(Item, patchable=True)
async def item_query(query: str):
    return g.lib.items(query)


@resource_bp.route("/album/<int:id>", methods=["GET", "DELETE", "PATCH"])
@resource(Album, patchable=False)
async def album(id: int):
    item = g.lib.get_album(id)
    if not item:
        raise NotFoundError(f"Album with beets_id:'{id}' not found in beets db.")
    return item


@resource_bp.route("/album/query/<path:query>", methods=["GET", "DELETE", "PATCH"])
@resource_query(Album, patchable=False)
async def album_query(query: str):
    return g.lib.albums(query)


# Artists are handled slightly differently, as they are not a beets model but can be
# derived from the items.
@resource_bp.route("/artist/<path:artist_name>/albums", methods=["GET"])
async def albums_by_artist(artist_name: str):
    """Get all items for a specific artist."""
    log.debug(f"Album query for artist '{artist_name}'")

    with g.lib.transaction() as tx:
        rows = tx.query(
            f"SELECT id FROM albums WHERE albumartist COLLATE NOCASE = '{artist_name}'"
        )

    expanded = expanded_response()
    minimal = minimal_response()

    return jsonify(
        [
            _rep(g.lib.get_album(row[0]), expand=expanded, minimal=minimal)
            for row in rows
        ]
    )


@resource_bp.route("/artist/", methods=["GET"])
async def all_artists():
    with g.lib.transaction() as tx:
        rows = tx.query("SELECT DISTINCT albumartist FROM albums")
    all_artists = [{"name": row[0]} for row in rows]
    return jsonify(sorted(all_artists, key=lambda a: a["name"]))


# ----------------------------------- Util ----------------------------------- #


def delete_entities(entities: Sequence[Item | Album], delete_files=False) -> None:
    """Helper function to delete entities."""
    if get_config()["gui"]["library"]["readonly"].get(bool):
        raise ValueError("Library is read-only")

    # Remove
    [entity.remove(delete=delete_files) for entity in entities]


def update_entities(
    entities: Sequence[Item | Album], data: dict
) -> Sequence[Item | Album]:
    """Helper function to update entities."""
    if get_config()["gui"]["library"]["readonly"].get(bool):
        raise ValueError("Library is read-only")

    # Update
    for entity in entities:
        entity.update(data)
        entity.try_sync(True, False)

    return entities


def _rep(obj, expand=False, minimal=False):
    """Get a flat -- i.e., JSON-ish -- representation of a beets Item/Album object.

    For Albums, `expand` dictates whether tracks are
    included.
    """
    out: dict[str, Any] = dict(obj)

    # For our client side, we want to have a consistent name for each kind of item.
    # for tracks its the title, for albums album name...
    out["name"] = (
        out.get("title", None) or out.get("album", None) or out.get("artist", None)
    )

    if isinstance(obj, Item):
        if minimal:
            fields = [
                "id",
                "name",
                "artist",
                "albumartist",
                "album",
                "album_id",
                "year",
                "isrc",
            ]
            out = {k: v for k, v in out.items() if k in fields}

        if not minimal:
            out["path"] = beets_util.displayable_path(out["path"])

        for key, value in out.items():
            if isinstance(out[key], bytes):
                out[key] = base64.b64encode(value).decode("ascii")

        # Get the size (in bytes) of the backing file. This is useful
        # for the Tomahawk resolver API.
        try:
            out["size"] = os.path.getsize(beets_util.syspath(obj.path))
        except OSError:
            out["size"] = 0

        return out

    elif isinstance(obj, Album):
        if minimal:
            fields = ["id", "name", "albumartist", "year"]
            out = {k: v for k, v in out.items() if k in fields}
        else:
            out["artpath"] = beets_util.displayable_path(out["artpath"])

        if expand:
            out["items"] = [
                _rep(item, expand=expand, minimal=minimal) for item in obj.items()
            ]
        return out
