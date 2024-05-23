from __future__ import annotations

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm.session import make_transient


from .base import Base


class TagGroup(Base):
    __tablename__ = "tag_group"

    id: Mapped[str] = mapped_column(primary_key=True)
    tag_ids = ut.db.relationship("Tag", backref="tag_group", lazy=True)

    def __init__(self, id=None):
        self.id = str(id) if id is not None else str(uuid())

    def commit(self):
        Session = sessionmaker(bind=ut.db.engine)
        session = Session()
        try:
            session.merge(self)
            session.commit()
        except Exception as e:
            # deletions outside the worker may cause inconsistencies.
            log.error(e)
        finally:
            session.close()

    def to_dict(self):
        return {"id": self.id, "tag_ids": [t.id for t in self.tag_ids]}  # type: ignore

    def make_transient(self):
        make_transient(self)
        return self
