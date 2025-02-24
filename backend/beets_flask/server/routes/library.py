# Quick adaptation of the official beets web interface:
# ------------------------------------------------------------------------------------ #
# This file is part of beets.
# Copyright 2016, Adrian Sampson.
#
# Permission is hereby granted, free of charge, to any person obtaining
# a copy of this software and associated documentation files (the
# "Software"), to deal in the Software without restriction, including
# without limitation the rights to use, copy, modify, merge, publish,
# distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so, subject to
# the following conditions:
#
# The above copyright notice and this permission notice shall be
# included in all copies or substantial portions of the Software.
# ------------------------------------------------------------------------------------ #


import asyncio
import base64
import json
import os
import shutil
from io import BytesIO
from pathlib import Path
from typing import Awaitable, Callable, Coroutine, Optional, TypedDict, cast

import beets.library
from beets import util as beets_util
from beets.ui import _open_library
from mediafile import Image, MediaFile  # comes with the beets install
from PIL import Image as PILImage
from quart import (
    Blueprint,
    Response,
    abort,
    g,
    jsonify,
    make_response,
    request,
    send_file,
)
from unidecode import unidecode
from werkzeug.routing import BaseConverter, PathConverter

from beets_flask.config import get_config
from beets_flask.disk import dir_size
from beets_flask.logger import log

library_bp = Blueprint("library", __name__, url_prefix="/library")


# ------------------------------------------------------------------------------------ #
#                                        Helper                                        #
# ------------------------------------------------------------------------------------ #


def _rep(obj, expand=False, minimal=False):
    """Get a flat -- i.e., JSON-ish -- representation of a beets Item/Album object.

    For Albums, `expand` dictates whether tracks are
    included.
    """
    out = dict(obj)

    # For our client side, we want to have a consistent name for each kind of item.
    # for tracks its the title, for albums album name...
    out["name"] = (
        out.get("title", None) or out.get("album", None) or out.get("artist", None)
    )

    if isinstance(obj, beets.library.Item):
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

    elif isinstance(obj, beets.library.Album):
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


def json_generator(items, root, expand=False, minimal=False):
    """Generate JSON from a list of beets Items or Albums.

    Parameters
    ----------
    root : str
        root key for JSON
    items : list of beets.library.Item or beets.library.Album
        list of items to dump
    expand : bool
        If true every :class:`Album` contains its items in the json
        representation
    """
    yield '{"%s":[' % root
    first = True
    for item in items:
        if first:
            first = False
        else:
            yield ","
        yield json.dumps(_rep(item, expand=expand, minimal=minimal))
    yield "]}"


def is_expand():
    """Check if request is for an expanded response.

    Return whether the current request is for an expanded response.
    """
    return request.args.get("expand") is not None


def is_minimal():
    """Check if request is for a minimal response.

    Normal requests contain full info, minimal ones only have item ids and names.
    """
    return request.args.get("minimal") is not None


def is_delete():
    """Return whether the current delete request should remove the selected files."""
    return request.args.get("delete") is not None


def get_method():
    """Return the HTTP method of the current request."""
    return request.method


def resource(name, patchable=False):
    """Decorate a function to handle RESTful HTTP requests for a resource.

    # TODO: Check if async is still working as expected!
    """

    config = get_config()

    def make_responder(retriever):
        async def responder(ids):
            entities = [retriever(id) for id in ids]
            entities = await asyncio.gather(*entities)
            entities = [entity for entity in entities if entity]

            if get_method() == "DELETE":
                if config["gui"]["library"]["readonly"].get(bool):
                    return abort(405)

                for entity in entities:
                    entity.remove(delete=is_delete())

                return await make_response(jsonify({"deleted": True}), 200)

            elif get_method() == "PATCH" and patchable:
                if config["gui"]["library"]["readonly"].get(bool):
                    return abort(405)

                for entity in entities:
                    entity.update(await request.get_json())
                    entity.try_sync(True, False)  # write, don't move

                if len(entities) == 1:
                    return jsonify(_rep(entities[0], expand=is_expand()))
                elif entities:
                    return Response(
                        json_generator(entities, root=name),
                        mimetype="application/json",
                    )

            elif get_method() == "GET":
                if len(entities) == 1:
                    return jsonify(
                        _rep(entities[0], expand=is_expand(), minimal=is_minimal())
                    )
                elif entities:
                    return Response(
                        json_generator(
                            entities,
                            root=name,
                            expand=is_expand(),
                            minimal=is_minimal(),
                        ),
                        mimetype="application/json",
                    )
                else:
                    return abort(404)

            else:
                return abort(405)

        responder.__name__ = f"get_{name}"

        return responder

    return make_responder


