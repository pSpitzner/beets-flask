"""Minimal state model for the beets_flask application.

Allows to resume a import at any time using our state dataclasses, 
see importer/state.py for more information.
"""

from __future__ import annotations

import os
import pickle
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

from beets_flask.importer.states import (
    CandidateState,
    ProgressState,
    Progress,
    SessionState,
    TaskState,
)
from beets_flask.importer.types import BeetsAlbumMatch, BeetsTrackMatch


class Base(DeclarativeBase):
    __abstract__ = True

    registry = registry(type_annotation_map={bytes: LargeBinary})

    id: Mapped[str] = mapped_column(primary_key=True)

    def __init__(self, id: str | None = None):
        self.id = str(id) if id is not None else str(uuid4())


class Session(Base):
    """Represents an import session.

    Normally a session has one task but in theory and edge cases
    we could have multiple tasks per session.
    """

    __tablename__ = "session"

    tasks: Mapped[List[Task]] = relationship()
    path: Mapped[bytes] = mapped_column(LargeBinary)

    def __init__(
        self,
        path: bytes,
        id: str | None = None,
        tasks: List[Task] = [],
        progress: Progress = Progress.NOT_STARTED,
    ):
        super().__init__(id)
        self.path = path
        self.tasks = tasks
        self.progress = progress

    @classmethod
    def from_session_state(cls, state: SessionState) -> Session:
        """Create a new session from a session state."""

        session = cls(
            path=os.fsencode(state.path),
            id=state.id,
            tasks=[Task.from_task_state(task) for task in state.task_states],
            progress=state.progress.progress,
        )

        return session

    def to_session_state(self) -> SessionState:
        """Convert the session to a session state."""
        session = SessionState(Path(os.fsdecode(self.path)))
        session.id = self.id
        session._task_states = [task.to_task_state(session) for task in self.tasks]
        session.progress = ProgressState(self.progress)
        return session


class Task(Base):
    """Represents an import task."""

    __tablename__ = "task"

    session_id: Mapped[str] = mapped_column(ForeignKey("session.id"))
    candidates: Mapped[List[Candidate]] = relationship()

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
        candidates: List[Candidate] = [],
    ):
        super().__init__(id)
        self.toppath = toppath
        self.paths = pickle.dumps(paths)
        self.items = pickle.dumps(items)
        self.candidates = candidates

    @classmethod
    def from_task_state(cls, state: TaskState) -> Task:
        """Create a new task from a task state."""
        task = cls(
            toppath=state.task.toppath,
            paths=state.task.paths,
            items=state.task.items,
            candidates=[
                Candidate.from_candidate_state(c) for c in state.candidate_states
            ],
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
        return task


class Candidate(Base):
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
    def from_candidate_state(cls, state: CandidateState) -> Candidate:
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
