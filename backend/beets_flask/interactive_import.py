# class ImportTask(BaseImportTask):
#     """Represents a single set of items to be imported along with its
#     intermediate state. May represent an album or a single item.

#     The import session and stages call the following methods in the
#     given order.

#     * `lookup_candidates(self)` Sets the `common_artist`, `common_album`,
#       `candidates`, and `rec` attributes. `candidates` is a list of
#       `AlbumMatch` objects.

#     * `def choose_match(self, session)` Uses the session to set the `match` attribute
#       from the `candidates` list.

#     * `find_duplicates(self, lib)` Returns a list of albums from `lib` with the
#       same artist and album name as the task.

#     * `def apply_metadata(self)` Sets the attributes of the items from the
#       task's `match` attribute.

#     * `add(self, lib)` Add the imported items and album to the database.

#     * `manipulate_files(self, operation=None, write=False, session=None)`
#       Copy, move, and write files depending on the
#       session configuration.

#     * `set_fields(self, lib)` Sets the fields given at CLI or configuration to
#       the specified values.

#     * `finalize(self, session)` Update the import progress and cleanup the file
#       system.

# ----------------------------------------------------------------------

# ImportSession Stages -> pipeline

# * read_tasks(session):
#     A generator yielding all the albums (as ImportTask objects) found
#     in the user-specified list of paths. In the case of a singleton
#     import, yields single-item tasks instead.

# * group_albums(session):
#     A pipeline stage that groups the items of each task into albums
#     using their metadata.

#     Groups are identified using their artist and album fields. The
#     pipeline stage emits new album tasks for each discovered group.

# --flat?

# if self.config["autotag"]:
#     * lookup_candidates(session, task)
#         A coroutine for performing the initial MusicBrainz lookup for an
#         album. It accepts lists of Items and yields
#         (items, cur_artist, cur_album, candidates, rec) tuples. If no match
#         is found, all of the yielded parameters (except items) are None.
#     * user_query(session, task)
#         A coroutine for interfacing with the user about the tagging
#         process.

#         The coroutine accepts an ImportTask objects. It uses the
#         session's `choose_match` method to determine the `action` for
#         this task. Depending on the action additional stages are executed
#         and the processed task is yielded.

#         It emits the ``import_task_choice`` event for plugins. Plugins have
#         access to the choice via the ``task.choice_flag`` property and may
#         choose to change it.

# else:
#     * import_asis(session, task)
#         Select the `action.ASIS` choice for all tasks.

#         This stage replaces the initial_lookup and user_query stages
#         when the importer is run without autotagging.

# plugins
#     * plugin_stage(session, func, task)
#         A coroutine (pipeline stage) that calls the given function with
#         each non-skipped import task. These stages occur between applying
#         metadata changes and moving/copying/writing files.
#     * early_import_stages()
#     * import_stages()

# * manipulate_files(session, task):
#     A coroutine (pipeline stage) that performs necessary file
#     manipulations *after* items have been added to the library and
#     finalizes each task.


# function to work around needing to parse cur_artist and cur_album

# def current_metadata(
#     items: Iterable[Item],
# ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
#     """Extract the likely current metadata for an album given a list of its
#     items. Return two dictionaries:
#      - The most common value for each field.
#      - Whether each field's value was unanimous (values are booleans).
#     """
#     assert items  # Must be nonempty.

#     likelies = {}
#     consensus = {}
#     fields = [
#         "artist",
#         "album",
#         "albumartist",
#         "year",
#         "disctotal",
#         "mb_albumid",
#         "label",
#         "barcode",
#         "catalognum",
#         "country",
#         "media",
#         "albumdisambig",
#     ]
#     for field in fields:
#         values = [item[field] for item in items if item]
#         likelies[field], freq = plurality(values)
#         consensus[field] = freq == len(values)

#     # If there's an album artist consensus, use this for the artist.
#     if consensus["albumartist"] and likelies["albumartist"]:
#         likelies["artist"] = likelies["albumartist"]

#     return likelies, consensus

#
# likelies, consensus = current_metadata(items)
# cur_artist = cast(str, likelies["artist"])
# cur_album = cast(str, likelies["album"])

