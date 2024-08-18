"""
State classes to represent the current state of an import session.

"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Union
from uuid import uuid4 as uuid
import time


import beets.ui.commands as uicommands
from beets import autotag, importer

from beets_flask.logger import log
from beets_flask.utility import capture_stdout_stderr

from .types import (
    MusicInfo,
    AlbumInfo,
    TrackInfo,
    ItemInfo,
    SerializedCandidateState,
    SerializedSelectionState,
)


@dataclass
class ImportState:
    """
    Highest level state of an import session.
    Contains selection states for each task.
    """

    _selection_states: List[SelectionState] = field(default_factory=list)
    _status: str = "initializing"
    # stages
    # tasks

    @property
    def selection_states(self):
        return self._selection_states

    @property
    def selection_state_ids(self):
        return [s.id for s in self.selection_states]

    @property
    def tasks(self):
        return [s.task for s in self.selection_states]

    def get_selection_state_for_task(
        self, task: importer.ImportTask
    ) -> SelectionState | None:
        state: SelectionState | None = None
        log.debug(f"get_selection_state_for_task {task} {self.selection_states}")
        for s in self.selection_states:
            # TODO: are tasks really comparable?
            log.debug(f"{task=}")
            if s.task == task:
                log.debug("match!")
                state = s
                break
        log.debug(f"{state=}")
        return state

    def get_selection_state_by_id(self, id: str) -> SelectionState | None:
        state: SelectionState | None = None
        for s in self.selection_states:
            if s.id == id:
                state = s
                break
        return state

    def upsert_task(
        self,
        task: importer.ImportTask,
    ) -> SelectionState:
        """Adds selection state if it does not exist yet or updates
        existitng entry.
        """
        state = self.get_selection_state_for_task(task)

        if state is None:
            state = SelectionState(task)
            self._selection_states.append(state)

        return state

    @property
    def status(self):
        return self._status

    def set_status(
        self,
        status: str,
    ):
        log.debug(f"ImportState {status=}")
        self._status = status

    def await_completion_all(self):
        while not all([s.completed for s in self.selection_states]):
            time.sleep(0.5)
        return True


@dataclass
class SelectionState:
    """
    State to represent one beets ImportTask in the frontend, for which a selection
    of the available candidates is needed from the user.
    Exposes some (typed) attributes of the task (e.g. toppath, paths, items)
    Has a list of associated CandidateStates, that represent `matches` in beets.
    """

    task: importer.ImportTask
    id: str = str(uuid())
    # index of the current selection. None if user has not chosen yet (or the frontend marks a default selection)
    current_candidate_idx: int | None = None
    completed: bool = False

    @property
    def candidates(self) -> Union[List[autotag.AlbumMatch], List[autotag.TrackMatch]]:
        """Task candidates, i.e. possible matches to choose from"""
        return self.task.candidates

    @property
    def candidate_states(self) -> List[CandidateState]:
        """State representation of the candidates"""
        if self.task is None:
            return []
        return [CandidateState(i, c, self) for i, c in enumerate(self.task.candidates)]

    @property
    def toppath(self) -> str | None:
        """Highest-level (common) folder holding music files"""
        if self.task.toppath is not None:
            return self.task.toppath.decode("utf-8")
        return None

    @property
    def paths(self) -> List[str]:
        """Lowest-level folders holding music files"""
        return [p.decode("utf-8") for p in self.task.paths]

    @property
    def items(self) -> List[autotag.Item]:
        """Items (representing music files on disk) of the associated task"""
        return [item for item in self.task.items]

    @property
    def items_minimal(self) -> List[MusicInfo]:
        """Items of the associated task as MinimalItemAndTrackInfo"""
        return [MusicInfo.from_instance(i) for i in self.task.items]

    def serialize(self) -> SerializedSelectionState:
        """
        JSON representation to match the frontend types
        """
        return SerializedSelectionState(
            id=self.id,
            candidate_states=[c.serialize() for c in self.candidate_states],
            current_candidate_idx=self.current_candidate_idx,
            items=[i.serialize() for i in self.items_minimal],
            completed=self.completed,
            toppath=self.toppath,
            paths=self.paths,
        )

    def await_completion(self):
        """Blocks until all associated candidated states have been marked as completed"""
        while not self.completed:
            time.sleep(0.5)
        return True


@dataclass
class CandidateState:
    """
    State representation of a single candidate (match) for an import task.

    Keeps a reference to the associated SelectionState, so we can access the beets task.
    Exposes some attributes of the task and match

    Note: currently only tested for album matches.
    """

    id: int
    match: Union[autotag.AlbumMatch, autotag.TrackMatch]
    selection_state: SelectionState
    type: str = "unset"

    diff_preview: str | None = None
    penalties: List[str] = field(default_factory=list)

    def __post_init__(self):
        self.type = "album" if hasattr(self.match, "extra_tracks") else "track"

        out, err, _ = capture_stdout_stderr(
            uicommands.show_change,
            self.selection_state.task.cur_artist,
            self.selection_state.task.cur_album,
            self.match,
        )
        self.diff_preview = out.lstrip("\n")
        if len(err) > 0:
            self.diff_preview += f"\n\nError: {err}"

        self.penalties.extend(self.match.distance.keys())

    @property
    def cur_artist(self) -> str:
        return str(self.selection_state.task.cur_artist)

    @property
    def cur_album(self) -> str:
        return str(self.selection_state.task.cur_album)

    @property
    def items(self) -> List[autotag.Item]:
        return self.selection_state.task.items

    @property
    def distance(self) -> autotag.Distance:
        return self.match.distance

    def serialize(self) -> SerializedCandidateState:
        """JSON representation to match the frontend types"""

        # we lift the match.info from to reduce nesting in the frontend.
        self.match.info.decode()

        info = None
        items = None
        tracks = None
        extra_tracks = None
        extra_items = None
        mapping = None

        if self.type == "track":
            info = TrackInfo.from_instance(self.match.info).serialize()

        elif self.type == "album":
            info = AlbumInfo.from_instance(self.match.info).serialize()

            tracks = []
            for track in self.match.info.tracks or []:
                track.decode()
                tracks.append(TrackInfo.from_instance(track).serialize())

            extra_tracks = []
            for track in self.match.extra_tracks or []:  # type: ignore
                track.decode()
                extra_tracks.append(TrackInfo.from_instance(track).serialize())

            items = [ItemInfo.from_instance(i).serialize() for i in self.items]

            extra_items = [
                ItemInfo.from_instance(i).serialize()
                for i in self.match.extra_items or []  # type: ignore
            ]

            # the mapping of a beets albummatch uses objects, but we don not want
            # to send them over redundantly. convert to an index mapping,
            # where first index is in self.items, and second is in self.match.info.tracks
            mapping = dict()
            for item, track in self.match.mapping.items():  # type: ignore
                idx = self.items.index(item)
                tdx = self.match.info.tracks.index(track)  # type: ignore
                mapping[idx] = tdx
        else:
            raise ValueError(f"Unknown type {self.type}")

        res = SerializedCandidateState(
            id=self.id,
            diff_preview=self.diff_preview,
            cur_artist=self.cur_artist,
            cur_album=self.cur_album,
            penalties=self.penalties,
            type=self.type,
            distance=self.distance.distance,
            info=info,
            items=items,
            tracks=tracks,
            extra_tracks=extra_tracks,
            extra_items=extra_items,
            mapping=mapping,
        )

        return res


def _enforce_dict(d):
    """Helper to make sure we are serializable. This is a workaround for some
    beets classes that have generators we could not pinpoint. (e.g. AlbumInfo)"""
    # beets' AlbumInfo & TrackInfo is a custom implementation of AttributeDict,
    # which has some generators breaking serialization (which i cannot find)
    # I found no way to get around them, except recreating the dict.
    return {k: v for k, v in d.items()}
