import os

from flask import Flask
from flask_cors import CORS

# make sure to load our config first, because it modifies the beets config
from .config import config
from .db_engine import setup_db

from .logger import log


def create_app():

    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    # CORS needed for Dev so vite can talk to the backend
    CORS(app)

    global socketio
    app.config["SECRET_KEY"] = "your-secret-key"
    # app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)

    # Setting this is important otherwise your raised
    # exception will just generate a regular exception
    app.config["PROPAGATE_EXCEPTIONS"] = True

    # sqlite
    setup_db(app)

    # redis, workers
    # rq.init_app(app)
    # we want to update the tag table only when needed.
    # redis connection also needed for sse
    app.config["REDIS_URL"] = "redis://localhost"

    # Register blueprints
    from .routes import backend_bp
    from .routes import frontend_bp

    app.register_blueprint(backend_bp)
    app.register_blueprint(frontend_bp)

    # Start websocket for realtime Terminal and status updates
    from .websocket import register_socketio

    register_socketio(app)

    from .websocket.terminal import register_tmux
    from .websocket.importer import register_importer

    register_tmux()
    register_importer()

    from .inbox import register_inboxes

    register_inboxes()

    from .invoker import delete_tags

    delete_tags(with_status=["pending", "tagging", "importing"])

    log.debug("App created")

    return app
