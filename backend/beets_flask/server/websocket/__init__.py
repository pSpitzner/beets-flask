from typing import Callable, cast

import socketio

old_on = socketio.AsyncServer.on


# Gets rid of the type error in the decorator
class TypedAsyncServer(socketio.AsyncServer):
    def on(self, event: str, namespace: str | None = None) -> Callable: ...  # type: ignore


sio: TypedAsyncServer = cast(
    TypedAsyncServer,
    socketio.AsyncServer(
        async_mode="asgi",
        logger=False,
        engineio_logger=False,
        cors_allowed_origins="*",
    ),
)


def register_socketio(app):
    app.asgi_app = socketio.ASGIApp(sio, app.asgi_app, socketio_path="/socket.io")

    # Register all socketio namespaces
    from .status import register_status
    from .terminal import register_tmux

    register_tmux()
    register_status()
