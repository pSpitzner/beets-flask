"""Allows the client to listen to status updates from the server.

Status updates are mainly send after a successful import or when
a preview is finished.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import TYPE_CHECKING, Literal, TypedDict

import socketio
from quart import json

from beets_flask.logger import log
from beets_flask.server.exceptions import SerializedException, to_serialized_exception

from . import sio
from .errors import sio_catch_exception


if TYPE_CHECKING:
    from beets_flask.importer.progress import FolderStatus
    from beets_flask.invoker import JobMeta


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


async def send_status_update(status: FolderStatusUpdate | JobStatusUpdate):
    """Send a status update to propagate to all clients.

    Allows to pass an exception as part of the status update.
    This is used when a preview fails, i.e. FolderStatus.FAILED
    """

    # We use a simple client here as this code may be called from
    # redis workers which do not have access to the sio instance.
    # See /status/update sio endpoint above for how this is handled
    # on the server.
    # By providing the json module via quart, we reuse our custom json encoder.
    client = socketio.AsyncClient(json=json)
    # FIXME: Static URL is difficult to maintain and testing does not work
    # with this setup. We need to find a way to make this dynamic.
    await client.connect("ws://127.0.0.1:5001", namespaces=[namespace])

    # We need to use call (instead of emit) as otherwise the event is not emitted
    # if we close the client immediately after connecting
    await client.call(
        status.event,
        status,
        namespace=namespace,
        timeout=5,
    )
    await client.disconnect()


def register_status():
    # we need this to at least allow loading the module at the right time
    pass


@dataclass
class JobStatusUpdate:
    message: str
    num_jobs: int
    job_metas: list[JobMeta]
    exc: SerializedException | None = None
    event: str = "job_status_update"


@dataclass
class FolderStatusUpdate:
    path: str
    hash: str
    status: FolderStatus
    exc: SerializedException | None = None
    event: str = "folder_status_update"
