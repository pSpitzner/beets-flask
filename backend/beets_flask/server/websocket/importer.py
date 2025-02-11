import asyncio
from typing import Union

from socketio import AsyncServer

from beets_flask.importer import (
    ChoiceReceive,
    CompleteReceive,
    InteractiveImportSession,
    SessionState,
    WebsocketCommunicator,
)
from beets_flask.logger import log

from . import sio
from .errors import sio_catch_expection

namespace = "/import"
session: InteractiveImportSession | None = None
session_task: asyncio.Task | None = None


@sio.on("connect", namespace=namespace)
async def connect(sid, *args):
    log.debug(f"ImportSocket sid {sid} connected")


@sio.on("disconnect", namespace=namespace)
async def disconnect(sid):
    log.debug(f"ImportSocket sid {sid} disconnected")


@sio.on("get_state", namespace=namespace)
async def get_state(sid):
    """Get the current state of the import session.

    Returns data via callback
    """
    log.debug(f"received get_state")
    if session is not None:
        return session.communicator.state.serialize()
    else:
        return None


@sio.on("*", namespace=namespace)
async def any_event(event, sid, data):
    log.warning(f"ImportSocket sid {sid} unhandled event {event} with data {data}")


@sio.on("start_import_session", namespace=namespace)
async def start_import_session(sid, data):
    """Start a new interactive import session.

    We shall only have one running at a time (for now).
    This will kill any existing session.
    """
    global session, session_task
    path = data.get("path", None)

    if session_task is not None:
        session_task.cancel()
        session_task = None

    state = SessionState()
    communicator = WebsocketCommunicator(state, sio, namespace)
    session = InteractiveImportSession(
        state=state, communicator=communicator, path=path
    )

    async def run_session():
        global session, session_task
        if session is None:
            log.error("Session is None, this should not happen.")
            return
        await session.run_async()
        # cleanup when done
        session = None
        session_task = None

    session_task = asyncio.create_task(run_session())
    # session_task = sio.start_background_task(session.run)

    return True


@sio.on("abort_import_session", namespace=namespace)
async def abort_session(sid):
    global session, session_task

    if session_task is not None:
        session_task.cancel()
        session_task = None
        session = None

    await sio.emit("abort", namespace=namespace, skip_sid=sid)

    return True


@sio.on("user_action", namespace=namespace)
async def choice(sid, req: Union[ChoiceReceive, CompleteReceive]):
    """Handle user action.

    Triggers when a user has made a choice via the frontend -> Pass it to the session.
    """
    global session

    if not session is None:
        ret_val = await session.communicator.received_request(req)
        # Remit state
        await session.communicator.emit_state_async(session.state, skip_sid=sid)
        return ret_val
    else:
        return False


def register_importer():
    # we need this to at least allow loading the module at the right time
    pass
