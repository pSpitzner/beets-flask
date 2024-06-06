import os

from flask import Flask
from flask_cors import CORS
from .redis import rq

from .db_engine import setup_db

from .logger import log


def create_app():

    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)

    # CORS needed for Dev so vite can talk to the backend
    CORS(app)

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
    from .routes.backend import backend_bp
    from .routes.frontend import frontend_bp

    app.register_blueprint(backend_bp)
    app.register_blueprint(frontend_bp)

    log.info("App created")

    return app
