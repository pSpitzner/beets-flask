import os
import re
import glob
import subprocess
from typing import List, OrderedDict
from cachetools import cached, LRUCache, TTLCache
from pathlib import Path

from beets.importer import albums_in_dir, MULTIDISC_PAT_FMT, MULTIDISC_MARKERS

from beets_flask.logger import log


@cached(cache=TTLCache(maxsize=1024, ttl=900), info=True)
def path_to_dict(root_dir, relative_to="/") -> dict:
    """
    Generate our nested dict structure for the specified path.
    Each level in the folder hierarchy is a dict with the following keys:
        * "type": "directory" | "file"
        * "is_album": bool
        * "full_path": str
        * "children": dict

    # Args:
    - root_dir (str): The root directory to start from.
    - relative_to (str): The path to be stripped from the full path.

    # Returns:
    - dict: The nested dict structure.
    """

    if not os.path.isdir(root_dir):
        raise FileNotFoundError(f"Path `{root_dir}` does not exist or is no directory.")

    files = glob.glob(root_dir + "/**/*", recursive=True)
    files = sorted(files, key=lambda s: s.lower())
    album_folders = album_folders_from_track_paths(files)
    folder_structure = {
        "type": "directory",
        "is_album": relative_to in album_folders,
        "full_path": relative_to,
        "children": {},
    }
    for file in files:
        f = file[len(relative_to) :] if file.startswith(relative_to) else file
        path_components = [p for p in f.split("/") if p]
        current_dict = folder_structure
        current_path = relative_to
        for component in path_components:
            current_path = os.path.join(current_path, component)
            if component not in current_dict["children"]:
                current_dict["children"][component] = {
                    "type": "file" if os.path.isfile(file) else "directory",
                    "is_album": current_path in album_folders,
                    "full_path": current_path,
                    "children": {},
                }
            current_dict = current_dict["children"][component]

    return folder_structure


def tree(folder_structure) -> str:
    """Simple tree-like string representation of our nested dict structure that reflects file paths.

    # Args:
        folder_structure (dict): The nested dict structure.
    """

    def _tree(d, prefix=""):
        contents = d["children"].keys()
        pointers = ["├── "] * (len(contents) - 1) + ["└── "]
        for pointer, name in zip(pointers, contents):
            yield prefix + pointer + name
            if d[name].get("__type") == "directory":
                extension = "│   " if pointer == "├── " else "    "
                yield from _tree(d[name], prefix=prefix + extension)

    res = ""
    for line in _tree(folder_structure):
        res += line + "\n"
    return res


def album_folders_from_track_paths(
    track_paths: List[str], subdirs: bool = False
) -> List[str]:
    """Get all album folders from a list of paths to files.

    Args:
        track_paths (List[str]): list of track paths, e.g. mp3 files
        subdirs (bool, optional): Whether to return subfolders of an album that themselves would qualify. E.g. a `CD1` folder. Defaults to False.

    Returns:
        List[str]: album folders
    """

    folders_to_check = set()
    for path in track_paths:
        if os.path.isfile(path):
            folders_to_check.add(os.path.dirname(os.path.abspath(path)))
        else:
            # just to be nice and manage directories instead of files
            folders_to_check.add(os.path.abspath(path))

    album_folders = set()
    for folder in folders_to_check:
        afs = all_album_folders(folder, subdirs=subdirs)
        for af in afs:
            album_folders.add(af)

    return sorted([str(folder) for folder in album_folders], key=lambda s: s.lower())


def is_album_folder(path):
    path = path.encode("utf-8")
    for paths, _ in albums_in_dir(path):
        if path in paths:
            return True
    return False


def all_album_folders(root_dir: str, subdirs: bool = False) -> List[str]:
    """
    Get all album folders from a given root dir.

    Args:
        root_dir (str): toppath, highest level to start searching.
        subdirs (bool, optional): Whether to return subfolders of an album that themselves would qualify. E.g. a `CD1` folder. Defaults to False.

    Returns:
        List[str]
    """
    folders = []
    for paths, _ in albums_in_dir(root_dir):
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

    return [f.decode("utf-8") for f in folders]


# cache data for no longer than one minutes
@cached(cache=TTLCache(maxsize=1024, ttl=60), info=True)
def dir_size(path: Path):
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


def is_within_multi_dir(path) -> bool:
    """
    Minimal version of beets heuristic to check if a string matches a multi-disc pattern.

    E.g. "CD1" or "Disc 2" will return True
    """
    try:
        # basename gives '' if we have a trailing /
        if path[-1] == os.sep:
            path = path[:-1]
    except:
        pass
    for marker in MULTIDISC_MARKERS:
        p = MULTIDISC_PAT_FMT.replace(b"%s", marker)
        marker_pat = re.compile(p, re.I)
        match = marker_pat.match(os.path.basename(path).encode("utf-8"))
        if match:
            return True
    return False
