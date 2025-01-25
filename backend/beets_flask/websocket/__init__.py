import socketio

sio: socketio.Server = socketio.Server(
    logger=False,
    engineio_logger=False,
    cors_allowed_origins="*",
)


def register_socketio(app):
    app.asgi_app = socketio.ASGIApp(sio, app.asgi_app)
