"""
State classes to represent the current state of an import session.

"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Literal, Union
from uuid import uuid4 as uuid
import time


import beets.ui.commands as uicommands
from beets import autotag, importer

from beets_flask.logger import log
from beets_flask.utility import capture_stdout_stderr

from .types import (
    AlbumMatch,
    TrackMatch,
    MusicInfo,
    AlbumInfo,
    SerializedImportState,
    TrackInfo,
    ItemInfo,
    SerializedCandidateState,
    SerializedSelectionState,
)


@dataclass
class ImportStatus:
    """Simple dataclass to hold a status message and a status code"""

    message: Literal[
        "initializing",
        "reading files",
        "grouping albums",
        "looking up candidates",
        "identifying duplicates",
        "waiting for user selection",
        "manipulating files",
        "completed",
        "aborted",
        "plugin",
    ]

    # Plugin specific
    plugin_stage: str | None = None
    plugin_name: str | None = None

    @property
    def value(self):
        ret = self.message
        if self.plugin_stage is not None:
            ret += f" ({self.plugin_stage})"
        if self.plugin_name is not None:
            ret += f" ({self.plugin_name})"
        return ret

    def as_dict(self) -> dict:
        return {
            "message": self.message,
            "plugin_stage": self.plugin_stage,
            "plugin_name": self.plugin_name,
        }


@dataclass
class ImportState:
    """
    Highest level state of an import session.
    Contains selection states for each task.
    """

    def __post_init__(self):
        self.id = str(uuid())
        self._selection_states: List[SelectionState] = []
        self.status: ImportStatus = ImportStatus("initializing")
        # session-level buttons. continue from choose_match when not None
        self.user_response: Literal["abort"] | Literal["apply"] | None = None

    @property
    def selection_states(self):
        return self._selection_states

    @property
    def selection_state_ids(self):
        return [s.id for s in self.selection_states]

    @property
    def tasks(self):
        return [s.task for s in self.selection_states]

    @property
    def completed(self):
        return all([s.completed for s in self.selection_states])

    def get_selection_state_for_task(
        self, task: importer.ImportTask
    ) -> SelectionState | None:
        state: SelectionState | None = None
        for s in self.selection_states:
            # TODO: are tasks really comparable?
            if s.task == task:
                state = s
                break
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
            state = SelectionState(task, self)
            self._selection_states.append(state)

        return state

    def await_completion(self):
        while not self.completed:
            time.sleep(0.5)
        return True

    def serialize(self) -> SerializedImportState:
        """
        JSON representation to match the frontend types
        """
        return SerializedImportState(
            id=self.id,
            selection_states=[s.serialize() for s in self.selection_states],
            status=self.status.as_dict(),
            completed=self.completed,
        )


@dataclass
class SelectionState:
    """
    State to represent one beets ImportTask in the frontend, for which a selection
    of the available candidates is needed from the user.
    Exposes some (typed) attributes of the task (e.g. toppath, paths, items)
    Has a list of associated CandidateStates, that represent `matches` in beets.
    """

    task: importer.ImportTask
    import_state: ImportState

    def __post_init__(self):
        self.id: str = str(uuid())
        # we might run into inconsistencies here, if candidates of the task
        # change. but I do not know when or why they would.
        self.candidate_states: List[CandidateState] = [
            CandidateState(c, self) for c in self.task.candidates
        ]
        self.candidate_states.append(CandidateState.asis_candidate(self))
        # identifier of the currently selected candidate. None if user has not chosen yet (or the frontend has not marked the default selection)
        self.current_candidate_id: str | None = None
        self.duplicate_action: Literal["skip", "keep", "remove", "merge", None] = None
        # the completed state blocks the choose_match function
        # of sessions via our await_completion method
        self.completed: bool = False
        # searches
        self.current_search_id: str | None = None
        self.current_search_artist: str | None = None
        self.current_search_album: str | None = None

    @property
    def candidates(self) -> Union[List[AlbumMatch], List[TrackMatch]]:
        """Task candidates, i.e. possible matches to choose from"""
        return self.task.candidates

    @property
    def current_candidate_state(self) -> CandidateState | None:
        """Returns the CandidateState of the currently selected candidate"""
        cid = self.current_candidate_id
        if cid is None:
            return None

        for c in self.candidate_states:
            if c.id == cid:
                return c
        return None

    def add_candidates(
        self, candidates: List[Union[AlbumMatch, TrackMatch]], insert_at: int = 0
    ) -> List[CandidateState]:
        """Adds new candidates to our associated task and self, and create candidates states."""
        if len(self.task.candidates) == 0 or len(self.candidate_states) == 0:
            insert_at = 0
        self.task.candidates[insert_at:insert_at] = candidates
        new_states = [CandidateState(c, self) for c in candidates]
        self.candidate_states[insert_at:insert_at] = new_states
        return new_states

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
        return [ItemInfo.from_instance(i) for i in self.task.items]

    def serialize(self) -> SerializedSelectionState:
        """
        JSON representation to match the frontend types
        """

        # Workaround to show initial selection on frontend
        # if no candidate has been selected yet
        current_id = self.current_candidate_id
        if current_id is None:
            current_id = self.candidate_states[0].id

        return SerializedSelectionState(
            id=self.id,
            candidate_states=[c.serialize() for c in self.candidate_states],
            current_candidate_id=current_id,
            duplicate_action=self.duplicate_action,
            items=[i.serialize() for i in self.items_minimal],
            completed=self.completed,
            toppath=self.toppath,
            paths=self.paths,
        )


@dataclass
class CandidateState:
    """
    State representation of a single candidate (match) for an import task.

    Keeps a reference to the associated SelectionState, so we can access the beets task.
    Exposes some attributes of the task and match

    Note: currently only tested for album matches.
    """

    match: Union[AlbumMatch, TrackMatch]
    selection_state: SelectionState

    def __post_init__(self):
        self.id: str = str(uuid())
        self.type = "album" if hasattr(self.match, "extra_tracks") else "track"
        self.duplicate_in_library: bool = False  # checked and set by session
        self.penalties: List[str] = list(self.match.distance.keys())

        out, err, _ = capture_stdout_stderr(
            uicommands.show_change,
            self.selection_state.task.cur_artist,
            self.selection_state.task.cur_album,
            self.match,
        )
        self.diff_preview = out.lstrip("\n")
        if len(err) > 0:
            self.diff_preview += f"\n\nError: {err}"
        self.diff_preview = ""  # dirty but spams console

    @classmethod
    def asis_candidate(cls, selection_state: SelectionState) -> CandidateState:
        """
        Alternate constructor for creating a CandidateState to represent
        the asis import option. We mock the album match to display
        current meta data in the frontend.
        This is pretty much duct-tape.
        """
        items = selection_state.task.items
        info, _ = autotag.current_metadata(items)
        info["data_source"] = "asis"

        def _generate_kwargs(item):
            kwargs = {}
            for key in item._dirty:
                val = getattr(item, key)
                if val is not None and val != "":
                    kwargs[key] = val
            # tracks use index, items use track, and beets diff preview crashes without index
            kwargs["index"] = item.track or -1
            return kwargs

        tracks = [autotag.TrackInfo(**_generate_kwargs(i)) for i in items]
        match = AlbumMatch(
            distance=autotag.Distance(),
            info=autotag.AlbumInfo(
                tracks=tracks,
                **info,
            ),
            extra_items=[],
            extra_tracks=[],
            mapping={i: tracks[idx] for idx, i in enumerate(items)},
        )
        candidate = cls(match=match, selection_state=selection_state)
        # the session checks the candidate id for this particular value.
        # this saves us from defining an extra attribute
        # (and passing back and forth to the frontend)
        candidate.id = "asis"
        return candidate

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
            duplicate_in_library=self.duplicate_in_library,
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


# class AsIsCandidateState(CandidateState):
#     """
#     Just a thin wrapper so we can preset the "as is" nicely in frontend, inlcuding
#     a preview of tracks and meta data.
#     """

#     def __post_init__(self):
#         super().__post_init__()
