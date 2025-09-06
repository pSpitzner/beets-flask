"""Handle file uploads."""

import shutil
import tempfile
from asyncio import timeout
from pathlib import Path

import aiofiles
from quart import Blueprint, request

from beets_flask.logger import log
from beets_flask.server.exceptions import InvalidUsageException
from beets_flask.watchdog.inbox import get_inbox_folders

file_upload_bp = Blueprint("file_upload", __name__, url_prefix="/file_upload")


@file_upload_bp.route("/", methods=["POST"])
async def upload():
    # validate
    filename = request.headers.get("X-Filename")
    filedir = request.headers.get("X-File-Target-Dir")
    log.info(f"Uploading file {filename} to {filedir} ...")

    if not filename or not filedir:
        raise InvalidUsageException(
            "Missing header: X-Filename and X-File-Target-Dir are required"
        )

    log.info("A")

    filedir = Path(filedir)
    is_valid_filepath = False
    for inbox in get_inbox_folders():
        if filedir.is_relative_to(inbox):
            is_valid_filepath = True
            break

    if not is_valid_filepath:
        log.error(f"Invalid target path {filedir}, must be within an inbox.")
        # FIXME: hmm, seems that our custom Exceptions do not propagate
        # through the xhr - although the tests run through.
        raise InvalidUsageException("Invalid target path, must be within an inbox.")

    log.info("B")

    temp_path = Path(tempfile.gettempdir()) / "upload" / filename
    temp_path.parent.mkdir(parents=True, exist_ok=True)

    log.info("C")

    # upload to temp location with 1 hour timeout
    async with timeout(60 * 60):
        async with aiofiles.open(temp_path, "wb") as f:
            async for chunk in request.body:
                await f.write(chunk)

    log.info("D")

    # move to final location
    final_path = filedir / filename
    final_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(temp_path, final_path)

    log.info(f"Uploading file {filename} to {filedir} done!")

    return {"status": "ok"}
