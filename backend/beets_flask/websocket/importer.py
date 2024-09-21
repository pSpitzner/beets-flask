from typing import Union
from beets_flask.importer import (
    ImportState,
    InteractiveImportSession,
    ImportCommunicator,
    ChoiceReceive,
    CompleteReceive,
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


@sio.on("disconnect", namespace=namespace)  # type: ignore
def disconnect(sid):
    """client disconnected"""
    log.debug(f"ImportSocket client disconnected {sid}")


@sio.on("get_state", namespace=namespace)  # type: ignore
def get_state(sid):
    """This needs to be invoked by a callback of the client"""
    if session is not None:
        return session.communicator.state.serialize()
    else:
        return None


@sio.on("*", namespace=namespace)  # type: ignore
def any_event(event, sid, data):
    log.error(f"ImportSocket sid {sid} unhandled event {event} with data {data}")


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

    def cleanup():
        global session, session_ref
        session = None
        session_ref = None

    state = ImportState()
    communicator = WebsocketCommunicator(state, sio)
    session = InteractiveImportSession(state, communicator, path=path, cleanup=cleanup)

    session_ref = sio.start_background_task(session.run)

    return True


@sio.on("abort_import_session", namespace=namespace)  # type: ignore
def abort_session(sid):
    global session, session_ref

    try:
        session_ref.kill()  # type: ignore
    except AttributeError:
        pass

    if session is not None and session.cleanup is not None:
        session.cleanup()

    sio.emit("abort", namespace=namespace, skip_sid=sid)

    return True


@sio.on("user_action", namespace=namespace)  # type: ignore
def choice(sid, req: Union[ChoiceReceive, CompleteReceive]):
    """
    User has made a choice. Pass it to the session.
    """
    global session

    log.debug(f"received user action {req=}")

    if not session is None:
        ret_val = session.communicator.received_request(req)
        # Remit state
        session.communicator.emit_state(session.import_state, skip_sid=sid)
        return ret_val
    else:
        return False


class WebsocketCommunicator(ImportCommunicator):
    sio: Server

    def __init__(self, state: ImportState, sio: Server):
        self.sio = sio
        super().__init__(state)

    def _emit(self, req, **kwargs) -> None:
        # TODO Hardcoded namespace for now
        self.sio.emit(req["event"], req, namespace=namespace, **kwargs)


def register_importer():
    # we need this to at least allow loading the module at the right time
    pass
