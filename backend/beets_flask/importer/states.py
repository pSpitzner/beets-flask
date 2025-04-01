"""State classes represent the current state of an import session."""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Literal, Mapping, Sequence, TypedDict, Union, cast
from uuid import uuid4 as uuid

import beets.ui.commands as uicommands
from beets import autotag, importer, library
from deprecated import deprecated

from beets_flask import log
from beets_flask.config import get_config
from beets_flask.disk import Folder
from beets_flask.importer.progress import (
    Progress,
    ProgressState,
    SerializedProgressState,
)
from beets_flask.utility import capture_stdout_stderr

from .types import (
    AlbumInfo,
    BeetsAlbumMatch,
    BeetsItem,
    BeetsTrackMatch,
    ItemInfo,
    TrackInfo,
)


@dataclass(init=False)
class SessionState:
    """Highest level state of an import session.

    Contains task (selection) states for each task.
    """

    id: str
    _task_states: List[TaskState]
    folder_path: Path
    folder_hash: str
    # session-level buttons. continue from choose_match when not None
    user_response: Literal["abort"] | Literal["apply"] | None = None

    def __init__(self, folder: Folder | Path) -> None:
        # Alternate constructor is part of the SessionStateInDb class
        self.id = str(uuid())
        self._task_states = []
        if isinstance(folder, str):
            folder = Path(folder)
        if isinstance(folder, Path):
            folder = Folder.from_path(folder)
        # Why not just a folder object as member?
        # -> We do not always want to compute the children (or save them to db)
        self.folder_path = folder.path
        self.folder_hash = folder.hash

    @property
    @deprecated("Use the folder attribute instead!")
    def path(self) -> Path:
        return self.folder_path

    @property
    def task_states(self):
        return self._task_states

    @property
    def task_state_ids(self):
        return [s.id for s in self.task_states]

    @property
    def tasks(self):
        return [s.task for s in self.task_states]

    @property
    def completed(self):
        return all([s.completed for s in self.task_states])

    @property
    def progress(self):
        """The session progress is the loweset progress of all tasks."""
        if len(self.task_states) == 0:
            return ProgressState(Progress.NOT_STARTED)

        return min([s.progress for s in self.task_states])

    def get_task_state_for_task(self, task: importer.ImportTask) -> TaskState | None:
        state: TaskState | None = None
        for s in self.task_states:
            # TODO: are tasks really comparable?
            if s.task == task:  # by ref
                state = s
                break
        return state

    def get_task_state_by_id(self, id: str) -> TaskState | None:
        state: TaskState | None = None
        for s in self.task_states:
            if s.id == id:
                state = s
                break
        return state

    def upsert_task(
        self,
        task: importer.ImportTask,
    ) -> TaskState:
        """Upsert selection state.

        If it does not exist yet it is created or updated
        if entry exists.
        """
        state = self.get_task_state_for_task(task)

        if state is None:
            state = TaskState(task)
            self._task_states.append(state)

        return state

    @deprecated
    def await_completion(self):
        while not self.completed:
            time.sleep(0.5)
        return True

    def serialize(self) -> SerializedSessionState:
        """JSON representation to match the frontend types."""
        return SerializedSessionState(
            id=self.id,
            tasks=[s.serialize() for s in self.task_states],
            status=self.progress.serialize(),
            completed=self.completed,
        )