# ------------------------------------------------------------------------------------ #
#                                 fields in extra item                                 #
# ------------------------------------------------------------------------------------ #
# Item(
#     id=None,
#     path=b"/Users/paul/para/2_Projects/_shared_data/music/inbox.nosync/John B/Light Speed [ALBUM]/CD1/07 Connected.flac",
#     album_id=None,
#     title="Connected",
#     artist="John B, Kirsty Hawkshaw",
#     artists=[],
#     artists_ids=[],
#     artist_sort="",
#     artists_sort=[],
#     artist_credit="",
#     artists_credit=[],
#     remixer="",
#     album="Light Speed",
#     albumartist="John B",
#     albumartists=[],
#     albumartist_sort="",
#     albumartists_sort=[],
#     albumartist_credit="",
#     albumartists_credit=[],
#     genre="",
#     style="",
#     discogs_albumid=0,
#     discogs_artistid=0,
#     discogs_labelid=0,
#     lyricist="",
#     composer="John B Williams",
#     composer_sort="",
#     work="",
#     mb_workid="",
#     work_disambig="",
#     arranger="",
#     grouping="",
#     year=2012,
#     month=2,
#     day=6,
#     track=7,
#     tracktotal=0,
#     disc=1,
#     disctotal=2,
#     lyrics="",
#     comments="",
#     bpm=0,
#     comp=False,
#     mb_trackid="",
#     mb_albumid="",
#     mb_artistid="",
#     mb_artistids=[],
#     mb_albumartistid="",
#     mb_albumartistids=[],
#     mb_releasetrackid="",
#     trackdisambig="",
#     albumtype="",
#     albumtypes=[],
#     label="",
#     barcode="",
#     acoustid_fingerprint="",
#     acoustid_id="",
#     mb_releasegroupid="",
#     release_group_title="",
#     asin="",
#     isrc="GBLHX1407007",
#     catalognum="",
#     script="",
#     language="",
#     country="",
#     albumstatus="",
#     media="",
#     albumdisambig="",
#     releasegroupdisambig="",
#     disctitle="",
#     encoder="",
#     rg_track_gain=None,
#     rg_track_peak=None,
#     rg_album_gain=None,
#     rg_album_peak=None,
#     r128_track_gain=None,
#     r128_album_gain=None,
#     original_year=0,
#     original_month=0,
#     original_day=0,
#     initial_key=None,
#     length=463.6046031746032,
#     bitrate=1054459,
#     bitrate_mode="",
#     encoder_info="",
#     encoder_settings="",
#     format="FLAC",
#     samplerate=44100,
#     bitdepth=16,
#     channels=2,
#     mtime=1723116460,
#     added=0.0,
# )


# ------------------------------------------------------------------------------------ #
#                          fields in extra track from spotify                          #
# ------------------------------------------------------------------------------------ #

# {'title': "Good Lovin'",
#  'track_id': '3jp1Uz4i9NpjzjCFwFoT28',
#  'release_track_id': None,
#  'artist': 'Peven Everett',
#  'artist_id': '0v2oB2xMS64U3lcU5DFuCY',
#  'artists': [],
#  'artists_ids': [],
#  'length': 334.822,
#  'index': 13,
#  'media': None,
#  'medium': 1,
#  'medium_index': 13,
#  'medium_total': 14,
#  'artist_sort': None,
#  'artists_sort': [],
#  'disctitle': None,
#  'artist_credit': None,
#  'artists_credit': [],
#  'data_source': 'Spotify',
#  'data_url': 'https://open.spotify.com/track/3jp1Uz4i9NpjzjCFwFoT28',
#  'lyricist': None,
#  'composer': None,
#  'composer_sort': None,
#  'arranger': None,
#  'track_alt': None,
#  'work': None,
#  'mb_workid': None,
#  'work_disambig': None,
#  'bpm': None,
#  'initial_key': None,
#  'genre': None,
#  'album': None,
#  'spotify_track_id': '3jp1Uz4i9NpjzjCFwFoT28',
#  'spotify_artist_id': '0v2oB2xMS64U3lcU5DFuCY'}

