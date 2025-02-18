"""Typed versions of data classes that beets uses.

Also includes and our own derivatives.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Literal,
    NamedTuple,
    TypedDict,
    Union,
)

from beets import autotag
from beets.autotag.hooks import AlbumInfo as BeetsAlbumInfo
from beets.autotag.hooks import AlbumMatch as BeetsAlbumMatch
from beets.autotag.hooks import TrackInfo as BeetsTrackInfo
from beets.autotag.hooks import TrackMatch as BeetsTrackMatch

__all__ = [
    # Our stuff
    "MusicInfo",
    "TrackInfo",
    "ItemInfo",
    "AlbumInfo",
    # Beets stuff
    "BeetsAlbumMatch",
    "BeetsTrackMatch",
    "BeetsAlbumInfo",
    "BeetsTrackInfo",
]


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
    """Shared info for tracks, items and albums.

    Items (music files on disk), tracks (trackinfo), and album info are somewhat similar.
    They share many fields --- especially once music has been imported.
    In beets there is no shared baseclass from which the three inherit, but such a common
    base class helps in the frontend.

    This is a minimal version of this, where fields exclsuive to one type are None for the
    others. (and inconsistent fields could get renamed?)

    @PS: Shouldn't this be an abstract class?
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
        kwargs = class_attributes_to_kwargs(cls, info)
        if isinstance(info, autotag.TrackInfo):
            kwargs["type"] = "track"
        elif isinstance(info, autotag.Item):
            kwargs["type"] = "item"
        elif isinstance(info, autotag.AlbumInfo):
            kwargs["type"] = "album"

        return cls(**kwargs)

    def __repr__(self) -> str:
        res = f"{self.__class__.__name__}"
        res += f"{self.type=} "
        res += f"{self.artist=} "
        res += f"{self.album=}"
        return res


def class_attributes_to_kwargs(cls, obj, keys=None) -> Dict[str, Any]:
    """Convert the attributes of an object to a dictionary of keyword arguments.

    May be used for any class. If `keys` is provided, only those keys are used.
    """
    if keys is None:
        keys = cls.__dataclass_fields__.keys()
    kwargs = dict()
    for k in keys:
        kwargs[k] = getattr(obj, k, None)
    return kwargs


@dataclass
class AlbumInfo(MusicInfo):
    """Mre specific version of MusicInfo for albums.

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
    """More specific version of MusicInfo for tracks.

    Attributes are an indicator of what might be available, and can be None.
    """

    title: str | None
    length: float | None
    isrc: str | None
    index: int | None  #  1-based

    def __repr__(self) -> str:
        return super().__repr__() + f" {self.title=}"


@dataclass
class ItemInfo(MusicInfo):
    """More specific version of MusicInfo for items.

    Corresponds to a music file or library item with file on disk.

    Attributes are an indicator of what might be available, and can be None.
    """

    title: str | None
    length: float | None
    isrc: str | None
    track: int | None  #  1-based, todo: make consistent with TrackInfo.index

    path: str | None
    bitrate: int | None
    format: str | None

    def __repr__(self) -> str:
        return super().__repr__() + f" {self.title=} at {self.path}"