@dataclass(init=False)
class TaskState:
    """State representation of a beets ImportTask.

    In the frontend, a selection of the available candidates in the task may be needed
    from the user. Exposes some (typed) attributes of the task (e.g. toppath, paths, items)
    Has a list of associated CandidateStates, that represent `matches` in beets.
    """

    id: str
    task: importer.ImportTask
    candidate_states: List[CandidateState]
    progress = ProgressState()

    # the completed state blocks the choose_match function
    # of interactive sessions via our await_completion method
    completed: bool = False

    # User choices and user input in interactive Session
    # None if no choice has been made yet
    # (or the frontend has not marked the default selection)
    duplicate_action: Literal["skip", "keep", "remove", "merge"] | None = None

    current_candidate_id: str | None = None
    current_search_id: str | None = None
    current_search_artist: str | None = None
    current_search_album: str | None = None

    def __init__(
        self,
        task: importer.ImportTask,
    ) -> None:
        self.id: str = str(uuid())
        # we might run into inconsistencies here, if candidates of the task
        # change. but I do not know when or why they would.
        self.task = task
        self.candidate_states = [CandidateState(c, self) for c in self.task.candidates]
        self.candidate_states.append(CandidateState.asis_candidate(self))

    @property
    def candidates(
        self,
    ) -> Sequence[BeetsAlbumMatch | BeetsTrackMatch]:
        """Task candidates, i.e. possible matches to choose from."""
        return self.task.candidates

    @property
    def current_candidate_state(self) -> CandidateState | None:
        """Returns the CandidateState of the currently selected candidate."""
        cid = self.current_candidate_id
        if cid is None:
            return None

        for c in self.candidate_states:
            if c.id == cid:
                return c
        return None

    def add_candidates(
        self,
        candidates: List[Union[BeetsAlbumMatch, BeetsTrackMatch]],
        insert_at: int = 0,
    ) -> List[CandidateState]:
        """Add new candidates to the selection state."""
        if len(self.task.candidates) == 0 or len(self.candidate_states) == 0:
            insert_at = 0

        # task.candidates is a sequence and thus immutable
        _ = list(self.task.candidates)
        _[insert_at:insert_at] = candidates
        self.task.candidates = _

        new_states = [CandidateState(c, self) for c in candidates]
        self.candidate_states[insert_at:insert_at] = new_states
        return new_states

    @property
    def toppath(self) -> Path | None:
        """Highest-level (common) folder holding music files."""
        if self.task.toppath is not None:
            return Path(self.task.toppath.decode("utf-8"))
        return None

    @property
    def paths(self) -> List[Path]:
        """Lowest-level folders holding music files."""
        return [Path(p.decode("utf-8")) for p in self.task.paths]

    @property
    def item_paths_before_import(self) -> list[Path]:
        """Explicit paths to all media files that would be imported."""
        if self.toppath is None:
            return []
        if self.toppath.is_file():
            return [self.toppath]

        items: list[bytes] = []
        for _, i in importer.albums_in_dir(self.toppath):
            # the generator returns a nested list of the outer diretories
            # and file paths. thus, extend and then cast
            items.extend(i)

        return [Path(i.decode("utf-8")) for i in items]

    @property
    def items(self) -> List[autotag.Item]:
        """Items (representing music files on disk) of the associated task."""
        return [item for item in self.task.items]

    @property
    def items_minimal(self) -> List[ItemInfo]:
        """Items of the associated task as MinimalItemAndTrackInfo."""
        return [ItemInfo.from_beets(i) for i in self.task.items]

    @property
    def best_candidate_state(self) -> CandidateState | None:
        """Returns the best candidate of this task.

        ```
        c = task_state.best_candidate
        if c is not None:
            print(c.cur_artist, c.cur_album)
        ```
        """
        best = None
        for candidate in self.candidate_states:
            if candidate.is_asis:
                continue
            if best is None or candidate.distance < best.distance.distance:
                best = candidate
        return best

    @property
    def choice_flag(self) -> importer.action | None:
        return self.task.choice_flag

    @choice_flag.setter
    def choice_flag(self, value: importer.action | None):
        self.task.choice_flag = value

    @property
    def current_metadata(self) -> Metadata:
        """Current metadata of the task.

        This is the metadata of the music files on disk.
        """
        likelies, consensus = autotag.current_metadata(self.items)
        return Metadata(**{k: str(v) for k, v in likelies.items()})

    # ---------------------------------------------------------------------------- #

    def serialize(self) -> SerializedTaskState:
        """JSON representation to match the frontend types."""
        # Workaround to show initial selection on frontend
        # if no candidate has been selected yet
        current_id = self.current_candidate_id
        if current_id is None and len(self.candidate_states) > 0:
            current_id = self.candidate_states[0].id

        return SerializedTaskState(
            id=self.id,
            items=self.items_minimal,
            candidates=[c.serialize() for c in self.candidate_states],
            current_metadata=self.current_metadata,
            current_candidate_id=current_id,
            duplicate_action=self.duplicate_action,
            completed=self.completed,
            toppath=str(self.toppath),
            paths=[str(p) for p in self.paths],
        )

    def set_progress(self, progress: ProgressState | Progress | str) -> None:
        """Set the progress of the task.

        If string is given it is set as the message of the current progress.
        """
        if isinstance(progress, ProgressState):
            self.progress = progress
        elif isinstance(progress, Progress):
            self.progress = ProgressState(progress)
        elif isinstance(progress, str):
            # just convenience for debugging should not be used in production
            self.progress.message = progress
        else:
            raise ValueError(f"Unknown progress type: {progress}")