# ------------------------------------------------------------------------------------ #
#                             fields in extra track from MB                            #
# ------------------------------------------------------------------------------------ #
# {'album': None,
#  'arranger': None,
#  'artist': 'John B feat. NSG',
#  'artist_credit': 'John B feat. NSG',
#  'artist_id': '353856b7-8d79-4136-9ac6-7e47954e5be9',
#  'artist_sort': 'B, John feat. NSG',
#  'artists': ['John B', 'NSG'],
#  'artists_credit': ['John B', 'NSG'],
#  'artists_ids': ['353856b7-8d79-4136-9ac6-7e47954e5be9',
#                  'ecebea6a-c064-4409-9699-b0bf6b5df720'],
#  'artists_sort': ['B, John', 'NSG'],
#  'bpm': None,
#  'composer': 'John B',
#  'composer_sort': 'B, John',
#  'data_source': 'MusicBrainz',
#  'data_url': 'https://musicbrainz.org/recording/3a048c8a-dcf5-4fb6-9406-55d90369657b',
#  'disctitle': None,
#  'genre': None,
#  'index': 14,
#  'initial_key': None,
#  'isrc': 'GBLHX1407032',
#  'length': 386.0,
#  'lyricist': None,
#  'mb_workid': '4895f701-e93a-41e8-95c4-81bc2be4c91d',
#  'media': 'Digital Media',
#  'medium': 1,
#  'medium_index': 14,
#  'medium_total': 15,
#  'release_track_id': '15898957-08f5-3dab-b935-9aa4564d226b',
#  'remixer': '',
#  'title': 'Light Speed (original version)',
#  'track_alt': '14',
#  'track_id': '3a048c8a-dcf5-4fb6-9406-55d90369657b',
#  'trackdisambig': None,
#  'work': 'Light Speed',
#  'work_disambig': None}


from __future__ import annotations
from copy import deepcopy
from dataclasses import dataclass, asdict, field
from collections import namedtuple
import time
from typing import Callable, List, NamedTuple, Union, Any, Dict, TypedDict
from types import GeneratorType
from uuid import uuid4 as uuid

from beets import ui, autotag, config, plugins, importer, IncludeLazyConfig
from beets.ui import _open_library, print_, colorize, UserError
from beets.util import displayable_path, pipeline
from beets.ui.commands import (
    TerminalImportSession,
    choose_candidate,
    _summary_judgment,
    # PromptChoice,
    Counter,
    chain,
    manual_search,
    manual_id,
    abort_action,
    show_change,
    dist_string,
    summarize_items,
)

from beets.autotag import (
    # AlbumMatch,
    # TrackMatch,
    AlbumInfo,
    TrackInfo,
    Item,
    Recommendation,
    Proposal,
    Distance,
)

import eventlet

from beets.util.pipeline import Pipeline
from beets.importer import ImportAbort


from beets_flask.logger import log
from beets_flask.websocket import sio
from beets_flask.config import config
from beets_flask.utility import capture_stdout_stderr

from beets_flask.beets_sessions import BaseSession, set_config_defaults

log.debug("ImportSocket module loaded")

namespace = "/import"
session = None
session_ref = None


def register_import_socket():
    # we need this to at least allow loading the module at the right time
    pass


@sio.on("connect", namespace=namespace)  # type: ignore
def connect(sid, environ):
    """new client connected"""
    log.debug(f"ImportSocket new client connected {sid}")


@sio.on("after_connect", namespace=namespace)  # type: ignore
def after_connect(sid):
    """This needs to be invoked by a callback of the client"""
    if session is not None:
        session.import_state.emit()


@sio.on("disconnect", namespace=namespace)  # type: ignore
def disconnect(sid):
    """client disconnected"""
    log.debug(f"ImportSocket client disconnected {sid}")


@sio.on("*", namespace=namespace)  # type: ignore
def any_event(event, sid, data):
    log.debug(f"ImportSocket sid {sid} undhandled event {event} with data {data}")


