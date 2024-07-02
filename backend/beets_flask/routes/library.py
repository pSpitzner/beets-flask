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


import base64
import json
import os
from pathlib import Path
from typing import Optional, TypedDict, cast
import time

from flask import (
    Blueprint,
    Response,
    request,
    jsonify,
    current_app,
    abort,
    make_response,
    send_file,
    g,
)
from unidecode import unidecode
from werkzeug.routing import BaseConverter, PathConverter

import beets.library
from beets import ui, util
from beets.ui import _open_library
from beets_flask.config import config
from beets_flask.disk import dir_size
from beets_flask.logger import log

library_bp = Blueprint("library", __name__, url_prefix="/library")


# ------------------------------------------------------------------------------------ #
#                                        Helper                                        #
# ------------------------------------------------------------------------------------ #


def _rep(obj, expand=False, minimal=False):
    """Get a flat -- i.e., JSON-ish -- representation of a beets Item or
    Album object. For Albums, `expand` dictates whether tracks are
    included.
    """
    out = dict(obj)

    # For out client side, we want to have a consistent name for each kind of item.
    # for tracks its the title, for albums album name...
    out["name"] = (
        out.get("title", None) or out.get("album", None) or out.get("artist", None)
    )

    if minimal:
        out = {k: v for k, v in out.items() if k in ["id", "name"]}

    if isinstance(obj, beets.library.Item):

        if not minimal:
            if config["gui"]["library"]["include_paths"].get(bool):
                out["path"] = util.displayable_path(out["path"])
            else:
                del out["path"]

        for key, value in out.items():
            if isinstance(out[key], bytes):
                out[key] = base64.b64encode(value).decode("ascii")

        # Get the size (in bytes) of the backing file. This is useful
        # for the Tomahawk resolver API.
        try:
            out["size"] = os.path.getsize(util.syspath(obj.path))
        except OSError:
            out["size"] = 0

        return out

    elif isinstance(obj, beets.library.Album):
        if not minimal:
            if config["gui"]["library"]["include_paths"].get(bool):
                out["artpath"] = util.displayable_path(out["artpath"])
            else:
                del out["artpath"]

        if expand:
            out["items"] = [
                _rep(item, expand=expand, minimal=minimal) for item in obj.items()
            ]
        return out


