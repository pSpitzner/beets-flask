from __future__ import annotations

from typing import TYPE_CHECKING, List
from uuid import uuid4 as uuid

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm.session import make_transient

from .base import Base

if TYPE_CHECKING:
    from .tag import Tag


class TagGroup(Base):
    __tablename__ = "tag_group"

    # for now, group ids are just their name
    id: Mapped[str] = mapped_column(primary_key=True)
    tag_ids: Mapped[List[Tag]] = relationship(back_populates="_tag_group")

    def __init__(self, id=None):
        self.id = str(id) if id is not None else str(uuid())

    """
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
    """

    def to_dict(self):
        return {"id": self.id, "tag_ids": [t.id for t in self.tag_ids]}  # type: ignore

    def make_transient(self):
        make_transient(self)
        return self

    @staticmethod
    def as_dict_from_list(id: str, tag_ids: List[str]):
        # not doing much for now, but its good to keep it here if taggroups grow.
        return {"id": id, "tag_ids": tag_ids}
