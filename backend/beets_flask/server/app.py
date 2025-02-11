from __future__ import annotations

from typing import TYPE_CHECKING

from quart import Quart

from ..config.flask_config import ServerConfig, init_server_config
from ..logger import log

if TYPE_CHECKING:
    from ..config.flask_config import ServerConfig


def create_app(config: str | ServerConfig | None = None) -> Quart:

    # create and configure the app
    app = Quart(__name__, instance_relative_config=True)

    config = init_server_config(config)
    app.config.from_object(config)
    # make routes with and without trailing slahes the same
    app.url_map.strict_slashes = False

    global socketio
    # app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)

    # sqlite
    from ..database import setup_database

    setup_database(app)

    # Register different blueprints & websocket routes
    from .routes import register_routes
    from .websocket import register_socketio

    register_routes(app)
    register_socketio(app)

    from ..inbox import register_inboxes

    register_inboxes()

    from ..invoker import delete_tags

    delete_tags(with_status=["pending", "tagging", "importing"])

    log.debug("Quart app created!")

    return app