@sio.on("start_import_session", namespace=namespace)  # type: ignore
def start_import_session(sid, data):
    """
    Start a new interactive import session. We shall only have one running at a time.
    """
    log.debug(f"received start_import_session {data=}")
    path = data.get("path", None)
    global session, session_ref
    try:
        session_ref.kill()  # type: ignore
    except AttributeError:
        pass
    session = InteractiveImportSession(path)
    session.import_state.emit()
    session_ref = sio.start_background_task(session.run)


class ChoiceRequest(TypedDict):
    selection_id: str
    candidate_idx: int


@sio.on("choose_candidate", namespace=namespace)  # type: ignore
def choice(sid, req: ChoiceRequest):
    """
    User has made a choice. Pass it to the session.
    """
    selection_id = req.get("selection_id", None)
    candidate_idx = req.get("candidate_idx", None)
    log.debug(f"recevied user choice {selection_id=}")
    global session
    if not session is None:
        state = session.import_state.get_selection_state_by_id(selection_id)
        if state is None:
            raise ValueError("No selection state found for task.")
        state.current_candidate_idx = candidate_idx

    # forward state to all other clients
    sio.emit("candidate_choice", req, namespace=namespace)


class CompletionRequest(TypedDict):
    selection_ids: List[str]
    are_completed: List[bool]


@sio.on("complete_selections", namespace=namespace)  # type: ignore
def complete_selections(sid, req: CompletionRequest):
    """
    Mark selection states as completed.
    """
    selection_ids = req.get("selection_ids", [])
    are_completed = req.get("are_completed", [])
    log.debug(f"received completion request {selection_ids=} {are_completed=}")
    if len(selection_ids) != len(are_completed):
        raise ValueError(
            "Selections and completion status do not have the same lengths."
        )
    global session
    if not session is None:
        for i, id in enumerate(selection_ids):
            state = session.import_state.get_selection_state_by_id(id)
            if state is None:
                raise ValueError("No selection state found for task.")
            state.completed = are_completed[i]

    # forward state to all other clients
    sio.emit("selections_completed", req, namespace=namespace)


# type beets classes
@dataclass
class AlbumMatch(NamedTuple):
    distance: Distance
    info: AlbumInfo
    extra_items: list[Item]  # these are tracks in the folder that were not found online
    extra_tracks: list[TrackInfo]  # tracks found online not present in the folder
    mapping: dict[Item, TrackInfo] | None = None


@dataclass
class TrackMatch(NamedTuple):
    distance: Distance
    info: TrackInfo


class PromptChoice(NamedTuple):
    short: str
    long: str
    callback: (
        None | Callable[[BaseSession, importer.ImportTask], importer.action | None]
    )

    def serialize(self):
        return {
            "short": self.short,
            "long": self.long,
            "callback": self.callback.__name__ if self.callback else "None",
        }


