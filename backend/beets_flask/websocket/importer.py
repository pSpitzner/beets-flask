from beets_flask.importer import (
    ImportState,
    InteractiveImportSession,
    types,
    ImportCommunicator,
)
from beets_flask.logger import log
from beets_flask.websocket import sio

from socketio import Server


log.debug("ImportSocket module loaded")
namespace = "/import"
session: InteractiveImportSession | None = None
session_ref = None


@sio.on("connect", namespace=namespace)  # type: ignore
def connect(sid, environ):
    """new client connected"""
    log.debug(f"ImportSocket new client connected {sid}")


@sio.on("after_connect", namespace=namespace)  # type: ignore
def after_connect(sid):
    """This needs to be invoked by a callback of the client"""
    if session is not None:
        session.communicator.emit_all()


@sio.on("disconnect", namespace=namespace)  # type: ignore
def disconnect(sid):
    """client disconnected"""
    log.debug(f"ImportSocket client disconnected {sid}")


@sio.on("*", namespace=namespace)  # type: ignore
def any_event(event, sid, data):
    log.debug(f"ImportSocket sid {sid} undhandled event {event} with data {data}")


@sio.on("start_import_session", namespace=namespace)  # type: ignore
def start_import_session(sid, data):
    """
    Start a new interactive import session. We shall only have one running at a time.
    """
    global session, session_ref

    log.debug(f"received start_import_session {data=}")
    path = data.get("path", None)

    try:
        session_ref.kill()  # type: ignore
    except AttributeError:
        pass

    # Create a new session
    state = ImportState()
    communicator = WebsocketCommunicator(state, sio)
    session = InteractiveImportSession(state, communicator, path=path)

    session_ref = sio.start_background_task(session.run)


@sio.on("choice", namespace=namespace)  # type: ignore
def choice(sid, req: types.ChoiceRequest):
    """
    User has made a choice. Pass it to the session.
    """
    global session

    if not session is None:
        session.communicator.received_request(req)


@sio.on("complete", namespace=namespace)  # type: ignore
def completed(sid, req: types.CompleteRequest):
    """
    User has completed a selection. Pass it to the session.
    """
    global session

    if not session is None:
        session.communicator.received_request(req)


class WebsocketCommunicator(ImportCommunicator):
    sio: Server

    def __init__(self, state: ImportState, sio: Server):
        self.sio = sio
        super().__init__(state)

    def _emit(self, req) -> None:
        log.debug(f"WebsocketCommunicator._emit {req=}")
        # TODO Hardcoded namespace for now
        self.sio.emit(req["event"], req, namespace=namespace)


def register_importer():
    # we need this to at least allow loading the module at the right time
    pass
