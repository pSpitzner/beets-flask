from contextlib import contextmanager
from functools import wraps

from flask import Flask
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, scoped_session, sessionmaker

from ..logger import log
from .models import Base, Tag, TagGroup

engine: Engine
session_factory: scoped_session[Session]


def setup_database(app: Flask) -> None:
    """
    Sets up the database connection and session factory for the Quart application.

    This function initializes the global `engine` and `session_factory` variables
    using the database URI specified in the application's configuration. It also
    sets up a teardown hook to gracefully close the database session when the
    application context is torn down.

    Args:
        app (Quart): The Quart application instance.

    Returns
    -------
        None
    """
    global engine
    global session_factory

    engine = create_engine(app.config["DATABASE_URI"])
    session_factory = scoped_session(sessionmaker(bind=engine))

    if app.config["RESET_DB_ON_START"]:
        log.warning("Resetting database due to RESET_DB=True in config")
        _reset_database()

    _create_tables(engine)

    # Gracefully shutdown the database session
    @app.teardown_appcontext
    def shutdown_session(exception=None) -> None:
        session_factory.remove()


@contextmanager
def db_session(session: Session | None = None):
    """
    Use a db session as context, making sure sessions are closed at the end.
    If an existing session is provided, it will not be closed at the end.
    This allows to wrap multiple `with db_session()` blocks around each other without closing the outer session.

    Example:
    ```
    with db_session() as session:
        tag.foo = "bar"
        session.merge(tag)
        return tag.to_dict()

    existingSession = session_factory()
    with db_session(session) as s:
        tag.foo = "bar"
        s.merge(tag)
        return tag.to_dict()
    ```
    """
    is_outermost = session is None
    if is_outermost:
        session = session_factory()
    try:
        yield session
        session.commit()
    except:
        session.rollback()
        raise
    finally:
        if is_outermost:
            session.close()


def with_db_session(func):
    """
    Decorator to provide a db session as a keyword argument to the function.

    Example
    ```
    @with_db_session
    def my_function(session=None):
        tag.foo = "bar"
        session.merge(tag)
        return tag.to_dict()
    ```
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        with db_session() as session:
            kwargs.setdefault("session", session)
            return func(*args, **kwargs)

    return wrapper


def _create_tables(engine) -> None:
    Base.metadata.create_all(bind=engine)


def _reset_database():
    with db_session() as session:
        try:
            session.query(TagGroup).delete()
            session.query(Tag).delete()
            session.commit()
        except Exception as e:
            log.warning(f"Error resetting database: {e}")
