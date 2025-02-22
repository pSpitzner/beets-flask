"""Minimal state model for the beets_flask application.

Allows to resume a import at any time using our state dataclasses,
see importer/state.py for more information.
"""

from __future__ import annotations

import os
import pickle
from datetime import datetime
from pathlib import Path
from pickletools import bytes1
from typing import TYPE_CHECKING, List
from uuid import uuid4

from beets.importer import ImportTask, action, library
from sqlalchemy import ForeignKey, LargeBinary, PickleType
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    registry,
    relationship,
)
from sqlalchemy.sql import func

from beets_flask.database.models.base import Base
from beets_flask.importer.progress import Progress, ProgressState
from beets_flask.importer.states import (
    CandidateState,
    SerializedCandidateState,
    SerializedSessionState,
    SerializedTaskState,
    SessionState,
    TaskState,
)
from beets_flask.importer.types import BeetsAlbumMatch, BeetsTrackMatch


class SessionStateInDb(Base):
    """Represents an import session.

    Normally a session has one task but in theory and edge cases
    we could have multiple tasks per session.
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
    path: Mapped[bytes] = mapped_column(LargeBinary)
    tag = relationship("Tag", uselist=False, back_populates="session_state_in_db")

    def __init__(
        self,
        path: bytes,
        id: str | None = None,
        tasks: List[TaskStateInDb] = [],
        progress: Progress = Progress.NOT_STARTED,
    ):
        super().__init__(id)
        self.path = path
        self.tasks = tasks
        self.progress = progress

    @classmethod
    def from_live_state(cls, state: SessionState) -> SessionStateInDb:
        """Create a new session from a session state."""

        session = cls(
            path=os.fsencode(state.path),
            id=state.id,
            tasks=[TaskStateInDb.from_live_state(task) for task in state.task_states],
            progress=state.progress.progress,
        )

        return session

    def to_live_state(self) -> SessionState:
        """Convert the session to a session state."""
        session = SessionState(Path(os.fsdecode(self.path)))
        session.id = self.id
        session._task_states = [task.to_live_state(session) for task in self.tasks]
        return session

    def to_dict(self) -> SerializedSessionState:
        return self.to_live_state().serialize()


class TaskStateInDb(Base):
    """Represents an import task."""

    __tablename__ = "task"

    # Relationships
    session_id: Mapped[str] = mapped_column(ForeignKey("session.id"))
    session: Mapped[SessionStateInDb] = relationship(back_populates="tasks")

    candidates: Mapped[List[CandidateStateInDb]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )

    # To reconstruct the beets task we also need
    toppath: Mapped[bytes | None]
    paths: Mapped[bytes]
    items: Mapped[bytes]
    choice_flag: Mapped[bytes]

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
        self.choice_flag = pickle.dumps(choice_flag)

    @classmethod
    def from_live_state(cls, state: TaskState) -> TaskStateInDb:
        """Create a new task from a task state."""
        task = cls(
            toppath=state.task.toppath,
            paths=state.task.paths,
            items=state.task.items,
            candidates=[
                CandidateStateInDb.from_live_state(c) for c in state.candidate_states
            ],
            progress=state.progress.progress,
        )
        return task

    def to_live_state(self, session_state: SessionState | None = None) -> TaskState:
        """Convert the task to a task state."""

        # We just assume it is a normal import task
        beets_task = ImportTask(
            toppath=self.toppath,
            paths=pickle.loads(self.paths),
            items=pickle.loads(self.items),
        )
        beets_task.choice_flag = pickle.loads(self.choice_flag)

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
    """Represents a candidate for an import task."""

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
        """Create a new candidate from a candidate state."""
        candidate = cls(
            id=state.id,
            match=state.match,
        )
        return candidate

    def to_live_state(self, task_state: TaskState) -> CandidateState:
        """Convert the candidate to a candidate state."""
        live_state = CandidateState(pickle.loads(self.match), task_state)
        live_state.id = self.id
        return live_state

    def to_dict(self) -> SerializedCandidateState:
        task = TaskStateInDb.get_by(TaskStateInDb.id == self.task_id)
        if task is None:
            raise ValueError(f"Task with id {self.task_id} not found.")

        for candidate in task.to_live_state().candidate_states:
            if candidate.id == self.id:
                return candidate.serialize()
        raise ValueError(f"Candidate with id {self.id} not found.")


__all__ = ["SessionStateInDb", "TaskStateInDb", "CandidateStateInDb"]
