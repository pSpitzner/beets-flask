from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime
import glob
import os
from uuid import uuid4 as uuid

from sqlalchemy import ForeignKey, select
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm.session import make_transient

from .base import Base

from .tag_group import TagGroup


class Tag(Base):
    __tablename__ = "tag"

    id: Mapped[str] = mapped_column(primary_key=True)
    album_folder: Mapped[Optional[str]]

    status: Mapped[str]
    kind: Mapped[str]

    _group_id: Mapped[str] = mapped_column(ForeignKey("tag_group.id"))
    tag_group: Mapped[TagGroup] = relationship(back_populates="tag_ids")

    distance: Mapped[Optional[float]]
    match_url: Mapped[Optional[str]]
    preview: Mapped[Optional[str]]
    num_tracks: Mapped[Optional[int]]

    # Time stamps
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    # the track list we keep ourselves
    _track_paths: Mapped[Optional[str]]
    _track_paths_before: Mapped[Optional[str]]
    _track_paths_after: Mapped[Optional[str]]

    def __init__(
        self,
        album_folder: str,
        kind: str,
        id: Optional[str] = None,
        group_id=None,
        distance=None,
        match_url=None,
        status=None,
        num_tracks=None,
        preview=None,
        track_paths_before=None,
        track_paths_after=None,
    ):
        self.album_folder = album_folder
        self.id = str(id) if id is not None else str(uuid())
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self._group_id = group_id or "Unsorted"
        self.distance = distance
        self.match_url = match_url
        self.status = status or "pending"
        self.num_tracks = num_tracks
        self.preview = (
            preview
            or f"Tagging {self.album_folder if self.album_folder else '...'} \n\n"
        )
        self.kind = kind
        self.track_paths_before = track_paths_before or []
        self.track_paths_after = track_paths_after or []
        # self.track_paths = self.eligible_track_paths()

    # parse list of strings as \n delimited. sqlite supports no lists.
    @property
    def track_paths_before(self):
        if self._track_paths_before is not None:
            return self._track_paths_before.split("\n")
        else:
            return []

    @property
    def track_paths_after(self):
        if self._track_paths_after is not None:
            return self._track_paths_after.split("\n")
        else:
            return []

    @property
    def track_paths(self):
        if self._track_paths is not None:
            return self._track_paths.split("\n")
        else:
            return []

    @track_paths_before.setter
    def track_paths_before(self, paths):
        self._track_paths_before = "\n".join(paths) if paths else None

    @track_paths_after.setter
    def track_paths_after(self, paths):
        self._track_paths_after = "\n".join(paths) if paths else None

    @track_paths.setter
    def track_paths(self, paths):
        self._track_paths = "\n".join(paths) if paths else None

    # def eligible_track_paths(self):
    #     files = glob.glob(str(self.album_folder) + "/**/*")
    #     files = [f for f in files if f.lower().endswith(ut.audio_extensions)]
    #     return files

    @property
    def group_id(self):
        return self._group_id

    # @group_id.setter
    # def group_id(self, id):
    #     tag_group = TagGroup.query.get(id)
    #     if tag_group is None:
    #         tag_group = TagGroup(id=id)
    #         tag_group.commit()
    #     self._group_id = tag_group.id

    @property
    def album_title(self):
        return os.path.basename(str(self.album_folder))

    def to_dict(self):
        data = {c.name: getattr(self, c.name) for c in self.__table__.columns}  # type: ignore
        data.pop("_track_paths_before")
        data.pop("_track_paths_after")
        data["track_paths_after"] = self.track_paths_after
        data["track_paths_before"] = self.track_paths_before
        return data

    """
    def commit(self):
        Session = sessionmaker(bind=ut.db.engine)
        session = Session()
        try:
            session.merge(self)
            session.commit()
        except Exception as e:
            # deletions outside the worker may cause inconsistencies.
            log.error(f"Failed to commit tag: {e}", exc_info=True)
            session.rollback()
        finally:
            session.close()
    """

    def make_transient(self):
        make_transient(self)
        return self
