from typing import Callable

import socketio


class TypedAsyncServer(socketio.AsyncServer):
    def on(  # type: ignore
        self, event, namespace=None
    ):  # -> Callable[..., Any]:# -> Callable[..., Any]:
        def decorator(handler: Callable):
            return super().on(event, namespace)(handler)  # type: ignore

        return decorator


sio = TypedAsyncServer(
    async_mode="asgi",
    logger=False,
    engineio_logger=False,
    cors_allowed_origins="*",
)


def register_socketio(app):
    app.asgi_app = socketio.ASGIApp(sio, app.asgi_app)

    # Register all socketio namespaces
    from .importer import register_importer
    from .status import register_status
    from .terminal import register_tmux

    register_importer()
    register_tmux()
    register_status()
