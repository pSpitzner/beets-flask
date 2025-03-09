"""Minimal state model for the beets_flask application.

Allows to resume a import at any time using our state dataclasses,
see importer/state.py for more information.

Why not just have State and StateInDb in the same class?
- ORM ideally wants full mirroring of whats in RAM in the DB. This is hard to ensure
  in our case, as we dont have full control over beets tasks etc.
- A lot of beets objects do not neatly translate to DB objects.
- Often we want states without having to think about a DB Session.
- Just a current motivation and choice, will revisit this later.
"""

from __future__ import annotations

import os
import pickle
from pathlib import Path
from typing import List, Optional

from beets.importer import ImportTask, action, library
from sqlalchemy import ForeignKey, LargeBinary
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from beets_flask.database.models.base import Base
from beets_flask.disk import Folder
from beets_flask.importer.progress import Progress
from beets_flask.importer.states import (
    CandidateState,
    SerializedCandidateState,
    SerializedSessionState,
    SerializedTaskState,
    SessionState,
    TaskState,
)
from beets_flask.importer.types import BeetsAlbumMatch, BeetsTrackMatch


class FolderInDb(Base):
    """Represents a folder on disk, to keep track of changes.

    This folder does not necessarily have to exist on disk anymore. If the content
    changed, a new folder object (new hash) should be created.
    """

    __tablename__ = "folder"

    full_path: Mapped[str] = mapped_column(index=True)

    # checked -> yes | no or didnt check -> None
    is_album: Mapped[Optional[bool]]

    def __init__(self, path: Path | str, hash: str):
        """
        Create a FolderInDb object from a path.

        Convention:
        /home/user/foo/
        abs path with trailing slash.

        Parameters
        ----------
        path : Path
            The path to create the object from.
        """
        if isinstance(path, str):
            path = Path(path)
        self.full_path = str(path.resolve())
        self.hash = hash

    @classmethod
    def from_live_folder(cls, folder: Folder) -> FolderInDb:
        """Create a FolderInDb object from a Folder object."""
        return cls(
            path=folder.path,
            hash=folder.hash,
        )

    def as_tuple(self) -> tuple[Path, str]:
        """Recreate the live Folder object from its stored version in the db."""
        return (
            self.path,
            self.hash,
        )

    @property
    def hash(self) -> str:
        return self.id

    @hash.setter
    def hash(self, value: str):
        self.id = value

    @property
    def path(self) -> Path:
        return Path(self.full_path)

    @classmethod
    def get_current_on_disk(cls, hash: str, path: Path | str) -> Folder:
        """
        Check that a folders hash is still the same, as you have previously determined.

        If changed, a new instance of FolderInDb is created and stored in the DB.

        Returns
        -------
        Folder: The live folder object on disk, with the potentially new (current) hash.
        """
        from beets_flask.database.setup import db_session_factory

        with db_session_factory() as db_session:
            f_on_disk = Folder.from_path(path)
            f_in_db = FolderInDb.get_by(FolderInDb.hash == hash, session=db_session)
            if f_in_db is None:
                f_in_db = FolderInDb(hash=hash, path=path)
                db_session.add(f_in_db)
                db_session.commit()

            if f_in_db.hash != f_on_disk.hash:
                log.debug(
                    f"Hash mismatch {path=} {f_in_db.hash=} {f_on_disk.hash=}"
                    + "This indicatest that the folder has changed."
                )
            return f_on_disk


class SessionStateInDb(Base):
    """Represents an import session.

    Normally a session has one task but in theory and edge cases
    we could have multiple tasks per session.

    Beets uses sessions for the back-and-forth dialog with the user,
    where one session may have multiple tasks.
    We wrap the beets session in our SessionState to better handle its progress.
    And our SessionState has a representation in our database, the SessionStateInDb.

    Example:
    ```
    # Create
    s_live_state = SessionState(Path("path"))
    session = PreviewSession(s_live_state)
    s_live_state = session.run_sync()
    s_db_state = SessionStateInDb.from_live_state(s_live_state)

    # Search
    select(SessionStateInDb).where(TaskStateInDb.id == "some path").first()
    s_db_state = SessionStateInDb.get_by(
    ```
    """

    __tablename__ = "session"

    tasks: Mapped[List[TaskStateInDb]] = relationship(
        back_populates="session",
        # all: All operations cascade i.e. session.merge!
        # delete-orphan: Automatic deletion of tasks if not referenced
        # by a session anymore
        # See also https://docs.sqlalchemy.org/en/20/orm/cascades.html#unitofwork-cascades
        cascade="all, delete-orphan",
    )

    folder_hash: Mapped[str] = mapped_column(ForeignKey("folder.id"))
    folder: Mapped[FolderInDb] = relationship()

    tag = relationship("Tag", uselist=False, back_populates="session_state_in_db")

    def __init__(
        self,
        folder: FolderInDb,
        id: str | None = None,
        tasks: List[TaskStateInDb] = [],
        progress: Progress = Progress.NOT_STARTED,
    ):
        super().__init__(id)
        self.folder = folder
        self.tasks = tasks
        self.progress = progress

    @classmethod
    def from_live_state(cls, state: SessionState) -> SessionStateInDb:
        """Create the DB representation of a live SessionState.."""

        session = cls(
            folder=FolderInDb(state.folder_path, state.folder_hash),
            id=state.id,
            tasks=[TaskStateInDb.from_live_state(task) for task in state.task_states],
            progress=state.progress.progress,
        )

        return session

    def to_live_state(self) -> SessionState:
        """Recreate the live SessionState with underlying task from its stored version in the db."""
        s_state = SessionState(self.folder.path)
        if s_state.folder_hash != self.folder.hash:
            log.warning(
                f"Folder hash mismatch for {self.folder.path}. "
                f"Expected {self.folder.hash} but got {s_state.folder_hash}."
            )
        s_state.id = self.id
        s_state._task_states = [task.to_live_state(s_state) for task in self.tasks]
        return s_state

    def to_dict(self) -> SerializedSessionState:
        return self.to_live_state().serialize()


