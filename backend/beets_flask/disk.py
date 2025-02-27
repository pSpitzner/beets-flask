from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from typing import (
    List,
    Literal,
    Mapping,
    NotRequired,
    Sequence,
    Set,
    TypedDict,
)

from beets.importer import MULTIDISC_MARKERS, MULTIDISC_PAT_FMT, albums_in_dir
from cachetools import Cache, TTLCache, cached

from beets_flask.dirhash_custom import dirhash_c
from beets_flask.logger import log


class Folder(TypedDict):
    type: Literal["directory"]
    children: Sequence[Folder | File]
    full_path: str
    hash: str

    # FIXME: Old stuff (needs some more thought)
    is_inbox: NotRequired[bool]
    is_album: NotRequired[bool]


class File(TypedDict):
    type: Literal["file"]
    full_path: str
    # FIXME: remove this once we fix frontend
    is_album: NotRequired[bool]
    is_inbox: NotRequired[bool]


@cached(cache=TTLCache(maxsize=1024, ttl=900), info=True)
def path_to_dict(root_dir: Path | str, relative_to="/", subdirs=True):
    """Generate our nested dict structure for the specified path.

    # TODO: fix docstring
    Each level in the folder hierarchy is a dict with the following keys:
        * "type": "directory" | "file"
        * "is_album": bool
        * "full_path": str
        * "children": dict

    # Args:
    - root_dir (str): The root directory to start from.
    - relative_to (str): The path to be stripped from the full path.
    - subdirs (bool, optional): Whether to mark qualifying subfolders of an album as album folders themselves. If true, e.g. for `/album/CD1/track.mp3` both `/album/` and `/album/CD1/` are flagged. Defaults to True.

    # Returns:
    - dict: The nested dict structure.
    """
    if isinstance(root_dir, str):
        root_dir = Path(root_dir)

    if not root_dir.is_dir():
        raise FileNotFoundError(f"Path `{root_dir}` does not exist or is no directory.")

    # FIXME: Add is_album again
    # album_folders = all_album_folders(root_dir, subdirs=subdirs)

    # Cache for the dirhash function
    cache: Cache[str, bytes] = Cache(maxsize=2**15)

    # Object that contains all tree elements
    lookup: Mapping[str, Folder] = dict()

    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=False):

        # As we iterate from bottom to top, we can access the elements from
        # the lookup table as they are already created
        children: list[Folder | File] = [
            lookup[os.path.join(dirpath, sub_dir)] for sub_dir in dirnames
        ]

        # Add all files to children
        for filename in filenames:
            full_path = os.path.join(dirpath, filename)
            children.append(
                File(
                    type="file",
                    full_path=full_path,
                )
            )

        # Add current directory to lookup
        lookup[dirpath] = Folder(
            type="directory",
            children=children,
            full_path=dirpath,
            hash=dirhash_c(dirpath, cache).hex(),
            # is_album=Path(dirpath) in album_folders,
        )

    return lookup[str(root_dir)]


def album_folders_from_track_paths(
    track_paths: List[Path] | List[str], use_parent_for_multidisc: bool = True
) -> List[Path]:
    """Get all album folders from a list of paths to files.

    Parameters
    ----------
    track_paths : List[Path]
        List of track paths, e.g. mp3 files.
    use_parent_for_multidisc : bool, optional
        When files are in an album folder that might be a multi-disc folder (e.g. `/album/cd1`),
        return the parent (`/album`) instead of the lowest-level-folder (`/cd1`). Defaults to True.

    Returns
    -------
        List[str]: album folders
    """

    folders_to_check: Set[Path] = set()
    for path in track_paths:
        # FIXME: For backwards compatibility, we allow a string as input
        if isinstance(path, str):
            path = Path(path)

        if path.is_file():
            folders_to_check.add(path.parent.resolve())
        else:
            # just to be nice and manage directories instead of files
            folders_to_check.add(path.resolve())

    album_folders: Set[Path] = set()
    for folder in folders_to_check:
        afs = all_album_folders(folder, subdirs=True)
        for af in afs:
            album_folders.add(af)

    if use_parent_for_multidisc:
        parents: Set[Path] = set()
        children: Set[Path] = set()
        for folder in album_folders:
            if is_within_multi_dir(folder):
                parents.add(folder.parent)
                children.add(folder)

        album_folders = album_folders - children
        album_folders = album_folders.union(parents)

    return sorted(album_folders, key=lambda s: str(s).lower())


def is_album_folder(path: Path | str | bytes):
    if isinstance(path, Path):
        path = str(path).encode("utf-8")
    if isinstance(path, str):
        path = path.encode("utf-8")
    for paths, _ in albums_in_dir(path):
        if path in paths:
            return True
    return False


def all_album_folders(root_dir: Path | str, subdirs: bool = False) -> List[Path]:
    """
    Get all album folders from a given root dir.

    Parameters
    ----------
    root_dir : str
        toppath, highest level to start searching.
    subdirs : bool, optional
        Whether to return subfolders of an album that themselves would qualify.
        E.g. a `CD1` folder. Defaults to False.

    Returns
    -------
        List[Path]
    """

    # FIXME: For backwards compatibility, we allow a string as input
    if isinstance(root_dir, str):
        root_dir = Path(root_dir)

    folders: list[bytes] = []
    for paths, _ in albums_in_dir(root_dir.absolute()):
        if subdirs:
            folders.extend(p for p in paths)
        else:
            # the top-level path is always the first in the list
            # however, there is an edgecase, if we have a rogue element in a multi-disc folder:
            # artist/album/should_not_be_here.mp3
            # artist/album/CD1/track.mp3
            # artist/album/CD2/track.mp3
            # then albums_in_dir returns [album], [CD1, CD2] so that picking the first element is wrong. we would want all 3: album, CD1 and CD2. but in this case, the parent `album` should already be in our set when we check [CD1, CD2]
            if os.path.dirname(paths[0]) in folders:
                folders.extend(p for p in paths)
            else:
                folders.append(paths[0])

    return [Path(f.decode("utf-8")) for f in folders]


def is_within_multi_dir(path: Path | str) -> bool:
    """
    Minimal version of beets heuristic to check if a string matches a multi-disc pattern.

    E.g. "My Album CD1" or "Disc 2" will return True
    """

    # FIXME: For backwards compatibility, we allow a string as input
    if isinstance(path, str):
        path = Path(path)

    path_str = path.name  # Use pathlib to get the basename

    for marker in MULTIDISC_MARKERS:
        p = MULTIDISC_PAT_FMT.replace(b"%s", marker)
        marker_pat = re.compile(p, re.I)
        match = marker_pat.match(path_str.encode("utf-8"))
        if match:
            return True
    return False


@cached(cache=TTLCache(maxsize=1024, ttl=60), info=True)
def dir_size(path: Path) -> int:
    """Size of a dir in bytes, including content."""
    try:
        result = subprocess.run(
            ["du", "-sb", str(path.resolve())],
            capture_output=True,
            text=True,
            check=True,
        )
        size = int(result.stdout.split()[0])
        return size
    except Exception as e:
        # this happens e.g. if the directory does not exist.
        log.error(e)
        return -1


__all__ = [
    "dir_size",
]
