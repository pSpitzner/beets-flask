from __future__ import annotations
from typing import Self
from sqlalchemy import select
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    __abstract__ = True

    @classmethod
    def get_by(cls, *whereclause) -> Self:
        from ..db_engine import db_session

        stmt = select(cls).where(*whereclause)
        item = db_session().execute(stmt).scalars().first()

        if item is None:
            raise ValueError(f"No item found for {whereclause} in {cls.__name__}")
        return item