class TaskStateInDb(Base):
    """Represents an import task.

    More precisely, beets uses one task per album that goes through a bunch of stages.
    We wrap the beets task in our TaskState to better handle its progress.
    And this TaskState has a representation in our database, the TaskStateInDb.
    """

    __tablename__ = "task"

    # Relationships
    session_id: Mapped[str] = mapped_column(ForeignKey("session.id"))
    session: Mapped[SessionStateInDb] = relationship(back_populates="tasks")

    candidates: Mapped[List[CandidateStateInDb]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )

    toppath: Mapped[bytes | None]

    # To reconstruct the beets task we need to store a few of its attributes
    paths: Mapped[bytes]
    items: Mapped[bytes]
    choice_flag: Mapped[action | None]

    progress: Mapped[Progress]

    def __init__(
        self,
        id: str | None = None,
        toppath: bytes | None = None,
        paths: List[bytes] = [],
        items: List[library.Item] = [],
        candidates: List[CandidateStateInDb] = [],
        progress: Progress = Progress.NOT_STARTED,
        choice_flag: action | None = None,
    ):
        super().__init__(id)
        self.toppath = toppath
        self.paths = pickle.dumps(paths)
        self.items = pickle.dumps(items)
        self.candidates = candidates
        self.progress = progress
        self.choice_flag = choice_flag

    @classmethod
    def from_live_state(cls, state: TaskState) -> TaskStateInDb:
        """Create the DB representation of a live TaskState."""
        task = cls(
            toppath=state.task.toppath,
            paths=state.task.paths,
            items=state.task.items,
            candidates=[
                CandidateStateInDb.from_live_state(c) for c in state.candidate_states
            ],
            progress=state.progress.progress,
            choice_flag=state.task.choice_flag,
        )
        return task

    def to_live_state(self, session_state: SessionState | None = None) -> TaskState:
        """Recreate the live TaskState with underlying task from its stored version in the db."""

        # We just assume it is a normal import task
        beets_task = ImportTask(
            toppath=self.toppath,
            paths=pickle.loads(self.paths),
            items=pickle.loads(self.items),
        )
        beets_task.choice_flag = self.choice_flag

        live_state = TaskState(beets_task)
        live_state.id = self.id
        live_state.candidate_states = [
            c.to_live_state(live_state) for c in self.candidates
        ]
        live_state.progress.progress = self.progress

        # Set candidate of beets_task
        live_state.task.candidates = [c.match for c in live_state.candidate_states]

        return live_state

    def to_dict(self) -> SerializedTaskState:
        return self.to_live_state().serialize()


from beets_flask.logger import log


class CandidateStateInDb(Base):
    """Represents a candidate (potential match) for an import task.

    Again: Beets-Candidate > CandidateState > CandidateStateInDb
    """

    __tablename__ = "candidate"

    task_id: Mapped[str] = mapped_column(ForeignKey("task.id"))
    task: Mapped[TaskStateInDb] = relationship(back_populates="candidates")

    # Should deserialize to AlbumMatch|TrackMatch
    # ~4kb per match
    match: Mapped[bytes]

    def __init__(
        self,
        match: BeetsAlbumMatch | BeetsTrackMatch,
        id: str | None = None,
    ):
        super().__init__(id)

        # Remove db from all items as it can't be pickled
        # FIXME: this should go into beets __getstate__ method
        # see https://github.com/beetbox/beets/pull/5641
        if isinstance(match, BeetsAlbumMatch):
            for item in match.mapping.keys():
                item._db = None
                item._Item__album = None
            for item in match.extra_items:
                item._db = None
                item._Item__album = None

        self.match = pickle.dumps(match)

    @classmethod
    def from_live_state(cls, state: CandidateState) -> CandidateStateInDb:
        """Create the DB representation of a live CandidateState."""
        candidate = cls(
            id=state.id,
            match=state.match,
        )
        return candidate

    def to_live_state(self, task_state: TaskState) -> CandidateState:
        """Recreate the live CandidateState with underlying task from its stored version in the db."""
        live_state = CandidateState(pickle.loads(self.match), task_state)
        live_state.id = self.id
        return live_state

    def to_dict(self) -> SerializedCandidateState:
        t_state_db = TaskStateInDb.get_by(TaskStateInDb.id == self.task_id)
        if t_state_db is None:
            raise ValueError(f"Task with id {self.task_id} not found.")

        for c_state in t_state_db.to_live_state().candidate_states:
            if c_state.id == self.id:
                return c_state.serialize()
        raise ValueError(f"Candidate with id {self.id} not found.")


__all__ = ["SessionStateInDb", "TaskStateInDb", "CandidateStateInDb"]
