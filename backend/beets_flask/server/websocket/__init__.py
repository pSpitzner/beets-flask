import os
from collections.abc import Callable
from typing import cast

import socketio

old_on = socketio.AsyncServer.on


# Gets rid of the type error in the decorator
class TypedAsyncServer(socketio.AsyncServer):
    def on(self, event: str, namespace: str | None = None) -> Callable: ...  # type: ignore


if os.environ.get("PYTEST_CURRENT_TEST", ""):
    client_manager = None
else:
    client_manager = socketio.AsyncRedisManager("redis://")

sio: TypedAsyncServer = cast(
    TypedAsyncServer,
    socketio.AsyncServer(
        async_mode="asgi",
        logger=False,
        engineio_logger=False,
        cors_allowed_origins="*",
        client_manager=client_manager,
    ),
)


def register_socketio(app):
    app.asgi_app = socketio.ASGIApp(sio, app.asgi_app, socketio_path="/socket.io")

    # Register all socketio namespaces
    from .status import register_status
    from .terminal import register_tmux

    register_tmux()
    register_status()