def resource_query(name, patchable=False):
    """Decorate a function to handle RESTful HTTP queries for resources."""

    config = get_config()

    def make_responder(query_func):
        async def responder(queries):
            # we set the route to use a path converter before us,
            # so queries is a single string.
            # edgecase: trailing escape character `\` would crash. we should
            # also avoid this in the frontend.
            if (
                queries.endswith("\\")
                and (len(queries) - len(queries.rstrip("\\"))) % 2 == 1
            ):
                # only remove the last character if it is a single escape character
                queries = queries[:-1]

            entities = await query_func(queries)

            log.debug(queries)

            if get_method() == "DELETE":
                if config["gui"]["library"]["readonly"].get(bool):
                    return abort(405)

                for entity in entities:
                    entity.remove(delete=is_delete())

                return await make_response(jsonify({"deleted": True}), 200)

            elif get_method() == "PATCH" and patchable:
                if config["gui"]["library"]["readonly"].get(bool):
                    return abort(405)

                for entity in entities:
                    entity.update(request.get_json())
                    entity.try_sync(True, False)  # write, don't move

                return Response(
                    json_generator(entities, root=name),
                    mimetype="application/json",
                )

            elif get_method() == "GET":
                return Response(
                    json_generator(
                        entities,
                        root="results",
                        expand=is_expand(),
                        minimal=is_minimal(),
                    ),
                    mimetype="application/json",
                )

            else:
                return abort(405)

        responder.__name__ = f"query_{name}"

        return responder

    return make_responder


def resource_list(name):
    """Return a JSON response for a given resource."""

    def make_responder(list_all):
        async def responder():

            return Response(
                json_generator(
                    await list_all(),
                    root=name,
                    expand=is_expand(),
                    minimal=is_minimal(),
                ),
                mimetype="application/json",
            )

        responder.__name__ = f"all_{name}"
        return responder

    return make_responder


def _get_unique_table_field_values(model, field, sort_field):
    """Retrieve all unique values belonging to a key from a model."""
    if field not in model.all_keys() or sort_field not in model.all_keys():
        raise KeyError
    with g.lib.transaction() as tx:
        rows = tx.query(
            'SELECT DISTINCT "{}" FROM "{}" ORDER BY "{}"'.format(
                field, model._table, sort_field
            )
        )
    return [row[0] for row in rows]


class IdListConverter(BaseConverter):
    """Converts comma separated lists of ids in urls to integer lists."""

    def to_python(self, value):
        ids = []
        for id in value.split(","):
            try:
                ids.append(int(id))
            except ValueError:
                pass
        return ids

    def to_url(self, value):
        return ",".join(str(v) for v in value)


class QueryConverter(PathConverter):
    """Converts slash separated lists of queries in the url to string list."""

    def to_python(self, value):
        queries = value.split("/")
        """Do not do path substitution on regex value tests"""
        return [
            query if "::" in query else query.replace("\\", os.sep) for query in queries
        ]

    def to_url(self, value):
        return "/".join([v.replace(os.sep, "\\") for v in value])


class EverythingConverter(PathConverter):
    part_isolating = False
    regex = ".*?"


def add_converters(state):
    state.app.url_map.converters["idlist"] = IdListConverter
    state.app.url_map.converters["query"] = QueryConverter
    state.app.url_map.converters["everything"] = EverythingConverter


library_bp.record_once(add_converters)


# ------------------------------------------------------------------------------------ #
#                                        Routes                                        #
# ------------------------------------------------------------------------------------ #


@library_bp.before_request
async def before_request():

    config = get_config()
    # we will need to see if keeping the db open from each thread is what we want,
    # the importer may want to write.
    if not hasattr(g, "lib") or g.lib is None:
        g.lib = _open_library(config)
    else:
        if str(g.lib.path) != str(config.as_path()):
            g.lib = _open_library(config)


# ------------------------------------------------------------------------------------ #
#                                         Items                                        #
# ------------------------------------------------------------------------------------ #