@dataclass
class CandidateChoice:
    id: int
    match: Union[AlbumMatch, TrackMatch]
    task: importer.ImportTask  # only needed for diff preview generation
    type: str = "unset"
    diff_preview: str | None = None
    # these are needed for diffs, but they are details of the task, which is not passed to frontend
    cur_artist: str | None = None
    cur_album: str | None = None
    penalties: List[str] = field(default_factory=list)

    def __post_init__(self):
        self.type = "album" if hasattr(self.match, "extra_tracks") else "track"

        out, err, _ = capture_stdout_stderr(
            show_change, self.task.cur_artist, self.task.cur_album, self.match
        )
        self.diff_preview = out.lstrip("\n")
        if len(err) > 0:
            self.diff_preview += f"\n\nError: {err}"

        self.cur_artist = self.task.cur_artist
        self.cur_album = self.task.cur_album

        self.penalties.extend(self.match.distance.keys())

    @property
    def items(self) -> List[Item]:
        return self.task.items

    def serialize(self):
        # currently we try to send everything we have and patch whats needed.
        # TODO: only send what frontend needs.

        self.match.info.decode()
        # beets' AlbumInfo & TrackInfo is a custom implementation of AttributeDict,
        # which has some generators breaking serialization (which i cannot find)
        # I found no way to get around them, except recreating the dict.
        info = _enforce_dict(self.match.info)
        # we need to add the `name` field, because in frontend, we reuse the typings
        # from the library, where we added a `name` field to artist, albums and items.
        info["name"] = self.match.info.album

        info["tracks"] = []
        for track in self.match.info.tracks or []:
            track.decode()
            info["tracks"].append(
                MinimalItemAndTrackInfo.from_item_or_track(track).serialize()
            )

        match = dict()
        match["info"] = info
        match["distance"] = self.match.distance.distance

        if self.type == "album":
            match["extra_items"] = []  # self.match.extra_items
            match["extra_tracks"] = []  # self.match.extra_tracks

            for item in self.match.extra_items or []:  # type: ignore
                match["extra_items"].append(
                    MinimalItemAndTrackInfo.from_item_or_track(item).serialize()
                )

            for track in self.match.extra_tracks or []:  # type: ignore
                track.decode()
                match["extra_tracks"].append(
                    MinimalItemAndTrackInfo.from_item_or_track(track).serialize()
                )

            # the mapping of a beets albummatch uses objects, but we don not want
            # to send them over redundantly. convert to an index mapping,
            # where first index is in self.items, and second is in self.match.info.tracks
            mapping = dict()
            for item, track in self.match.mapping.items():  # type: ignore
                idx = self.items.index(item)
                tdx = self.match.info.tracks.index(track)  # type: ignore
                mapping[idx] = tdx
            match["mapping"] = mapping

        res = dict()
        res["id"] = self.id

        res["track_match"] = match if self.type == "track" else None
        res["album_match"] = match if self.type == "album" else None
        res["diff_preview"] = self.diff_preview
        res["cur_artist"] = self.cur_artist
        res["cur_album"] = self.cur_album
        res["penalties"] = self.penalties
        res["items"] = [
            MinimalItemAndTrackInfo.from_item_or_track(i).serialize()
            for i in self.items
        ]

        return res


def _enforce_dict(d):
    return {k: v for k, v in d.items()}


@dataclass
class MinimalItemAndTrackInfo:
    name: str
    title: str
    artist: str
    album: str
    length: int
    # track info only
    data_source: str
    data_url: str
    index: int  #  1-based
    # item only (before import is done)
    bitrate: int
    format: str
    track: int  #  1-based

    def serialize(self):
        return asdict(self)

    @classmethod
    def from_item_or_track(
        cls, track: Union[TrackInfo, Item]
    ) -> MinimalItemAndTrackInfo:
        kwargs = dict()
        for k in cls.__annotations__.keys():
            kwargs[k] = getattr(track, k, None)
        try:
            kwargs["name"] = getattr(track, "title", None)
        except AttributeError:
            pass
        return cls(**kwargs)


@dataclass
class SelectionState:
    """State to represent a beets ImportTask in the frontend."""

    task: importer.ImportTask
    id: str = str(uuid())
    current_candidate_idx: int | None = None
    completed: bool = False

    @property
    def candidate_choices(self) -> List[CandidateChoice]:
        if self.task is None:
            return []
        return [
            CandidateChoice(i, c, self.task) for i, c in enumerate(self.task.candidates)
        ]

    @property
    def toppath(self) -> str | None:
        if self.task.toppath is not None:
            return self.task.toppath.decode("utf-8")
        return None

    @property
    def paths(self) -> List[str]:
        return [p.decode("utf-8") for p in self.task.paths]

    @property
    def items(self) -> List[Item]:
        return [item for item in self.task.items]

    def serialize(self):
        return {
            "candidates": [c.serialize() for c in self.candidate_choices],
            "current_candidate_idx": self.current_candidate_idx,
            "id": self.id,
            "completed": self.completed,
            "toppath": self.toppath,
            "paths": self.paths,
        }

    def emit(self):
        emit(
            "selection_state",
            self.serialize(),
        )

    def await_completion(self):
        while not self.completed:
            time.sleep(0.5)
        return True