@dataclass(init=False)
class CandidateState:
    """
    State representation of a single candidate (match) for an import task.

    Can represent an album (self.type == "album") or a track (self.type == "track").
    Keeps a reference to the associated SelectionState, so we can access the beets task.
    Exposes some attributes of the task and match

    Note: currently only tested for album matches.
    """

    id: str
    duplicate_ids: List[str]  # Beets ids of duplicates in the library (album)
    match: Union[BeetsAlbumMatch, BeetsTrackMatch]

    # Reference upwards
    task_state: TaskState

    def __init__(
        self, match: Union[BeetsAlbumMatch, BeetsTrackMatch], task_state: TaskState
    ) -> None:
        self.id = str(uuid())
        self.match = match
        self.duplicate_ids = []  # checked and set by session
        self.task_state = task_state

    @property
    def type(self) -> Literal["album", "track"]:
        if isinstance(self.match, BeetsAlbumMatch):
            return "album"
        elif isinstance(self.match, BeetsTrackMatch):
            return "track"
        else:
            raise ValueError("Unknown type")

    @property
    def diff_preview(self) -> str:
        """Diff preview of the match to the current meta data."""
        out, err, _ = capture_stdout_stderr(
            uicommands.show_change,
            self.task_state.task.cur_artist,
            self.task_state.task.cur_album,
            self.match,
        )
        res = out.lstrip("\n")
        if len(err) > 0:
            res += f"\n\nError: {err}"
        return res

    @classmethod
    def asis_candidate(cls, task_state: TaskState) -> CandidateState:
        """
        Alternate constructor for an asis import option.

        We mock the album match to display
        current meta data in the frontend.
        This is pretty much duct-tape.
        """
        items: list[BeetsItem] = task_state.task.items
        info, _ = autotag.current_metadata(items)
        info["data_source"] = "asis"
        info["data_url"] = f"file://{task_state.toppath}"

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

        match = BeetsAlbumMatch(
            distance=autotag.Distance(),
            info=autotag.AlbumInfo(
                tracks=tracks,
                **info,
            ),
            extra_items=[],
            extra_tracks=[],
            mapping={i: tracks[idx] for idx, i in enumerate(items)},
        )
        candidate = cls(match=match, task_state=task_state)
        # the session checks the candidate id for this particular value.
        # this saves us from defining an extra attribute
        # (and passing back and forth to the frontend)
        candidate.id = "asis-" + str(uuid())
        return candidate

    # --------------------- Helper to lift / unnset from match to -------------------- #
    @property
    def cur_artist(self) -> str:
        """Current artist, usually the meta data of the music files.

        Named to be consistent with beets.
        """
        return str(self.task_state.task.cur_artist)

    @property
    def cur_album(self) -> str:
        """Current album, usually the meta data of the music files.

        Named to be consistent with beets.
        """
        return str(self.task_state.task.cur_album)

    @property
    def artist(self) -> str | None:
        """Artist of the match."""
        return self.match.info.artist

    @property
    def album(self) -> str | None:
        """Album of the match."""
        return self.match.info.album

    @property
    def items(self) -> List[autotag.Item]:
        """In beets, items refers to the music files on disk.

        Tracks correspond to an online match, (or the library?)
        """
        return self.task_state.task.items

    @property
    def tracks(self) -> List[autotag.TrackInfo]:
        """Tracks of the match (usually tracks in online match)."""
        if isinstance(self.match, BeetsAlbumMatch):
            return self.match.info.tracks
        return [self.match.info]

    @property
    def distance(self) -> autotag.Distance:
        """Distance of the match to the current meta data.

        Metadata may be from the task i.e. album or track.
        """
        return self.match.distance

    @property
    def penalties(self) -> List[str]:
        return list(self.match.distance.keys())

    @property
    def num_tracks(self) -> int:
        """Number of tracks in the match (usually tracks in online match)."""
        if isinstance(self.match, BeetsAlbumMatch):
            return len(self.match.info.tracks)
        return 1

    @property
    def num_items(self) -> int:
        """Number of items in the task (usually files on disk)."""
        return len(self.items)

    @property
    def url(self) -> str | None:
        """URL of the match."""
        if isinstance(self.match, BeetsAlbumMatch):
            try:
                return self.match.info.data_url
            except AttributeError:  # not set in the match
                return None

        return None

    @property
    def is_asis(self) -> bool:
        """Returns True if this is an "as is" candidate."""
        return self.id.startswith("asis-")

    # ------------------------------------ utility ----------------------------------- #

    def identify_duplicates(self, lib: library.Library) -> List[library.Album]:
        """Find duplicates.

        Copy of beets' `task.find_duplicates` but works on any candidates' match.

        # FIXME: Tracks are not checked for duplicates. Tbh noone cares about tracks anyways
        """
        info = self.match.info.copy()
        info["albumartist"] = info["artist"]

        if info["artist"] is None:
            # As-is import with no artist. Skip check.
            return []

        # Construct a query to find duplicates with this metadata. We
        # use a temporary Album object to generate any computed fields.
        tmp_album = library.Album(lib, **info)
        keys: List[str] = cast(
            List[str],
            get_config()["import"]["duplicate_keys"]["album"].as_str_seq() or [],
        )
        dup_query = library.Album.all_fields_query(
            {key: tmp_album.get(key) for key in keys}
        )

        # Re-Importing: Don't count albums with the same files as duplicates.
        task_paths = {i.path for i in self.task_state.task.items if i}

        duplicates: List[library.Album] = []
        for album in lib.albums(dup_query):
            # Check whether the album paths are all present in the task
            # i.e. album is being completely re-imported by the task,
            # in which case it is not a duplicate (will be replaced).
            album_paths = {i.path for i in album.items()}
            if not (album_paths <= task_paths):
                duplicates.append(album)

        # Write duplicates information!
        self.duplicate_ids = [d.id for d in duplicates]

        return duplicates

    @property
    def has_duplicates_in_library(self) -> bool:
        """Returns False, either if no duplicates found, or you have not checked yet.

        Call `identify_duplicates` first to ensure this works.
        """
        return len(self.duplicate_ids) > 0

    def serialize(self) -> SerializedCandidateState:
        """JSON representation to match the frontend types."""
        # we lift the match.info to reduce nesting in the frontend.
        info: TrackInfo | AlbumInfo
        tracks: list[TrackInfo]
        mapping: Mapping[int, int] = {}

        if isinstance(self.match.info, autotag.TrackInfo):
            # This hardly ever happens, we might support this more in the future
            info = TrackInfo.from_beets(self.match.info)
            tracks = [TrackInfo.from_beets(self.match.info)]
        elif isinstance(self.match.info, autotag.AlbumInfo):
            info = AlbumInfo.from_beets(self.match.info)

            # Map beets types to our types, allows serialization magic
            tracks = [TrackInfo.from_beets(track) for track in self.match.info.tracks]

            # the mapping of a beets albummatch uses objects, but we don not want
            # to send them over redundantly. convert to an index mapping,
            # where first index is in self.items, and second is in self.match.info.tracks
            for item, track in self.match.mapping.items():  # type: ignore
                idx = tdx = None
                for idx, _ in enumerate(self.items):
                    if item.path == self.items[idx].path:
                        break
                for tdx, _ in enumerate(self.tracks):
                    if track.track_id == self.tracks[tdx].track_id:
                        break
                if idx is not None and tdx is not None:
                    mapping[idx] = tdx
        else:
            raise ValueError(f"Unknown type of matchinfo {type(self.match.info)}")

        res = SerializedCandidateState(
            id=self.id,
            penalties=self.penalties,
            duplicate_ids=self.duplicate_ids,
            type=self.type,
            distance=self.distance.distance,
            info=info,
            tracks=tracks,
            mapping=mapping,
        )

        return res