@library_bp.route("/item/<idlist:ids>", methods=["GET", "DELETE", "PATCH"])
@resource("items", patchable=True)
async def get_item(id):
    return g.lib.get_item(id)


@library_bp.route("/item/")
@library_bp.route("/item/query/")
@resource_list("items")
async def all_items():
    items = g.lib.items()
    if is_expand():
        return items
    else:
        return items


@library_bp.route("/item/<int:item_id>/file")
async def item_file(item_id):
    item = g.lib.get_item(item_id)

    # On Windows under Python 2, Quart wants a Unicode path. On Python 3, it
    # *always* wants a Unicode path.
    if os.name == "nt":
        item_path = beets_util.syspath(item.path)
    else:
        item_path = beets_util.py3_path(item.path)

    base_filename = os.path.basename(item_path)
    # FIXME: Arguably, this should just use `displayable_path`: The latter
    # tries `_fsencoding()` first, but then falls back to `utf-8`, too.
    if isinstance(base_filename, bytes):
        try:
            unicode_base_filename = base_filename.decode("utf-8")
        except UnicodeError:
            unicode_base_filename = beets_util.displayable_path(base_filename)
    else:
        unicode_base_filename = base_filename

    try:
        # Imitate http.server behaviour
        base_filename.encode("latin-1", "strict")
    except UnicodeError:
        safe_filename = unidecode(base_filename)
    else:
        safe_filename = unicode_base_filename

    response = await send_file(
        item_path, as_attachment=True, attachment_filename=safe_filename
    )
    return response


@library_bp.route("/item/query/<path:queries>", methods=["GET", "DELETE", "PATCH"])
@resource_query("items", patchable=True)
async def item_query(queries):
    return g.lib.items(queries)


@library_bp.route("/item/path/<everything:path>")
async def item_at_path(path):
    query = beets.library.PathQuery("path", path.encode("utf-8"))
    item = g.lib.items(query).get()
    if item:
        return jsonify(_rep(item))
    else:
        return abort(404)


@library_bp.route("/item/values/<string:key>")
async def item_unique_field_values(key):
    sort_key = request.args.get("sort_key", key)
    try:
        values = _get_unique_table_field_values(beets.library.Item, key, sort_key)
    except KeyError:
        return abort(404)
    return jsonify(values=values)


# ------------------------------------------------------------------------------------ #
#                                        Albums                                        #
# ------------------------------------------------------------------------------------ #


@library_bp.route("/album/<idlist:ids>", methods=["GET", "DELETE"])
@resource("albums")
async def get_album(id):
    return g.lib.get_album(id)


@library_bp.route("/album/")
@library_bp.route("/album/query/")
@resource_list("albums")
async def all_albums():
    return g.lib.albums()


@library_bp.route("/album/query/<path:queries>", methods=["GET", "DELETE"])
@resource_query("albums")
async def album_query(queries):
    return g.lib.albums(queries)


@library_bp.route("/album/values/<string:key>")
async def album_unique_field_values(key):
    sort_key = request.args.get("sort_key", key)
    try:
        values = _get_unique_table_field_values(beets.library.Album, key, sort_key)
    except KeyError:
        return abort(404)
    return jsonify(values=values)


@library_bp.route("/album/<int:album_id>/items")
async def album_items(album_id):
    album = g.lib.get_album(album_id)
    if album:
        return jsonify(items=[_rep(item) for item in album.items()])
    else:
        return abort(404)


# ------------------------------------------------------------------------------------ #
#                                        Artwork                                       #
# ------------------------------------------------------------------------------------ #


@library_bp.route("/item/<int:item_id>/art")
async def item_art(item_id):
    log.debug(f"Item art query for '{item_id}'")
    item: beets.library.Item | None = g.lib.get_item(item_id)
    if not item:
        return abort(404, description="Item not found")

    item_path = beets_util.syspath(item.path)
    log.debug(f"Item: {item_path}")
    if not os.path.exists(item_path):
        return abort(404, description="Media file not found")

    mediafile = MediaFile(item_path)
    if not mediafile.images or len(mediafile.images) < 1:
        return abort(404, description="Item has no cover art")

    im: Image = cast(Image, mediafile.images[0])  # typehints suck (beets typical)
    return await _send_image(BytesIO(im.data))


