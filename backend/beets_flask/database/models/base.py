from __future__ import annotations
from typing import Self
from sqlalchemy import select
from sqlalchemy.orm import DeclarativeBase, Session

from beets_flask.logger import log


class Base(DeclarativeBase):
    __abstract__ = True

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
