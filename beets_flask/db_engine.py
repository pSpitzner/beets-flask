from flask import Flask
from .models import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session


engine = create_engine("sqlite://///home/beetle/beets-flask-sqlite.db?timeout=5")

db_session = scoped_session(sessionmaker(bind=engine))


def create_tables(engine) -> None:
    Base.metadata.create_all(bind=engine)


def setup_db(app: Flask) -> None:

    create_tables(engine)

    # Gracefully shutdown the database session
    @app.teardown_appcontext
    def shutdown_session(exception=None) -> None:
        db_session.remove()
