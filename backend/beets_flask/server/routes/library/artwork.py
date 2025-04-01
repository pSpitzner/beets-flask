import os
from io import BytesIO
from typing import TYPE_CHECKING, cast
from urllib.parse import unquote_plus

from beets import util as beets_util
from mediafile import Image, MediaFile  # comes with the beets install
from PIL import Image as PILImage
from quart import Blueprint, g, make_response, redirect, send_file, url_for

from beets_flask.logger import log
from beets_flask.server.routes.errors import IntegrityError, NotFoundError

if TYPE_CHECKING:
    # For type hinting the global g object
    from . import g

__all__ = ["artwork_pb"]

artwork_pb = Blueprint("artwork", __name__)


@artwork_pb.route("/item/<int:item_id>/art", methods=["GET"])
async def item_art(item_id: int):
    log.debug(f"Item art query for id:'{item_id}'")

    # Item from beets library
    item = g.lib.get_item(item_id)
    if not item:
        raise NotFoundError(f"Item with beets_id:'{item_id}' not found in beets db.")

    # File
    item_path = beets_util.syspath(item.path)
    if not os.path.exists(item_path):
        raise IntegrityError(
            f"Item file '{item_path}' does not exist for item beets_id:'{item_id}'."
        )

    # Get image with mediafile library (comes with beets)
    mediafile = MediaFile(item_path)
    if not mediafile.images or len(mediafile.images) < 1:
        raise NotFoundError(f"Item has no cover art: '{item_id}'.")

    # TODO: Support multiple images
    im: Image = cast(Image, mediafile.images[0])  # typehints suck (beets typical)
    return await send_image(BytesIO(im.data))


@artwork_pb.route("/album/<int:album_id>/art", methods=["GET"])
async def album_art(album_id: int):
    log.debug(f"Album art query for id:'{album_id}'")

    # Album from beets library
    album = g.lib.get_album(album_id)
    if not album:
        raise NotFoundError(f"Album with beets_id:'{album_id}' not found in beets db.")

    # Has art set on album level
    if album.artpath:
        art_path = beets_util.syspath(album.artpath)
        if not os.path.exists(art_path):
            raise IntegrityError(
                f"Album art file '{art_path}' does not exist for album beets_id:'{album_id}'."
            )
        return await send_image(BytesIO(open(art_path, "rb").read()))

    # Check the first item in the album for embedded cover art
    items = album.items()
    if not items or len(items) < 1:
        raise IntegrityError(f"Album has no items: '{album_id}'.")

    # Reuse the item art route
    return redirect(url_for(".item_art", item_id=items[0].id))


@artwork_pb.route("/file/<string:filepath>/art", methods=["GET"])
async def file_art(filepath: str):
    # Decode url encoded filepath
    filepath = unquote_plus(filepath)
    filepath = beets_util.syspath(filepath)

    if not os.path.exists(filepath):
        raise IntegrityError(f"File '{filepath}' does not exist.")

    mediafile = MediaFile(filepath)
    if not mediafile.images or len(mediafile.images) < 1:
        raise NotFoundError(f"File has no cover art: '{filepath}'.")

    im: Image = cast(Image, mediafile.images[0])  # typehints suck (beets typical)
    return await send_image(BytesIO(im.data))


# ---------------------------------- Utils ----------------------------------- #


def _resize(img_data: BytesIO, size: tuple[int, int]) -> BytesIO:
    image = PILImage.open(img_data)
    image.thumbnail(size)
    image_io = BytesIO()
    image.convert("RGB").save(image_io, format="png")
    image_io.seek(0)
    return image_io


async def send_image(img_data: BytesIO):
    max_size = (200, 200)
    img = _resize(img_data, max_size)
    response = await make_response(await send_file(img, mimetype="image/png"))
    response.headers["Cache-Control"] = "public, max-age=86400"
    return response
