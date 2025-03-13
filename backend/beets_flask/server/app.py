from __future__ import annotations

import json
import os
from dataclasses import asdict, is_dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any

from quart import Quart

from ..config.flask_config import ServerConfig, init_server_config
from ..logger import log

if TYPE_CHECKING:
    from ..config.flask_config import ServerConfig


def create_app(config: str | ServerConfig | None = None) -> Quart:
    config = config or os.getenv("BEETSFLASK_ENV", None)
    # create and configure the app
    app = Quart(__name__, instance_relative_config=True)

    config = init_server_config(config)
    app.config.from_object(config)
    # make routes with and without trailing slahes the same
    app.url_map.strict_slashes = False
    app.json = CustomProvider(app)

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


# ------------------------------- Json encoder ------------------------------- #
# Allows to serialize bytes and datetime objects in dictionaries to json
# The default encoder does not support this!
# Has to be added to the app with app.json = CustomProvider(app)
# FIXME: We might be able to remove this once our serialized state does not
# contain bytes or datetime objects

from enum import Enum

from quart.json.provider import DefaultJSONProvider


class CustomProvider(DefaultJSONProvider):
    def dumps(self, obj: Any, **kwargs: Any) -> str:
        return json.dumps(obj, cls=Encoder, **kwargs)


class Encoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, bytes):
            # Mainly used for paths
            # b'/path/to/file' -> '/path/to/file'
            # Might yield strange results for other byte objects
            return o.decode("utf-8")

        if isinstance(o, datetime):
            return o.isoformat()

        # Dataclasses are not serializable by default
        if is_dataclass(o) and not isinstance(o, type):
            return asdict(o)

        # Enum values are not serializable by default
        if isinstance(o, Enum):
            return o.name

        return json.JSONEncoder.default(self, o)
