import os

from flask import Flask
from flask_rq2 import RQ
from flask_sqlalchemy import SQLAlchemy
from .logging import setup_logging


def create_app():

    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)

    # Setup logging
    setup_logging(app)

    # sqlite
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        "sqlite://///home/beetle/beets-flask-sqlite.db?timeout=5"
    )
    db = SQLAlchemy()
    db.init_app(app)

    # redis, workers
    rq = RQ()
    rq.init_app(app)
    # we want to update the download table only when needed.
    # redis connection also needed for sse
    app.config["REDIS_URL"] = "redis://localhost"

    # Register blueprints
    from .backend import backend_bp
    from .frontend import frontend_bp

    app.register_blueprint(backend_bp)
    app.register_blueprint(frontend_bp)

    return app, db, rq
