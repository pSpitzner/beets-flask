import os

from flask import Flask, g
from flask_cors import CORS
from flask_socketio import SocketIO
from .redis import rq

from .db_engine import setup_db

from .logger import log

# socketio = SocketIO(cors_allowed_origins="*",logger=True, engineio_logger=True)
socketio = None


def create_app():

    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    # CORS needed for Dev so vite can talk to the backend
    CORS(app)

    global socketio
    app.config['SECRET_KEY'] = 'your-secret-key'
    socketio = SocketIO()
    # socketio.init_app(
    #     app,
    #     cors_allowed_origins="*",
    #     async_mode="eventlet",
    #     ping_timeout=5,
    #     ping_interval=5,
    #     logger=True,
    #     engineio_logger=True,
    #     message_queue="redis://",
    # )
    socketio.init_app(
        app,
        cors_allowed_origins="*",
        async_mode="eventlet",
        ping_timeout=5,
        ping_interval=5,
        message_queue="redis://localhost",
    )

    # Setting this is important otherwise your raised
    # exception will just generate a regular exception
    app.config["PROPAGATE_EXCEPTIONS"] = True

    # sqlite
    setup_db(app)

    # redis, workers
    rq.init_app(app)
    # we want to update the download table only when needed.
    # redis connection also needed for sse
    app.config["REDIS_URL"] = "redis://localhost"

    # Register blueprints
    from .routes.backend import backend_bp, backend_socketio
    from .routes.frontend import frontend_bp

    app.register_blueprint(backend_bp)
    app.register_blueprint(frontend_bp)

    # Register socketio namespaces
    for url, namespace in backend_socketio.items():
        socketio.on_namespace(namespace(url))

    log.info("App created")
    # socketio.run(app, port=5001, host="0.0.0.0")

    return app
