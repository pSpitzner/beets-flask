from __future__ import annotations

from typing import TYPE_CHECKING

from flask import Flask
from flask_cors import CORS

from beets_flask.config.flask_config import ServerConfig

# make sure to load our config first, because it modifies the beets config
from .database import setup_database
from .logger import log

if TYPE_CHECKING:
    from .config.flask_config import ServerConfig


def create_app(config: str | ServerConfig = None) -> Flask:

    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    # CORS needed for Dev so vite can talk to the backend
    CORS(app)

    # Parse config
    if config is None:
        config = os.environ.get("IB_SERVER_CONFIG", "dev_local")
    switch = {
        "dev_local": "beets_flask.config.DevelopmentLocal",
        "dev_docker": "beets_flask.config.DevelopmentDocker",
        "test": "beets_flask.config.Testing",
        "prod": "beets_flask.config.DeploymentDocker",
    }

    log.info(f"Creating app with config '{config}'")

    if isinstance(config, str) and config not in switch:
        raise ValueError(f"Invalid config: {config}")
    elif isinstance(config, ServerConfig):
        app.config.from_object(config)
    else:
        app.config.from_object(switch[config])

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

    register_tmux()
    register_importer()

    from .inbox import register_inboxes

    register_inboxes()

    from .invoker import delete_tags

    delete_tags(with_status=["pending", "tagging", "importing"])

    log.debug("App created")

    return app
