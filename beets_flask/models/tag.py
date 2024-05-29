from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime
import glob
import os
from uuid import uuid4 as uuid
from datetime import datetime
import requests
from sqlalchemy import ForeignKey, select
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm.session import make_transient

from .base import Base
from .tag_group import TagGroup

from ..utility import log, AUDIO_EXTENSIONS
from ..beets_sessions import PreviewSession, MatchedImportSession

from ..redis import rq


class Tag(Base):
    __tablename__ = "tag"

    # we might consider to use folders as ids:
    # for now we want to allow only one tag per folder.
    id: Mapped[str] = mapped_column(primary_key=True)
    album_folder: Mapped[str]

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

    def eligible_track_paths(self):
        files = glob.glob(str(self.album_folder) + "/**/*")
        files = [f for f in files if f.lower().endswith(AUDIO_EXTENSIONS)]
        return files

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

    def commit(self):
        from ..db_engine import db_session

        session = db_session()
        try:
            session.merge(self)
            session.commit()
        except Exception as e:
            # deletions outside the worker may cause inconsistencies.
            log.error(f"Failed to commit tag: {e}", exc_info=True)
            session.rollback()
        finally:
            session.close()

    def make_transient(self):
        make_transient(self)
        return self

    def enqueue(self):
        """Enqueue the tag for processing

        TODO: This should be moved to a task queue file or something similar
        """

        if self.kind is None or self.kind.lower() not in ["preview", "import"]:
            log.debug(f"invalid kind {self.kind=}")
            raise ValueError(f"Invalid kind: {self.kind}")

        self.status = "pending"
        self.track_paths = self.eligible_track_paths()
        self.updated_at = datetime.now()
        self.commit()

        # TODO: react statue updates
        # ut.update_client_view("tags")

        log.info(f"Queuing {self}")
        if str(self.kind).lower() == "preview":
            rq.get_queue("preview").enqueue(preview_task, self.id)
        elif str(self.kind).lower() == "import":
            rq.get_queue("import").enqueue(import_task, self.id)
        else:
            log.debug(f"Invalid task {self.kind}")

    def __repr__(self):
        return f"<Tag {self.id}-{self.album_folder} ({self.kind})>"


@rq.job(timeout=600)
def preview_task(
    id: str, callback_url: str | None = None, update_meta: bool = True
) -> str | None:
    """Run a preview on an existing tag.

    Args:
        id (str): tag id, needs to exist in sql db
        callback_url (str, optional): called on success/failure. Defaults to None.
        update_meta (bool, optional): whether to update database metadata. Defaults to True.

    Returns:
        str: the match url, if we found one, else None.
    """
    from ..db_engine import db_session

    log.debug(f"Preview task on {id}")

    session = db_session()
    bt = Tag.get_by(Tag.id == id)
    bt.kind = "preview"
    bt.status = "tagging"
    bt.updated_at = datetime.now()
    if update_meta:
        bt.commit()
        # ut.update_client_view("tags")

    try:
        bs = PreviewSession(path=bt.album_folder)
        bs.run_and_capture_output()

        bt.preview = bs.preview
        bt.distance = bs.match_dist
        bt.match_url = bs.match_url
        bt.num_tracks = bs.match_num_tracks
        bt.status = (
            "tagged"
            if (bt.match_url is not None and bs.status == "ok")
            else "unmatched"
        )
    except Exception as e:
        log.debug(e)
        bt.status = "failed"
        if callback_url:
            requests.post(
                callback_url,
                json={"status": "beets preview failed", "tag": bt.to_dict()},
            )
        return None
    finally:
        bt.updated_at = datetime.now()
        if update_meta:
            bt.commit()
            # ut.update_client_view("tags")

    if callback_url:
        requests.post(
            callback_url,
            json={"status": "beets preview done", "tag": bt.to_dict()},
        )

    # cleanup_status()
    match_url = bt.match_url
    if not update_meta:
        session.rollback()
    session.close()

    return match_url


@rq.job(timeout=600)
def import_task(
    id: str, match_url: str | None = None, callback_url: str | None = None
) -> str | None:
    """Import task for a tag.
    Relies on the preview task to have been run before.
    If it was not, we do it here (blocking the import thread).
    We do not import of no match is found according to your beets config.

    Args:
        id (str): tag id, needs to exist in sql db
        callback_url (str | None, optional): called on status change. Defaults to None.
    """

    log.debug(f"Import task on {id}")

    bt = Tag.get_by(Tag.id == id)
    bt.kind = "import"
    bt.updated_at = datetime.now()
    bt.commit()

    match_url = match_url or _get_or_gen_match_url(id)
    if not match_url:
        if callback_url:
            requests.post(
                callback_url,
                json={
                    "status": "beets import failed: no match url found.",
                    "tag": bt.to_dict(),
                },
            )
        return None

    try:
        bs = MatchedImportSession(path=bt.album_folder, match_url=match_url)
        bs.run_and_capture_output()

        bt.preview = bs.preview
        bt.distance = bs.match_dist
        bt.match_url = bs.match_url
        bt.num_tracks = bs.match_num_tracks
        bt.status = "imported" if bs.status == "ok" else "failed"
    except Exception as e:
        log.debug(e)
        bt.status = "failed"
        if callback_url:
            requests.post(
                callback_url,
                json={"status": "beets import failed", "tag": bt.to_dict()},
            )
        return None
    finally:
        bt.updated_at = datetime.now()
        bt.commit()
        # ut.update_client_view("tags")

    if callback_url:
        requests.post(
            callback_url,
            json={"status": "beets preview done", "tag": bt.to_dict()},
        )

    # cleanup_status()

    try:
        album_folder = os.path.commonpath(bt.track_paths_after)
    except Exception as e:
        # when the import task had an issue, track_paths_after might be an empty list
        album_folder = None
    return album_folder


def _get_or_gen_match_url(id: str) -> str | None:
    bt = Tag.get_by(Tag.id == id)

    if bt.match_url is not None:
        log.debug(f"Match url already exists for {bt.album_folder}: {bt.match_url}")
        return bt.match_url
    if bt.distance is None:
        log.debug(f"No unique match for {bt.album_folder}: {bt.match_url}")
        # preview task was run but no match found.
        return None

    log.debug(
        f"Running preview task to get match url for {bt.album_folder}: {bt.match_url}"
    )
    return preview_task(id, update_meta=False)