@library_bp.route("/album/<int:album_id>/art")
async def album_art(album_id):
    log.debug(f"Art art query for album id '{album_id}'")
    album: beets.library.Album | None = g.lib.get_album(album_id)

    if album is None:
        return abort(404, description="Album not found")

    if album.artpath:
        with open(album.artpath.decode(), "rb") as f:
            return await _send_image(BytesIO(f.read()))

    # Check the first item in the album for embedded cover art
    # TODO: cleanup this mess (.art is deprecated)
    try:
        first_item: beets.library.Item = album.items()[0]
        item_path = beets_util.syspath(first_item.path)
        if not os.path.exists(item_path):
            return abort(404, description="Media file not found")
        mediafile = MediaFile(item_path)
        if mediafile.art:
            return await _send_image(BytesIO(mediafile.art))
        else:
            return abort(404, description="Item has no cover art")
    except:
        return abort(500, description="Failed to get album items")


async def _send_image(img_data: BytesIO):
    max_size = (200, 200)
    img = _resize(img_data, max_size)
    response = await make_response(await send_file(img, mimetype="image/png"))
    response.headers["Cache-Control"] = "public, max-age=86400"
    return response


def _resize(img_data: BytesIO, size: tuple[int, int]) -> BytesIO:
    image = PILImage.open(img_data)
    image.thumbnail(size)
    image_io = BytesIO()
    image.convert("RGB").save(image_io, format="JPEG")
    image_io.seek(0)
    return image_io


# ------------------------------------------------------------------------------------ #
#                        Hierachical API: artist > album > track                       #
# ------------------------------------------------------------------------------------ #


@library_bp.route("/artist/")
async def all_artists():
    with g.lib.transaction() as tx:
        rows = tx.query("SELECT DISTINCT albumartist FROM albums")
    all_artists = [{"name": row[0]} for row in rows]
    return jsonify(sorted(all_artists, key=lambda a: a["name"]))


@library_bp.route("/artist/<path:artist_name>")
async def albums_by_artist(artist_name):
    log.debug(f"Album query for artist '{artist_name}'")

    with g.lib.transaction() as tx:
        rows = tx.query(f"SELECT id FROM albums WHERE albumartist = '{artist_name}'")

    expanded = is_expand()
    minimal = is_minimal()

    res = jsonify(
        albums=[
            _rep(g.lib.get_album(row[0]), expand=expanded, minimal=minimal)
            for row in rows
        ]
    )

    return res


# ------------------------------------------------------------------------------------ #
#                                  Library information                                 #
# ------------------------------------------------------------------------------------ #


class Stats(TypedDict):
    libraryPath: str
    items: int  # Num Tracks and stuff / num Files
    albums: int  # Num Albums
    artists: int  # Num Artists
    genres: int  # Num Genres
    labels: int  # Num Labels

    size: int
    lastItemAdded: Optional[int]  # UTC timestamp
    lastItemModified: Optional[int]  # UTC timestamp
    runtime: int  # seconds
    freeSpace: int  # bytes


@library_bp.route("/stats")
async def stats():
    config = get_config()

    with g.lib.transaction() as tx:
        album_stats = tx.query(
            "SELECT COUNT(*), COUNT(DISTINCT genre), COUNT(DISTINCT label), COUNT(DISTINCT albumartist) FROM albums"
        )
        items_stats = tx.query(
            "SELECT COUNT(*), MAX(added), MAX(mtime), SUM(length) FROM items"
        )

    lib_path = Path(cast(str, config["directory"].get()))

    # Get available disk space
    disk_space = shutil.disk_usage(lib_path)

    ret: Stats = {
        "libraryPath": str(config["directory"].as_str()),
        "items": items_stats[0][0],
        "albums": album_stats[0][0],
        "artists": album_stats[0][3],
        "genres": album_stats[0][1],
        "labels": album_stats[0][2],
        "size": dir_size(lib_path),
        "lastItemAdded": (
            round(items_stats[0][1] * 1000) if items_stats[0][1] is not None else None
        ),
        "lastItemModified": (
            round(items_stats[0][2] * 1000) if items_stats[0][2] is not None else None
        ),
        "runtime": items_stats[0][3],
        "freeSpace": disk_space.free,
    }

    return jsonify(ret)
