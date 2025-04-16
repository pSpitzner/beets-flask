"""File streaming as mp3.

Allows to stream an item's file as mp3.
"""

import asyncio
import os
from io import BytesIO
from typing import TYPE_CHECKING

from beets import util as beets_util
from pydub import AudioSegment
from quart import Blueprint, g, send_file

from beets_flask.logger import log
from beets_flask.server.exceptions import IntegrityException, NotFoundException

audio_bp = Blueprint("audio", __name__)

if TYPE_CHECKING:
    # For type hinting the global g object
    from . import g


def convert_to_mp3(file_path_: str):
    audio = AudioSegment.from_file(file_path_)

    # convert to mp3
    mp3_buffer = BytesIO()

    audio.export(mp3_buffer, format="mp3")

    # Seek to the beginning of the buffer
    mp3_buffer.seek(0)

    return mp3_buffer


@audio_bp.route("/item/<int:item_id>/audio", methods=["GET"])
async def item_audio(item_id: int):
    """Get the raw item data.

    For streaming the audio file.

    FIXME: This is a very basic implementation and this can be improved. E.g. streaming the file in chunks.
    """
    item = g.lib.get_item(item_id)
    if not item:
        raise NotFoundException(
            f"Item with beets_id:'{item_id}' not found in beets db."
        )

    item_path = beets_util.syspath(item.path)
    if not os.path.exists(item_path):
        raise IntegrityException(
            f"Item file '{item_path}' does not exist for item beets_id:'{item_id}'."
        )

    # Creaet buffer in sub-process
    audio_buffer = await asyncio.get_running_loop().run_in_executor(
        None, convert_to_mp3, item_path
    )

    return await send_file(audio_buffer, mimetype="audio/mpeg", as_attachment=False)
