"""
Typed versions of data classes that beets uses.
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
class MinimalItemAndTrackInfo:
    """
    Items (music files on disk) and tracks (trackinfo) are very similar, and share
    many fields --- especially once music has been imported.
    In beets there is no shared baseclass from which both inherit, but we need  it
    in the frontend.

    This is a minimal version of both, where inconsistent fields are renamed, and
    fields exclsuive to one type are None for the other.
    """

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
        cls, track: Union[autotag.TrackInfo, autotag.Item]
    ) -> MinimalItemAndTrackInfo:
        kwargs = _class_attributes_to_kwargs(cls, track)
        try:
            kwargs["name"] = getattr(track, "title", None)
        except AttributeError:
            pass
        return cls(**kwargs)

    # todo: explizit mapping for track and item to uniformize the fields
    # with input type detection in a wrapper


@dataclass
class MinimalAlbumInfo:
    """
    Minimal version of AlbumInfo.
    """

    name: str | None
    album: str | None
    artist: str | None
    data_source: str | None
    data_url: str | None
    year: int | None
    # we do not include tracks here, parse and lift manually!

    def serialize(self):
        return asdict(self)

    @classmethod
    def from_album_info(cls, info: autotag.AlbumInfo) -> MinimalAlbumInfo:
        kwargs = _class_attributes_to_kwargs(cls, info)
        try:
            kwargs["name"] = getattr(info, "album", None)
        except AttributeError:
            pass
        return cls(**kwargs)


def _class_attributes_to_kwargs(cls, obj, keys=None) -> Dict[str, Any]:
    """
    Convert the attributes of an object to a dictionary of keyword arguments
    for a class. If `keys` is provided, only include those keys.
    """
    if keys is None:
        keys = cls.__annotations__.keys()
    kwargs = dict()
    for k in keys:
        kwargs[k] = getattr(obj, k, None)
    return kwargs


class SerializedSelectionState(TypedDict):
    id: str
    candidate_states: List[SerializedCandidateState]
    current_candidate_idx: int | None
    items: List[MinimalItemAndTrackInfo]
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
    info: Dict  # MinimalAlbumInfo | MinimalItemAndTrackInfo

    tracks: List[Dict] | None  #  MinimalItemAndTrackInfo
    extra_tracks: List[Dict] | None  #  MinimalItemAndTrackInfo
    extra_items: List[Dict] | None  #  MinimalItemAndTrackInfo


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