# class AsIsCandidateState(CandidateState):
#     """Just a thin wrapper so we can preset the "as is" nicely in frontend, inlcuding
#     a preview of tracks and meta data.
#     """

#     pass


# ---------------------------- Serialization types --------------------------- #
# Used for getting typehints in the frontend. I.e. we generate the types from
# these typed dicts! See the generate_types.py script for more information.


class SerializedSessionState(TypedDict):
    id: str
    tasks: List[SerializedTaskState]
    status: SerializedProgressState
    completed: bool


class Metadata(TypedDict):
    """returned from current_metadata"""

    artist: str | None
    album: str | None
    albumartist: str | None
    year: str | None
    disctotal: str | None
    mb_albumid: str | None
    label: str | None
    barcode: str | None
    catalognum: str | None
    country: str | None
    media: str | None
    albumdisambig: str | None


class SerializedTaskState(TypedDict):
    id: str

    items: List[ItemInfo]
    current_metadata: Metadata

    # Fetched data
    candidates: List[SerializedCandidateState]

    duplicate_action: str | None
    current_candidate_id: str | None
    completed: bool
    toppath: str | None
    paths: List[str]


class SerializedCandidateState(TypedDict):
    id: str
    duplicate_ids: List[str]
    type: str

    penalties: List[str]
    distance: float

    info: TrackInfo | ItemInfo | AlbumInfo

    # Mapping from items to tracks index based
    mapping: dict[int, int]
    tracks: List[TrackInfo]


__all__ = [
    "SessionState",
    "TaskState",
    "CandidateState",
    "SerializedSessionState",
    "SerializedTaskState",
    "SerializedCandidateState",
]
