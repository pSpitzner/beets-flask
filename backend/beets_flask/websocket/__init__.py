import socketio

sio: socketio.AsyncServer = socketio.AsyncServer(
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
