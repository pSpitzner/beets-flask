"""Allows the client to listen to status updates from the server.

Status updates are mainly send after a successful import or when
a preview is finished.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, overload

import socketio

from beets_flask.importer.progress import FolderStatus
from beets_flask.logger import log

from . import sio
from .errors import sio_catch_exception

if TYPE_CHECKING:
    from beets_flask.server.routes.tag import FolderStatusResponse


namespace = "/status"


@sio.on("connect", namespace=namespace)
@sio_catch_exception
async def connect(sid, *args):
    """Log connection."""
    log.warning(f"StatusSocket sid {sid} connected")


@sio.on("update", namespace=namespace)
@sio_catch_exception
async def update(sid, data):
    """Allows to propagate status updates to all clients."""
    log.warning(f"Status update: {data}")

    # Emit to all clients
    await sio.emit("update", data, namespace=namespace)


@sio.on("*", namespace=namespace)
@sio_catch_exception
async def any_event(event, sid, data):
    """Debug unhandled events."""
    log.warning(f"StatusSocket sid {sid} undhandled event {event} with data {data}")


async def send_folder_status_update(path: str, hash: str, status: FolderStatus):
    await send_folder_status_response_update(
        {
            "path": path,
            "hash": hash,
            "status": status,
        }
    )


async def send_folder_status_response_update(
    status: FolderStatusResponse | dict[str, str | FolderStatus],
):
    """Send a status update to propagate to all clients.

    We use a simple client here as this code may be called from
    redis workers which do not have access to the sio instance.

    See /status/update sio endpoint above for how this is handled
    on the server.
    """

    client = socketio.AsyncClient()
    log.warning(client)
    log.warning(f"Connecting to {namespace}")
    # FIXME: Static URL is difficult to maintain and testing does not work
    # with this setup. We need to find a way to make this dynamic.
    await client.connect("http://127.0.0.1:5001", namespaces=[namespace])
    log.warning(f"Connected to {namespace}")
    # We need to use call (instead of emit) as otherwise the event is not emitted
    # if we close the client immediately after connecting

    # Why not emitted in redis?
    # Gets stuck here
    log.warning("STUCK HERE (only in redis)")
    await client.call(
        "update",
        status,
        namespace=namespace,
        timeout=5,
    )
    log.warning(f"Sent update to {namespace}")
    await client.disconnect()
    log.warning(f"Disconnected from {namespace}")


def register_status():
    # we need this to at least allow loading the module at the right time
    pass
