import datetime
import glob
import os
from uuid import uuid4 as uuid
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm.session import make_transient
from sqlalchemy.orm import sessionmaker
from typing import TYPE_CHECKING

from . import disk
from . import beets_sessions
from . import utility as ut

log = ut.log

if TYPE_CHECKING:
    from sqlalchemy.orm import declarative_base

    BaseModel = declarative_base()
else:
    BaseModel = ut.db.Model


# dont forget to call this guy ini __init__.py
@ut.with_app_context
def init():
    # we cannot init db tables in utility because models are not known there
    ut.db.create_all()
    if os.environ.get("RQ_WORKER_ID", None):
        return

    log.info("Checking beets config:")
    errors = ""
    outs = ""
    out, err = beets_sessions.cli_command(
        [
            "config",
            f"-p",
        ]
    )
    outs += out
    errors += err

    out, err = beets_sessions.cli_command(["--version"])
    outs += out
    errors += err

    log.info(outs)
    if errors:
        log.error(f"{errors} Check your beets config!")


class Tag(BaseModel):
    id = Column(String, primary_key=True)
    album_folder = Column(String, nullable=False)
    task = Column(String)
    _group_id = Column(String, ForeignKey("tag_group.id"))
    distance = Column(Float)
    match_url = Column(String)
    preview = Column(String)
    status = Column(
        String
    )  # pending, tagging, tagged, importing, imported, cleared, failed, unmatched
    num_tracks = Column(Integer)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    # the track list we keep ourselves
    _track_paths = Column(String)
    # the track mapping beets creates
    _track_paths_before = Column(String)
    _track_paths_after = Column(String)

    def __init__(
        self,
        album_folder,
        task=None,
        id=None,
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
        self.created_at = datetime.datetime.now()
        self.updated_at = datetime.datetime.now()
        self.group_id = group_id or "Unsorted"
        self.distance = distance
        self.match_url = match_url
        self.status = status or "pending"
        self.num_tracks = num_tracks
        self.preview = (
            preview
            or f"Tagging {self.album_folder if self.album_folder else '...'} \n\n"
        )
        self.task = task
        self.track_paths_before = track_paths_before or []
        self.track_paths_after = track_paths_after or []
        self.track_paths = self.eligible_track_paths()

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
        files = [f for f in files if f.lower().endswith(ut.audio_extensions)]
        return files

    @property
    def group_id(self):
        return self._group_id

    @group_id.setter
    def group_id(self, id):
        tag_group = TagGroup.query.get(id)
        if tag_group is None:
            tag_group = TagGroup(id=id)
            tag_group.commit()
        self._group_id = tag_group.id

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

    def make_transient(self):
        make_transient(self)
        return self


class TagGroup(BaseModel):
    id = Column(String, primary_key=True)
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


@ut.with_app_context
def tag_for_folder(path: str) -> Tag:
    return Tag.query.filter_by(album_folder=path).first()


@ut.with_app_context
def tag_status(tag: str) -> str:
    """Get the status of either an existing tag or via album folder.

    Args:
        tag (str): either an existing tag id or a folder path.

    Returns:
        stats: pending, tagging, tagged, importing, imported, cleared, failed,
            or "notag" if no tag was created for the provided folder, yet.
    """

    if not os.path.exists(tag):
        bt = Tag.query.filter_by(id=tag).first()
        if bt is None:
            raise ValueError(f"No folder or tag found for {tag}")
        return str(bt.status)

    bt = tag_for_folder(tag)
    if bt is None:
        return "notag"
    else:
        return str(bt.status)


@ut.with_app_context
def tag_should_refetch(tag: str) -> bool:
    """helper to check if based on the files in the folder, we should retag.

    Args:
        tag (str): either an existing tag id or a folder path.
    """
    if not os.path.exists(tag):
        bt = Tag.query.filter_by(id=tag).first()
    else:
        album_folder = disk.album_folders_from_track_paths([tag])[0]
        bt = tag_for_folder(album_folder)

    if bt is None:
        return True

    for f in bt.eligible_track_paths():
        if f not in bt.track_paths:
            return True
    return False


@ut.with_app_context
def cleanup_status():
    # we can get the id from the job args,
    # the reflect the args to submit_and_callback
    queued = [j.args[0] for j in ut.rq.get_queue("preview").jobs]
    queued += [j.args[0] for j in ut.rq.get_queue("import").jobs]

    running = [j.args[0] for j in ut.get_running_jobs()]

    unfinished = Tag.query.filter(
        Tag.status not in ["imported", "cleared", "tagged"]
    ).all()
    for bt in unfinished:
        if datetime.datetime.now() - bt.updated_at < datetime.timedelta(seconds=60):
            continue
        if bt.id not in queued and bt.id not in running and bt.distance is None:
            bt.status = "failed"
            bt.commit()
