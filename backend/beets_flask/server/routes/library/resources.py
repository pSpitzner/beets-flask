"""Set update and delete methods for the beets library models.

Adapted from the official beets web interface
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from functools import wraps
from typing import (
    TYPE_CHECKING,
    Any,
    Awaitable,
    Callable,
    Sequence,
    TypedDict,
    TypeVar,
    cast,
)

from beets import util as beets_util
from beets.dbcore import Results
from beets.library import Album, Item
from quart import Blueprint, Response, abort, g, jsonify, request
from typing_extensions import NotRequired

from beets_flask.config import get_config
from beets_flask.logger import log
from beets_flask.server.exceptions import NotFoundException

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
        raise NotFoundException(f"Item with beets_id:'{id}' not found in beets db.")

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
        raise NotFoundException(f"Album with beets_id:'{id}' not found in beets db.")
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


# -------------------- Helper for formatting beets models -------------------- #


class ItemResponseMinimal(TypedDict):
    """Type definition for the minimal response for item."""

    # Unique identifier for the item in the beets library
    id: int
    # Name of the item
    name: str
    # Full path to the item on disk
    path: str
    # Primary artist for the item
    artist: str
    # Year the item was published
    year: int

    # Name, id and the primary artist
    # for the associated album
    album: str
    albumartist: str
    album_id: int

    # ISRC code for the item
    isrc: NotRequired[str]

    size: int


class ItemResponse(ItemResponseMinimal):
    """Type definition for the full item response.

    Might not be 100% accurate as plugins may add additional fields. We
    atleast type all field that are used in the frontend.
    """

    # The genre of the item, if multiple genres are present they are
    # separated by a semicolon (;)
    genre: str

    # The label in which the item was published
    label: str

    # Technical details about the item
    samplerate: int
    bitrate: int
    bpm: int
    bitdepth: int
    channels: int
    format: str
    encoder_info: str
    encoder_settings: str
    initial_key: str
    length: float

    # Album specifics
    track: int
    tracktotal: int

    # Library specific
    added: float

    # Catalog number
    catalognum: str

    # The source of the item, e.g. CD, Vinyl, Digital
    sources: list[ItemSource]


class ItemSource(TypedDict):
    source: str
    track_id: str
    album_id: NotRequired[str]
    artist_id: NotRequired[str]

    extra: NotRequired[dict[str, str | list[str]]]


source_prefixes = ["mb", "spotify", "tidal", "discogs"]


def _repr_Item(item: Item | None, minimal=False) -> ItemResponse | ItemResponseMinimal:

    if not item:
        raise NotFoundException("Item not found")

    out: dict[str, Any] = dict()

    if minimal:
        keys = [
            "id",
            "name",
            "artist",
            "albumartist",
            "album",
            "album_id",
            "year",
            "isrc",
        ]
    else:
        # Use all keys
        keys = item.keys(True) + ["name"]

        # Check data source prefixes:
        # plugins such as spotify, tidal, discogs add a prefix to the id,
        # we want to split this prefix from the id and add them to a list of
        # sources
        sources: list[ItemSource] = list()
        for prefix in source_prefixes:
            f_keys = list(filter(lambda k: k.startswith(f"{prefix}_"), keys))

            track_id, track_id_key = __get_id(item, prefix, "track")
            if not track_id:
                continue
            source = ItemSource(source=prefix, track_id=track_id)

            album_id, album_id_key = __get_id(item, prefix, "album")
            if album_id:
                source["album_id"] = album_id

            artist_id, artist_id_key = __get_id(item, prefix, "artist")
            if artist_id:
                source["artist_id"] = artist_id

            keys_extra = [
                k
                for k in f_keys
                if k not in [track_id_key, album_id_key, artist_id_key]
            ]
            extras = {}
            for k in keys_extra:
                if __is_empty(item[k]):
                    continue
                extras[__normalize_id_key(prefix, k)] = item[k]

            if len(extras) > 0:
                source["extra"] = extras

            sources.append(source)
            keys = [k for k in keys if k not in f_keys]

        # additionally the mb_id fields may be filled with the same id
        # as the any other data source if mb is disabled, this is done
        # by beets to allow easier lookup
        mb_source = next(filter(lambda s: s["source"] == "mb", sources), None)
        if mb_source and len(sources) > 1:
            for source in sources:
                if source["source"] == "mb":
                    continue

                if source["track_id"] == mb_source["track_id"]:
                    # Update source with other unset mb fields
                    # no idea why this happens but e.g. albumartist_id set for mb
                    # but not for spotify even tho the mb_albumartistid is a spotify
                    # id
                    for k, v in mb_source.items():
                        if k not in source:
                            source[k] = v

                    sources = list(filter(lambda s: s["source"] != "mb", sources))
                    break

        out["sources"] = sources

    for key in keys:

        if key == "name":
            out[key] = item.title
        else:
            out[key] = item[key]

        # Format path
        if key == "path":
            out[key] = beets_util.displayable_path(out[key])

        # Decode bytes
        b = out[key]
        if isinstance(b, bytes):
            out[key] = base64.b64encode(b).decode("ascii")

        # Remove empty values
        if __is_empty(out[key]):
            del out[key]

    # Get the size (in bytes) of the backing file. This is useful
    # for the Tomahawk resolver API.
    try:
        out["size"] = os.path.getsize(beets_util.syspath(path=item.path))
    except OSError:
        out["size"] = 0

    return cast(ItemResponse | ItemResponseMinimal, out)


class AlbumResponseMinimal(TypedDict):
    """Type definition for the minimal response for album."""

    # Unique identifier for the album in the beets library
    id: int
    # Name of the album
    name: str
    # Path to the album
    path: str
    # Primary artist for the album
    albumartist: str
    # Year the album was published
    year: int


class AlbumResponseMinimalExpanded(AlbumResponseMinimal):
    items: list[ItemResponseMinimal]


class AlbumResponse(AlbumResponseMinimal):
    """Type definition for the full album response.

    Might not be 100% accurate as plugins may add additional fields. We
    atleast type all field that are used in the frontend.
    """

    # The genre of the album, if multiple genres are present they are
    # separated by a semicolon (;)
    genre: str

    # The label in which the album was published
    label: str

    # The data source of the album metadata
    sources: list[AlbumSource]


class AlbumResponseExpanded(AlbumResponseMinimal):
    items: list[ItemResponse]


class AlbumSource(TypedDict):
    source: str
    album_id: str
    artist_id: NotRequired[str]

    extra: NotRequired[dict[str, str]]


def _rep_Album(
    album: Album, expand=False, minimal=False
) -> AlbumResponse | AlbumResponseMinimal:
    """Get a flat -- i.e., JSON-ish -- representation of a beets Item/Album object.

    For Albums, `expand` dictates whether tracks are
    included.
    """

    out: dict[str, Any] = dict()

    out["path"] = beets_util.displayable_path(album.path)

    if minimal:
        keys = ["id", "name", "albumartist", "year"]
    else:
        # Use all keys
        keys = album.keys() + ["name"]

        # Parse sources
        out["sources"] = list()
        for prefix in source_prefixes:
            f_keys = list(filter(lambda k: k.startswith(f"{prefix}_"), keys))

            album_id, album_id_key = __get_id(album, prefix, "album")
            if not album_id:
                continue
            source = AlbumSource(source=prefix, album_id=album_id)

            artist_id, artist_id_key = __get_id(album, prefix, "artist")
            if artist_id:
                source["artist_id"] = artist_id

            keys_extra = [k for k in f_keys if k not in [album_id_key, artist_id_key]]
            extras = {}
            for k in keys_extra:
                if __is_empty(album[k]):
                    continue
                extras[__normalize_id_key(prefix, k)] = album[k]

            if len(extras) > 0:
                source["extra"] = extras

            out["sources"].append(source)
            keys = [k for k in keys if k not in f_keys]

    for key in keys:

        if key == "name":
            out[key] = album.album
        else:
            out[key] = album[key]

        # Format path
        if key == "path":
            out[key] = beets_util.displayable_path(out[key])

        # Decode bytes
        if isinstance(out[key], bytes):
            out[key] = base64.b64encode(out[key]).decode("ascii")

        # Remove empty values
        if __is_empty(out[key]):
            del out[key]

    if expand:
        out["items"] = [_repr_Item(item, minimal) for item in album.items()]

    return cast(AlbumResponse | AlbumResponseMinimal, out)


def _rep(entity: Item | Album | None, expand=False, minimal=False):
    """Get a flat -- i.e., JSON-ish -- representation of a beets Item/Album object.

    For Albums, `expand` dictates whether tracks are
    included.
    """

    if not entity:
        raise NotFoundException("Entity not found")

    if isinstance(entity, Item):
        return _repr_Item(entity, minimal)
    elif isinstance(entity, Album):
        return _rep_Album(entity, expand, minimal)
    else:
        raise ValueError(f"Unknown entity type: {type(entity)}")


def __is_empty(value: str | None | list[Any], zero_empty: bool = True) -> bool:
    """Check if empty value."""
    if value is None:
        return True
    if value == "":
        return True
    if isinstance(value, str) and value.isspace():
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    if zero_empty and isinstance(value, int) and value == 0:
        return True

    return False


def __get_id(
    item: Item | Album,
    source: str,
    t: str,
) -> tuple[str | None, str | None]:
    """Get the id of a source.

    Resolve inconsistencies in the beets library where the id is stored in
    different fields.
    """
    s1 = item.get(f"{source}_{t}_id", None)
    if s1:
        return s1, f"{source}_{t}_id"

    s2 = item.get(f"{source}_{t}id", None)
    if s2:
        return s2, f"{source}_{t}id"

    return None, None


def __normalize_id_key(prefix: str, id: str):
    """Normalize the id key.

    Inserts an underscore before the "id" or "ids" suffix.
    Also removes the prefix.
    """
    return id.replace("id", "_id").replace(prefix + "_", "")