@dataclass
class ImportState:
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

    def upsert_task(self, task: importer.ImportTask, emit=True) -> SelectionState:
        """Adds selection state if it does not exist yet or updates
        existitng entry. Automatically emits the updated state to clients.
        """
        state = self.get_selection_state_for_task(task)

        if state is None:
            state = SelectionState(task)
            self._selection_states.append(state)

        if emit:
            state.emit()

        return state

    @property
    def status(self):
        return self._status

    def set_status(self, status: str, emit=True):
        log.debug(f"ImportState {status=}")
        self._status = status
        if emit:
            self.emit_status()

    def await_completion_all(self):
        while not all([s.completed for s in self.selection_states]):
            time.sleep(0.5)
        return True

    def emit(self):
        emit(
            "import_state",
            {
                "status": self.status,
                "selection_states": [s.serialize() for s in self.selection_states],
            },
        )

    def emit_status(self):
        log.debug(f"ImportState {self.status=}")
        emit(
            "import_state_status",
            {
                "status": self.status,
            },
        )


@pipeline.mutator_stage
def offer_match(session: InteractiveImportSession, task: importer.ImportTask):
    session.offer_match(task)


@pipeline.mutator_stage
def set_status(
    session: InteractiveImportSession, status: str, task: importer.ImportTask
):
    log.debug(f"mutator_stage {status=}")
    session.import_state.set_status(status)


class InteractiveImportSession(BaseSession):
    # current session state
    import_state = ImportState()

    task: importer.ImportTask | None = None
    pipeline: Pipeline | None = None

    def __init__(self, path: str, config_overlay: str | dict | None = None):
        set_config_defaults()
        super(InteractiveImportSession, self).__init__(path, config_overlay)
        self.import_state.set_status("session ready", emit=False)

    def offer_match(self, task: importer.ImportTask):
        self.import_state.upsert_task(task)

        # tell plugins we are starting user_query
        results = plugins.send("import_task_before_choice", session=self, task=task)
        actions = [action for action in results if action]
        # but do not support actions via gui (yet?)
        if len(actions) > 0:
            raise ValueError(
                "Plugins are not allowed to return actions for GUI Sessions"
            )

    def choose_match(self, task: importer.ImportTask):
        """
        Needs to return an AlbumMatch object, ASIS, or SKIP.

        this blocks the stages pipeline, until choose_match invoked by each task has
        returned one of the above.
        """
        state = self.import_state.get_selection_state_for_task(task)

        if state is None:
            raise ValueError("No selection state found for task.")

        # BLOCKING
        state.await_completion()

        if state.current_candidate_idx is None:
            raise ValueError("No candidate selected.")

        match = task.candidates[state.current_candidate_idx]

        return match

    def run(self):
        """Run the import task. Customized version of ImportSession.run"""
        self.logger.info(f"import started {time.asctime()}")
        self.set_config(config["import"])

        self.import_state.set_status("reading files")
        stages = [
            # mutator stage does not work for first task, set status manually
            importer.read_tasks(self),
        ]

        if self.config["group_albums"] and not self.config["singletons"]:
            stages += [
                set_status(self, "grouping albums"),  # type: ignore
                importer.group_albums(self),
            ]

        stages += [
            set_status(self, "looking up candidates"),  # type: ignore
            importer.lookup_candidates(self),  # type: ignore
            offer_match(self),  # type: ignore
            set_status(self, "waiting for user selection"),  # type: ignore
            importer.user_query(self),  # type: ignore
        ]

        # Plugin stages.
        for stage_func in plugins.early_import_stages():
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore
        for stage_func in plugins.import_stages():
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore

        stages += [
            set_status(self, "manipulating files"),  # type: ignore
            importer.manipulate_files(self),  # type: ignore
        ]

        self.pipeline = Pipeline(stages)

        # Run the pipeline.
        plugins.send("import_begin", session=self)
        try:
            self.pipeline.run_sequential()
        except ImportAbort:
            self.logger.debug(f"Interactive import session aborted by user")

        self.import_state.set_status("completed")


def is_client_connected():
    rooms = sio.manager.rooms.get(namespace)
    return rooms is not None and len(rooms) > 0


def emit(event: str, data: Dict[str, Any]):
    sio.emit(
        event,
        data,
        namespace=namespace,
        # callback=confirm(id),
    )
