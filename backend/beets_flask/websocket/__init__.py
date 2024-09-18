import socketio

sio: socketio.Server = socketio.Server(
    async_mode="eventlet",
    logger=False,
    engineio_logger=False,
    cors_allowed_origins="*",
)


def register_socketio(app):
    app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)
