from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime
import glob
import os
from uuid import uuid4 as uuid
from datetime import datetime

from sqlalchemy import ForeignKey, select
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm.session import make_transient

from .base import Base
from .tag_group import TagGroup

from beets_flask.utility import log, AUDIO_EXTENSIONS
from beets_flask.beets_sessions import PreviewSession, MatchedImportSession


class Tag(Base):
    __tablename__ = "tag"

    # we might consider to use folders as ids:
    # for now we want to allow only one tag per folder.
    id: Mapped[str] = mapped_column(primary_key=True)
    album_folder: Mapped[str]
    album_folder_basename: Mapped[str]

    status: Mapped[str]
    kind: Mapped[str]
    kind: Mapped[str]
    _valid_statuses = [
        "dummy",
        "pending",
        "tagging",
        "tagged",
        "importing",
        "imported",
        "failed",
        "unmatched",
        "duplicate",
    ]
    _valid_kinds = [
        "preview",
        "import",
        "auto",  # generates a preview, and depending on user config, imports if good match
    ]

    # we could alternatively handle this by allowing multiple tag groups
    archived: Mapped[bool] = mapped_column(default=False)

    _group_id: Mapped[str] = mapped_column(ForeignKey("tag_group.id"))
    _tag_group: Mapped[TagGroup] = relationship(back_populates="tag_ids")

    distance: Mapped[Optional[float]]
    match_url: Mapped[Optional[str]]
    match_album: Mapped[Optional[str]]
    match_artist: Mapped[Optional[str]]
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
        self.album_folder_basename = str(os.path.basename(album_folder))
        self.id = str(id) if id is not None else str(uuid())
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.group_id = group_id or "Unsorted"
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

    def eligible_track_paths(self):
        files = glob.glob(str(self.album_folder) + "/**/*")
        files = [f for f in files if f.lower().endswith(AUDIO_EXTENSIONS)]
        return files

    @property
    def group(self):
        # this is just convenience. we mainly use group_id
        return self._tag_group

    @property
    def group_id(self):
        return self._group_id

    @group_id.setter
    def group_id(self, group_id):
        from beets_flask.db_engine import db_session

        with db_session() as session:
            tag_group = session.query(TagGroup).filter_by(id=group_id).first()
            if not tag_group:
                tag_group = TagGroup(id=group_id)
                session.add(tag_group)
                session.commit()

            self._group_id = group_id
            self._tag_group = tag_group

    def to_dict(self):
        data = {c.name: getattr(self, c.name) for c in self.__table__.columns}  # type: ignore
        data["track_paths_after"] = self.track_paths_after
        data["track_paths_before"] = self.track_paths_before
        data["group_id"] = self.group_id

        return data

    def make_transient(self):
        make_transient(self)
        return self
