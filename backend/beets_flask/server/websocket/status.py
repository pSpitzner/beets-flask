"""Allows the client to listen to status updates from the server.

Status updates are mainly send after a successful import or when
a preview is finished.
"""

import socketio

from beets_flask.logger import log

from . import sio
from .errors import sio_catch_exception

namespace = "/status"


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


async def send_status_update():
    """Send a status update to propagate to all clients.

    We use a simple client here as this code may be called from
    redis workers which do not have access to the sio instance.

    See /status/update sio endpoint above for how this is handled
    on the server.
    """

    client = socketio.AsyncClient()
    await client.connect("http://localhost:5001", namespaces=[namespace])

    # We need to use call as otherwise the event is not emitted if we close the client
    # immediately after connecting
    await client.call(
        "update", {"message": "Test message"}, namespace=namespace, timeout=2
    )

    await client.disconnect()


def register_status():
    # we need this to at least allow loading the module at the right time
    pass
