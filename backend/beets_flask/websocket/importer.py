from typing import Union

from socketio import AsyncServer

from beets_flask.importer import (
    ChoiceReceive,
    CompleteReceive,
    ImportCommunicator,
    ImportState,
    InteractiveImportSession,
)
from beets_flask.logger import log
from beets_flask.websocket import sio

log.debug("ImportSocket module loaded")
namespace = "/import"
session: InteractiveImportSession | None = None
session_ref = None


@sio.on("connect", namespace=namespace)
async def connect(sid, environ):
    """Handle new client connected."""
    log.debug(f"ImportSocket new client connected {sid}")


@sio.on("disconnect", namespace=namespace)
async def disconnect(sid):
    """Handle client disconnect."""
    log.debug(f"ImportSocket client disconnected {sid}")


@sio.on("get_state", namespace=namespace)
async def get_state(sid):
    """Get the current state of the import session.

    Returns data via callback
    """
    if session is not None:
        return session.communicator.state.serialize()
    else:
        return None


@sio.on("*", namespace=namespace)
async def any_event(event, sid, data):
    log.error(f"ImportSocket sid {sid} unhandled event {event} with data {data}")


@sio.on("start_import_session", namespace=namespace)
async def start_import_session(sid, data):
    """Start a new interactive import session.

    We shall only have one running at a time (for now).
    This will kill any existing session.
    """
    global session, session_ref

    log.debug(f"received start_import_session {data=}")
    path = data.get("path", None)

    try:
        session_ref.kill()  # type: ignore
    except AttributeError:
        pass

    def cleanup():
        global session, session_ref
        session = None
        session_ref = None

    state = ImportState()
    communicator = WebsocketCommunicator(state, sio)
    session = InteractiveImportSession(state, communicator, path=path, cleanup=cleanup)
    await communicator.emit_current()

    session_ref = sio.start_background_task(session.run)

    return True


@sio.on("abort_import_session", namespace=namespace)
async def abort_session(sid):
    global session, session_ref

    try:
        session_ref.kill()  # type: ignore
    except AttributeError:
        pass

    if session is not None and session.cleanup is not None:
        session.cleanup()

    await sio.emit("abort", namespace=namespace, skip_sid=sid)

    return True


@sio.on("user_action", namespace=namespace)
async def choice(sid, req: Union[ChoiceReceive, CompleteReceive]):
    """Handle user action.

    Triggers when a user has made a choice via the frontend -> Pass it to the session.
    """
    global session

    log.debug(f"received user action {req=}")

    if not session is None:
        ret_val = await session.communicator.received_request(req)
        # Remit state
        await session.communicator.emit_state(session.import_state, skip_sid=sid)
        return ret_val
    else:
        return False


class WebsocketCommunicator(ImportCommunicator):
    """Communicator for the websocket.

    Forwards imports via websockets from the frontend to our
    backend import logic.
    """

    sio: AsyncServer

    def __init__(self, state: ImportState, sio: AsyncServer):
        self.sio = sio
        super().__init__(state)

    async def _emit(self, req, **kwargs) -> None:
        # TODO Hardcoded namespace for now
        await self.sio.emit(req["event"], req, namespace=namespace, **kwargs)


def register_importer():
    # we need this to at least allow loading the module at the right time
    pass
