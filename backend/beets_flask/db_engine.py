from flask import Flask
from .models import Base
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import sessionmaker, scoped_session, Session
from contextlib import contextmanager
from functools import wraps


engine : Engine = create_engine("sqlite://///home/beetle/beets-flask-sqlite.db?timeout=5")
db_session_factory = scoped_session(sessionmaker(bind=engine))

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

    existingSession = db_session_factory()
    with db_session(session) as s:
        tag.foo = "bar"
        s.merge(tag)
        return tag.to_dict()
    ```
    """
    is_outermost = session is None
    if is_outermost:
        session = db_session_factory()
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

def create_tables(engine) -> None:
    Base.metadata.create_all(bind=engine)


def setup_db(app: Flask) -> None:

    create_tables(engine)

    # Gracefully shutdown the database session
    @app.teardown_appcontext
    def shutdown_session(exception=None) -> None:
        db_session_factory.remove()


def reset_database():
    from beets_flask.models import Tag, TagGroup
    with db_session() as session:
        session.query(TagGroup).delete()
        session.query(Tag).delete()
        session.commit()
