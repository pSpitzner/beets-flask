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
from typing import List
from uuid import uuid4

from beets.importer import ImportTask, library
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
from beets_flask.importer.states import CandidateState, SessionState, TaskState
from beets_flask.importer.types import BeetsAlbumMatch, BeetsTrackMatch


class SessionStateInDb(Base):
    """Represents an import session.

    Normally a session has one task but in theory and edge cases
    we could have multiple tasks per session.
    """

    __tablename__ = "session"

    tasks: Mapped[List[TaskStateInDb]] = relationship()
    path: Mapped[bytes] = mapped_column(LargeBinary)

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
    def from_session_state(cls, state: SessionState) -> SessionStateInDb:
        """Create a new session from a session state."""

        session = cls(
            path=os.fsencode(state.path),
            id=state.id,
            tasks=[TaskStateInDb.from_task_state(task) for task in state.task_states],
            progress=state.progress.progress,
        )

        return session

    def to_session_state(self) -> SessionState:
        """Convert the session to a session state."""
        session = SessionState(Path(os.fsdecode(self.path)))
        session.id = self.id
        session._task_states = [task.to_task_state(session) for task in self.tasks]
        return session


class TaskStateInDb(Base):
    """Represents an import task."""

    __tablename__ = "task"

    session_id: Mapped[str] = mapped_column(ForeignKey("session.id"))
    candidates: Mapped[List[CandidateStateInDb]] = relationship()

    # To reconstruct the beets task we also need
    toppath: Mapped[bytes | None]
    paths: Mapped[bytes]
    items: Mapped[bytes]

    progress: Mapped[Progress]

    def __init__(
        self,
        id: str | None = None,
        toppath: bytes | None = None,
        paths: List[bytes] = [],
        items: List[library.Item] = [],
        candidates: List[CandidateStateInDb] = [],
        progress: Progress = Progress.NOT_STARTED,
    ):
        super().__init__(id)
        self.toppath = toppath
        self.paths = pickle.dumps(paths)
        self.items = pickle.dumps(items)
        self.candidates = candidates
        self.progress = progress

    @classmethod
    def from_task_state(cls, state: TaskState) -> TaskStateInDb:
        """Create a new task from a task state."""
        task = cls(
            toppath=state.task.toppath,
            paths=state.task.paths,
            items=state.task.items,
            candidates=[
                CandidateStateInDb.from_candidate_state(c)
                for c in state.candidate_states
            ],
            progress=state.progress.progress,
        )
        return task

    def to_task_state(self, session_state: SessionState | None = None) -> TaskState:
        """Convert the task to a task state."""

        # We just assume it is a normal import task
        beets_task = ImportTask(
            toppath=self.toppath,
            paths=self.paths,
            items=pickle.loads(self.items),
        )

        task = TaskState(beets_task, session_state)
        task.id = self.id
        task.candidate_states = [c.to_candidate_state(task) for c in self.candidates]
        task.progress.progress = self.progress
        return task


class CandidateStateInDb(Base):
    """Represents a candidate for an import task."""

    __tablename__ = "candidate"

    task_id: Mapped[str] = mapped_column(ForeignKey("task.id"))

    # Should deserialize to AlbumMatch|TrackMatch
    # ~4kb per match
    match: Mapped[bytes]

    def __init__(
        self,
        match: BeetsAlbumMatch | BeetsTrackMatch,
        id: str | None = None,
    ):
        super().__init__(id)
        self.match = pickle.dumps(match)

    @classmethod
    def from_candidate_state(cls, state: CandidateState) -> CandidateStateInDb:
        """Create a new candidate from a candidate state."""
        candidate = cls(
            id=state.id,
            match=state.match,
        )
        return candidate

    def to_candidate_state(self, task_state: TaskState) -> CandidateState:
        """Convert the candidate to a candidate state."""
        candidate = CandidateState(pickle.loads(self.match), task_state)
        candidate.id = self.id
        return candidate
