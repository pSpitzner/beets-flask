"""Typed versions of data classes that beets uses.

Also includes and our own derivatives.
"""

from __future__ import annotations

from abc import ABC
from dataclasses import asdict, dataclass
from typing import (
    Any,
    Callable,
    Dict,
    Literal,
    NamedTuple,
    Union,
    cast,
)

from beets import autotag
from beets.autotag.hooks import AlbumInfo as BeetsAlbumInfo
from beets.autotag.hooks import AlbumMatch as BeetsAlbumMatch
from beets.autotag.hooks import TrackInfo as BeetsTrackInfo
from beets.autotag.hooks import TrackMatch as BeetsTrackMatch
from beets.library import Album as BeetsAlbum
from beets.library import Item as BeetsItem
from beets.library import Library as BeetsLibrary

__all__ = [
    # Our stuff
    "MusicInfo",
    "TrackInfo",
    "ItemInfo",
    "AlbumInfo",
    "DuplicateAction",
    # Beets stuff
    "BeetsAlbum",
    "BeetsAlbumInfo",
    "BeetsAlbumMatch",
    "BeetsItem",
    "BeetsTrackInfo",
    "BeetsTrackMatch",
    "BeetsLibrary",
]

# to be consistent with beets, here we do not use an enum.
# (beets uses strings for duplicate actions)
DuplicateAction = Literal["skip", "keep", "remove", "merge", "ask"]


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
class MusicInfo(ABC):
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

    @classmethod
    def _from_instance(
        cls,
        info: Union[autotag.TrackInfo, autotag.Item, autotag.AlbumInfo],
        remap: Dict[str, str] = dict(),
    ):
        """Convert from beets TrackInfo, Item or AlbumInfo to our MusicInfo.

        You should only call this in from_beets() methods of the derived classes.
        """
        kwargs = class_attributes_to_kwargs(cls, info, remap=remap)
        if isinstance(info, autotag.TrackInfo):
            kwargs["type"] = "track"
            return TrackInfo(**kwargs)
        elif isinstance(info, autotag.Item):
            return ItemInfo(**kwargs)
        elif isinstance(info, autotag.AlbumInfo):
            kwargs["type"] = "album"
            return AlbumInfo(**kwargs)

        raise ValueError(f"Unknown type of info: {info}")

    def __repr__(self) -> str:
        res = f"{self.__class__.__name__}"
        res += f"{self.type=} "
        res += f"{self.artist=} "
        res += f"{self.album=}"
        return res


def class_attributes_to_kwargs(
    cls,
    obj,
    keys=None,
    remap: Dict[str, str] = dict(),
) -> Dict[str, Any]:
    """Convert the attributes of an object to a dictionary of keyword arguments.

    May be used for any class. If `keys` is provided, only those keys are used.

    Remap allows to map the keys of the object to different keys in the dictionary.
    E.g. if the object has an attribute 'track' and you want to use 'index' in the
    dictionary, you can use `remap={"track": "index"}`.

    Paramters
    ---------
    cls: class
        The class of the object to convert _to_ e.g. TrackInfo
    obj: object
        The object to convert _from_ i.e. Datatype from beets

    """
    if keys is None:
        keys = cls.__dataclass_fields__.keys()
        # {'index', ...}
    kwargs = dict()
    for k in keys:
        kwargs[k] = getattr(obj, k, None)
    for k in remap.keys():
        kwargs[remap[k]] = getattr(obj, k, None)
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
    @classmethod
    def from_beets(cls, info: autotag.AlbumInfo):
        """Helper to convert from beets AlbumInfo to our AlbumInfo."""
        return cast(
            AlbumInfo,
            cls._from_instance(info),
        )


@dataclass
class TrackInfo(MusicInfo):
    """More specific version of MusicInfo for tracks.

    Attributes are an indicator of what might be available, and can be None.
    """

    title: str | None
    length: float | None
    isrc: str | None

    # Allows to compute the mapping in the frontend
    index: int | None  #  1-based
    medium_index: int | None
    medium: int | None

    @classmethod
    def from_beets(cls, info: autotag.TrackInfo):
        """Helper to convert from beets TrackInfo to our TrackInfo."""
        return cast(
            TrackInfo,
            cls._from_instance(info),
        )


@dataclass
class ItemInfo(MusicInfo):
    """More specific version of MusicInfo for items.

    Corresponds to a music file or library item with file on disk.

    Attributes are an indicator of what might be available, and can be None.
    """

    title: str | None
    length: float | None
    isrc: str | None

    index: int | None  # 1-based

    path: str | None
    bitrate: int | None
    format: str | None

    @property
    def track(self) -> int | None:
        """Track number of the item.

        In beets vanilla types are somewhat inconsistent, which makes frontend
        code hard to understand.
        items.track for files on disk (1-based index for track number)
        track.index for meta data from candidates (1-based index)
        we consistently used `.index`
        """
        return self.index

    @classmethod
    def from_beets(cls, info: autotag.Item):
        """Helper to convert from beets Item to our ItemInfo."""
        return cast(
            ItemInfo,
            cls._from_instance(
                info,
                # beets' vanilla types are somewhat inconsistent, which makes frontend
                # code hard to understand.
                # items.track for files on disk (1-based index for track number)
                # track.index for meta data from candidates (1-based index)
                # we consistently used `.index`
                remap={"track": "index"},
            ),
        )
