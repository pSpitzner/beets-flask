"""
Typed versions of data classes that beets uses, and our own derivatives.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Callable, List, Literal, NamedTuple, Union, Any, Dict, TypedDict

from beets import autotag


class AlbumMatch(NamedTuple):
    distance: autotag.Distance
    info: autotag.AlbumInfo
    # these are tracks in the folder that were not found online
    extra_items: list[autotag.Item]
    # tracks found online not present in the folder
    extra_tracks: list[autotag.TrackInfo]
    # mapping from item -> trackinfo to match items on diks with tracks found online
    mapping: dict[autotag.Item, autotag.TrackInfo] | None = None


class TrackMatch(NamedTuple):
    distance: autotag.Distance
    info: autotag.TrackInfo


class PromptChoice(NamedTuple):
    short: str
    long: str
    callback: None | Callable

    def serialize(self):
        return {
            "short": self.short,
            "long": self.long,
            "callback": self.callback.__name__ if self.callback else "None",
        }


@dataclass
class MusicInfo:
    """
    Items (music files on disk), tracks (trackinfo), and album info are somewhat similar.
    They share many fields --- especially once music has been imported.
    In beets there is no shared baseclass from which the three inherit, but such a common
    base class helps in the frontend.

    This is a minimal version of this, where fields exclsuive to one type are None for the
    others. (and inconsistent fields could get renamed?)
    """

    type: Literal["item", "track", "album"]

    artist: str | None
    album: str | None
    data_url: str | None
    data_source: str | None
    year: int | None
    genre: str | None
    media: str | None

    def serialize(self):
        return asdict(self)

    @classmethod
    def from_instance(
        cls, info: Union[autotag.TrackInfo, autotag.Item, autotag.AlbumInfo]
    ) -> MusicInfo:
        kwargs = _class_attributes_to_kwargs(cls, info)
        if isinstance(info, autotag.TrackInfo):
            kwargs["type"] = "track"
        elif isinstance(info, autotag.Item):
            kwargs["type"] = "item"
        elif isinstance(info, autotag.AlbumInfo):
            kwargs["type"] = "album"

        return cls(**kwargs)


def _class_attributes_to_kwargs(cls, obj, keys=None) -> Dict[str, Any]:
    """
    Convert the attributes of an object to a dictionary of keyword arguments
    for a class. If `keys` is provided, only include those keys.
    """
    if keys is None:
        keys = cls.__dataclass_fields__.keys()
    kwargs = dict()
    for k in keys:
        kwargs[k] = getattr(obj, k, None)
    return kwargs


@dataclass
class AlbumInfo(MusicInfo):
    """
    A more specific version of MusicInfo for albums.
    Attributes are an indicator of what might be available, and can be None.
    """

    # disambiguation
    mediums: int | None  #  number of discs
    country: str | None
    label: str | None
    catalognum: str | None
    albumdisambig: str | None

    # Note: dont add 'tracks' here, our candidate states lift them already from album matches


@dataclass
class TrackInfo(MusicInfo):
    """
    A more specific version of MusicInfo for tracks.
    Attributes are an indicator of what might be available, and can be None.
    """

    title: str | None
    length: float | None
    isrc: str | None
    index: int | None  #  1-based


@dataclass
class ItemInfo(MusicInfo):
    """
    A more specific version of MusicInfo for items.
    Attributes are an indicator of what might be available, and can be None.
    """

    title: str | None
    length: float | None
    isrc: str | None
    track: int | None  #  1-based, todo: make consistent with TrackInfo.index

    bitrate: int | None
    format: str | None


class SerializedSelectionState(TypedDict):
    id: str
    candidate_states: List[SerializedCandidateState]
    current_candidate_idx: int | None
    items: List[Dict]  #  ItemInfo
    completed: bool
    toppath: str | None
    paths: List[str]


class SerializedCandidateState(TypedDict):
    id: int
    diff_preview: str | None
    cur_artist: str
    cur_album: str
    penalties: List[str]
    type: str
    distance: float
    info: Dict  # AlbumInfo | TrackInfo

    items: List[Dict] | None  #  ItemInfo TODO: infer in frontend from selection state
    tracks: List[Dict] | None  #  TrackInfo
    extra_tracks: List[Dict] | None  #  TrackInfo
    extra_items: List[Dict] | None  #  ItemInfo

    mapping: Dict[int, int] | None


""" Communicator requests
"""


class ChoiceRequest(TypedDict):
    event: Literal["choice"]
    selection_id: str
    candidate_idx: int


class CompleteRequest(TypedDict):
    event: Literal["complete"]
    selection_ids: List[str]
    are_completed: List[bool]


class ImportStateUpdate(TypedDict):
    event: Literal["import_state"]
    selection_states: List[SerializedSelectionState]


class SelectionStateUpdate(TypedDict):
    event: Literal["selection_state"]
    selection_state: SerializedSelectionState


class CandidateStateUpdate(TypedDict):
    event: Literal["candidate_state"]
    candidate_state: SerializedCandidateState


StateUpdate = Union[ImportStateUpdate, SelectionStateUpdate, CandidateStateUpdate]