def json_generator(items, root, expand=False, minimal=False):
    """Generator that dumps list of beets Items or Albums as JSON

    :param root:  root key for JSON
    :param items: list of :class:`Item` or :class:`Album` to dump
    :param expand: If true every :class:`Album` contains its items in the json
                   representation
    :returns:     generator that yields strings
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
    """
    Returns whether the current request is for an expanded response.

    """

    return request.args.get("expand") is not None


def is_minimal():
    """
    Normal requests have full info, minimal ones only have item ids and names.
    """
    return request.args.get("minimal") is not None


def is_delete():
    """Returns whether the current delete request should remove the selected
    files.
    """

    return request.args.get("delete") is not None


def get_method():
    """Returns the HTTP method of the current request."""
    return request.method


def resource(name, patchable=False):
    """Decorates a function to handle RESTful HTTP requests for a resource."""

    def make_responder(retriever):
        def responder(ids):
            entities = [retriever(id) for id in ids]
            entities = [entity for entity in entities if entity]

            if get_method() == "DELETE":
                if config["gui"]["library"]["readonly"].get(bool):
                    return abort(405)

                for entity in entities:
                    entity.remove(delete=is_delete())

                return make_response(jsonify({"deleted": True}), 200)

            elif get_method() == "PATCH" and patchable:
                if config["gui"]["library"]["readonly"].get(bool):
                    return abort(405)

                for entity in entities:
                    entity.update(request.get_json())
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
    """Decorates a function to handle RESTful HTTP queries for resources."""

    def make_responder(query_func):
        def responder(queries):
            entities = query_func(queries)

            if get_method() == "DELETE":
                if config["gui"]["library"]["readonly"].get(bool):
                    return abort(405)

                for entity in entities:
                    entity.remove(delete=is_delete())

                return make_response(jsonify({"deleted": True}), 200)

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
    """Decorates a function to handle RESTful HTTP request for a list of
    resources.
    """

    def make_responder(list_all):
        def responder():
            return Response(
                json_generator(
                    list_all(), root=name, expand=is_expand(), minimal=is_minimal()
                ),
                mimetype="application/json",
            )

        responder.__name__ = f"all_{name}"
        return responder

    return make_responder


def _get_unique_table_field_values(model, field, sort_field):
    """retrieve all unique values belonging to a key from a model"""
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
def before_request():
    # we will need to see if keeping the db open from each thread is what we want,
    # the importer may want to write.
    if not hasattr(g, "lib") or g.lib is None:
        g.lib = _open_library(config)


# ------------------------------------------------------------------------------------ #
#                                         Items                                        #
# ------------------------------------------------------------------------------------ #


@library_bp.route("/item/<idlist:ids>", methods=["GET", "DELETE", "PATCH"])
@resource("items", patchable=True)
def get_item(id):
    return g.lib.get_item(id)


@library_bp.route("/item/")
@library_bp.route("/item/query/")
@resource_list("items")
def all_items():
    items = g.lib.items()
    if is_expand():
        return items
    else:
        return items


@library_bp.route("/item/<int:item_id>/file")
def item_file(item_id):
    item = g.lib.get_item(item_id)

    # On Windows under Python 2, Flask wants a Unicode path. On Python 3, it
    # *always* wants a Unicode path.
    if os.name == "nt":
        item_path = util.syspath(item.path)
    else:
        item_path = util.py3_path(item.path)

    base_filename = os.path.basename(item_path)
    # FIXME: Arguably, this should just use `displayable_path`: The latter
    # tries `_fsencoding()` first, but then falls back to `utf-8`, too.
    if isinstance(base_filename, bytes):
        try:
            unicode_base_filename = base_filename.decode("utf-8")
        except UnicodeError:
            unicode_base_filename = util.displayable_path(base_filename)
    else:
        unicode_base_filename = base_filename

    try:
        # Imitate http.server behaviour
        base_filename.encode("latin-1", "strict")
    except UnicodeError:
        safe_filename = unidecode(base_filename)
    else:
        safe_filename = unicode_base_filename

    response = send_file(item_path, as_attachment=True, download_name=safe_filename)
    return response


@library_bp.route("/item/query/<query:queries>", methods=["GET", "DELETE", "PATCH"])
@resource_query("items", patchable=True)
def item_query(queries):
    return g.lib.items(queries)


@library_bp.route("/item/path/<everything:path>")
def item_at_path(path):
    query = beets.library.PathQuery("path", path.encode("utf-8"))
    item = g.lib.items(query).get()
    if item:
        return jsonify(_rep(item))
    else:
        return abort(404)


@library_bp.route("/item/values/<string:key>")
def item_unique_field_values(key):
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
def get_album(id):
    return g.lib.get_album(id)


@library_bp.route("/album/")
@library_bp.route("/album/query/")
@resource_list("albums")
def all_albums():
    return g.lib.albums()


@library_bp.route("/album/query/<query:queries>", methods=["GET", "DELETE"])
@resource_query("albums")
def album_query(queries):
    return g.lib.albums(queries)


@library_bp.route("/album/<int:album_id>/art")
def album_art(album_id):
    album = g.lib.get_album(album_id)
    if album and album.artpath:
        return send_file(album.artpath.decode())
    else:
        return abort(404)


@library_bp.route("/album/values/<string:key>")
def album_unique_field_values(key):
    sort_key = request.args.get("sort_key", key)
    try:
        values = _get_unique_table_field_values(beets.library.Album, key, sort_key)
    except KeyError:
        return abort(404)
    return jsonify(values=values)


@library_bp.route("/album/<int:album_id>/items")
def album_items(album_id):
    album = g.lib.get_album(album_id)
    if album:
        return jsonify(items=[_rep(item) for item in album.items()])
    else:
        return abort(404)


# ------------------------------------------------------------------------------------ #
#                        Hierachical API: artist > album > track                       #
# ------------------------------------------------------------------------------------ #


@library_bp.route("/artist/")
def all_artists():
    with g.lib.transaction() as tx:
        rows = tx.query("SELECT DISTINCT albumartist FROM albums")
    all_artists = [{"name": row[0]} for row in rows]
    return jsonify(sorted(all_artists, key=lambda a: a["name"]))


@library_bp.route("/artist/<string:artist_name>")
def albums_by_artist(artist_name):

    with g.lib.transaction() as tx:
        rows = tx.query(f"SELECT id FROM albums WHERE albumartist = '{artist_name}'")

    expanded = is_expand()
    minimal = is_minimal()

    res =  jsonify(
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
    items: int  # Num Tracks and stuff / num Files
    albums: int  # Num Albums
    artists: int  # Num Artists
    genres: int  # Num Genres
    labels: int  # Num Labels

    size: int
    lastItemAdded: Optional[int]  # UTC timestamp
    lastItemModified: Optional[int]  # UTC timestamp


@library_bp.route("/stats")
def stats():
    with g.lib.transaction() as tx:
        item_rows = tx.query("SELECT COUNT(*) FROM items")
        album_rows = tx.query("SELECT COUNT(*) FROM albums")
        unique_artists = tx.query("SELECT COUNT(DISTINCT albumartist) FROM albums")
        unique_genres = tx.query("SELECT COUNT(DISTINCT genre) FROM albums")
        unique_labels = tx.query("SELECT COUNT(DISTINCT label) FROM albums")
        last_added = tx.query("SELECT MAX(added) FROM items")
        last_modified = tx.query("SELECT MAX(mtime) FROM items")

    lib_path = cast(str, config["directory"].get())
    lib_path = Path(lib_path)

    ret: Stats = {
        "items": item_rows[0][0],
        "albums": album_rows[0][0],
        "artists": unique_artists[0][0],
        "genres": unique_genres[0][0],
        "labels": unique_labels[0][0],
        "size": dir_size(lib_path),
        "lastItemAdded": (
            round(last_added[0][0] * 1000) if last_added[0][0] is not None else None
        ),
        "lastItemModified": (
            round(last_modified[0][0] * 1000)
            if last_modified[0][0] is not None
            else None
        ),
    }

    return jsonify(ret)
