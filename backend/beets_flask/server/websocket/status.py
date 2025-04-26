"""Allows the client to listen to status updates from the server.

Status updates are mainly send after a successful import or when
a preview is finished.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

import socketio

from beets_flask.importer.progress import FolderStatus
from beets_flask.logger import log
from beets_flask.server.exceptions import to_serialized_exception

from . import sio
from .errors import sio_catch_exception

if TYPE_CHECKING:
    from beets_flask.server.routes.db_models.session import (
        FolderStatusUpdate,
        JobStatusUpdate,
    )


namespace = "/status"


@sio.on("connect", namespace=namespace)
@sio_catch_exception
async def connect(sid, *args):
    """Log connection."""
    log.debug(f"StatusSocket sid {sid} connected")


@sio.on("folder_status_update", namespace=namespace)
@sio_catch_exception
async def update(sid, data):
    """Allows to propagate status updates to all clients."""

    # Emit to all clients
    await sio.emit("folder_status_update", data, namespace=namespace)


@sio.on("job_status_update", namespace=namespace)
@sio_catch_exception
async def job_update(sid, data):
    """Allows to propagate status updates to all clients."""
    log.debug(f"Job update: {data}")

    # Emit to all clients
    await sio.emit("job_status_update", data, namespace=namespace)


@sio.on("*", namespace=namespace)
@sio_catch_exception
async def any_event(event, sid, data):
    """Debug unhandled events."""
    log.debug(f"StatusSocket sid {sid} unhandled event {event} with data {data}")


async def send_folder_status_update(
    path: str, hash: str, status: FolderStatus, exc: Exception | None = None
):
    """Send a status update to propagate to all clients.

    Allows to pass an exception to the status update.
    This is used when a preview fails, i.e. FolderStatus.FAILED
    """

    s: FolderStatusUpdate = {
        "path": path,
        "hash": hash,
        "status": status,
        "exc": exc if exc is None else to_serialized_exception(exc),
    }

    # Send a status update to propagate to all clients.

    # We use a simple client here as this code may be called from
    # redis workers which do not have access to the sio instance.

    # See /status/update sio endpoint above for how this is handled
    # on the server.

    client = socketio.AsyncClient()
    # FIXME: Static URL is difficult to maintain and testing does not work
    # with this setup. We need to find a way to make this dynamic.
    await client.connect("ws://127.0.0.1:5001", namespaces=[namespace])

    # HACK: Serialize FolderStatus, maybe we can fix this using the standard encoder in the future
    data = {
        "path": s["path"],
        "hash": s["hash"],
        "status": (
            s["status"].value if isinstance(s["status"], FolderStatus) else s["status"]
        ),
        "exc": s["exc"],
    }

    # We need to use call (instead of emit) as otherwise the event is not emitted
    # if we close the client immediately after connecting
    await client.call(
        "folder_status_update",
        data,
        namespace=namespace,
        timeout=5,
    )
    await client.disconnect()


async def send_job_status_update(status: JobStatusUpdate):
    client = socketio.AsyncClient()
    await client.connect("ws://127.0.0.1:5001", namespaces=[namespace])
    await client.call(
        "job_status_update",
        status,
        namespace=namespace,
        timeout=5,
    )
    await client.disconnect()


def register_status():
    # we need this to at least allow loading the module at the right time
    pass
