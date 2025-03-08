from __future__ import annotations

from datetime import datetime
from typing import Any, List, Mapping, Self, Sequence, TypedDict
from uuid import uuid4

from beets.importer import ImportTask, library
from sqlalchemy import Index, LargeBinary, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    registry,
)
from sqlalchemy.sql import func

from beets_flask.logger import log


class Base(DeclarativeBase):
    __abstract__ = True

    registry = registry(type_annotation_map={bytes: LargeBinary})

    id: Mapped[str] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now()
    )

    def __init__(self, id: str | None = None):
        self.id = str(id) if id is not None else str(uuid4())

    @classmethod
    def get_by(cls, *whereclause, session: Session | None = None) -> Self | None:
        close_after = False
        if session is None:
            log.debug(
                "No session provided, you will not be able to make changes to the database."
            )
            close_after = True
            from beets_flask.database.setup import session_factory

            session = session_factory()

        try:
            stmt = select(cls).where(*whereclause)
            item = session.execute(stmt).scalars().first()
            return item
        except:
            raise
        finally:
            if close_after:
                session.close()

    @classmethod
    def get_all_by(cls, *whereclause, session: Session | None = None) -> Sequence[Self]:
        close_after = False
        if session is None:
            log.debug(
                "No session provided, you will not be able to make changes to the database."
            )
            close_after = True
            from beets_flask.database.setup import session_factory

            session = session_factory()

        try:
            stmt = select(cls).where(*whereclause)
            item = session.execute(stmt).scalars().all()
            return item
        except:
            raise
        finally:
            if close_after:
                session.close()

    @classmethod
    def get_by_raise(cls, *whereclause, session: Session | None = None) -> Self:
        """Get an item by whereclause or raise ValueError if not found."""
        item = cls.get_by(*whereclause, session=session)
        if item is None:
            raise ValueError(f"{cls.__name__} not found.")
        return item

    def to_dict(self) -> Mapping:
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
