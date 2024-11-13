from __future__ import annotations

import os
from typing import TYPE_CHECKING

from flask import Flask
from flask_cors import CORS

from .config.flask_config import ServerConfig, init_server_config
from .database import setup_database
from .logger import log

if TYPE_CHECKING:
    from .config.flask_config import ServerConfig


def create_app(config: str | ServerConfig | None = None) -> Flask:

    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    # CORS needed for Dev so vite can talk to the backend
    CORS(app)

    config = init_server_config(config)
    app.config.from_object(config)

    global socketio
    # app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)

    # sqlite
    setup_database(app)

    # Register blueprints
    from beets_flask.routes import backend_bp

    from .routes import frontend_bp

    app.register_blueprint(backend_bp)
    app.register_blueprint(frontend_bp)

    # Start websocket for realtime Terminal and status updates
    from .websocket import register_socketio

    register_socketio(app)

    from .websocket.importer import register_importer
    from .websocket.terminal import register_tmux
    from .websocket.status import register_status

    register_tmux()
    register_importer()
    register_status()

    from .inbox import register_inboxes

    register_inboxes()

    from .invoker import delete_tags

    delete_tags(with_status=["pending", "tagging", "importing"])

    log.debug("App created")

    return app
