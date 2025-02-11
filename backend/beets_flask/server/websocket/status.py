from beets_flask.logger import log

from . import sio


# Do we even need these?
@sio.on("connect", namespace="/status")  # type: ignore
async def connect(sid, environ):
    """Handle new client connected."""
    log.debug(f"StatusSocket new client connected {sid}")


@sio.on("disconnect", namespace="/status")  # type: ignore
async def disconnect(sid):
    """Handle client disconnect."""
    log.debug(f"StatusSocket client disconnected {sid}")


@sio.on("*", namespace="/status")  # type: ignore
async def any_event(event, sid, data):
    log.debug(f"StatusSocket sid {sid} undhandled event {event} with data {data}")


def register_status():
    # we need this to at least allow loading the module at the right time
    pass
