"""File streaming as mp3.

Allows to stream an item's file as mp3.
"""

import asyncio
import os
import time
from asyncio.subprocess import PIPE, Process
from typing import TYPE_CHECKING, AsyncIterator

import aiofiles
from beets import util as beets_util
from quart import Blueprint, Response, g

from beets_flask.logger import log
from beets_flask.server.exceptions import IntegrityException, NotFoundException

audio_bp = Blueprint("audio", __name__)

if TYPE_CHECKING:
    # For type hinting the global g object
    from . import g


@audio_bp.route("/item/<int:item_id>/audio", methods=["GET"])
async def item_audio(item_id: int):
    """Get the raw item data.

    For streaming the audio file directly to the clien.
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

    it = await transcode_to_mp3(item_path)

    return Response(
        it,
        mimetype="audio/mpeg",
    )


class FFmpegStreamer:
    """A class to handle streaming audio files through FFmpeg.

    This class initializes a persistent FFmpeg process and streams audio files
    through it. It uses asyncio for asynchronous I/O operations.
    The FFmpeg process is started with the specified arguments and the input
    is written to its stdin. The output is read from its stdout in chunks.
    """

    process: Process | None
    chunk_size: int = 4096

    def __init__(self):
        self.process = None

    async def start(self, *ffmpeg_args):
        """Initialize a persistent FFmpeg process with stdin open for input."""
        self.process = await asyncio.create_subprocess_exec(
            "ffmpeg",
            *ffmpeg_args,
            stdin=PIPE,
            stdout=PIPE,
            stderr=PIPE,
        )
        asyncio.create_task(self._drain_stderr())

    async def stream_file(self, file_path: str) -> AsyncIterator[bytes]:
        """Stream an audio file through the pre-warmed FFmpeg process."""

        if (
            self.process is None
            or self.process.stdin is None
            or self.process.stdout is None
        ):
            raise RuntimeError("FFmpeg process not started. Call start() first.")

        writer = asyncio.create_task(self._write_input(self._file_chunker(file_path)))

        start = time.process_time_ns()
        try:
            while not self.process.stdout.at_eof():
                chunk = await self.process.stdout.read(self.chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            await writer
            await self.process.wait()

            end = time.process_time_ns()
            log.info(
                f"Streamed {file_path} in {(end - start) / 1_000_000_000:.2f} s to mp3"
            )

    async def _drain_stderr(self):
        """Continuously read and print FFmpeg stderr."""
        assert self.process and self.process.stderr
        while True:
            line = await self.process.stderr.readline()
            if not line:
                break
            log.error(f"FFmpeg error: {line.decode().strip()}")

    async def _write_input(self, input_stream: AsyncIterator[bytes]):
        assert self.process is not None
        assert self.process.stdin is not None

        async for data in input_stream:
            self.process.stdin.write(data)
            await self.process.stdin.drain()
        self.process.stdin.close()

    async def _file_chunker(
        self, path: str, size: int = 1024 * 1024
    ) -> AsyncIterator[bytes]:
        async with aiofiles.open(path, "rb") as f:
            while True:
                data = await f.read(size)
                if not data:
                    break
                yield data


async def transcode_to_mp3(file_path: str) -> AsyncIterator[bytes]:
    """Transcode a file to mp3 using FFmpeg and stream it."""
    ffmpeg_streamer = FFmpegStreamer()
    i_fmt = file_path.split(".")[-1]

    # This yields quite fast transcoding
    # for me, might need a bit more benchmarking
    # fmt: off
    await ffmpeg_streamer.start(*[
        "-hide_banner",
        "-loglevel", "error",
        "-fflags", "nobuffer",
        "-flush_packets", "0",
        "-probesize", "32",
        "-analyzeduration", "0",
        "-f", i_fmt,                        # input format
        "-i", "-",                           # read from stdin
        "-vn", "-sn", "-dn",                # DROP video streams
        "-preset", "ultrafast",             # Faster MP3 encoding
        "-map_metadata", "-1",              # Skip all metadata
        "-map", "0:a",                      # Map all audio streams
        "-codec:a", "libmp3lame",
        "-b:a", "192k",
        "-f", "mp3",                        # Force MP3 format for stdout
        "-",                                # Output to stdout
    ])
    # fmt: on

    return ffmpeg_streamer.stream_file(file_path)
