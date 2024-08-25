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


def album_folders_from_track_paths(track_paths: list):
    """Get all album folders from a list of paths to files.
    Assumes the last folder-level to be album.

    Args:
        track_paths (list): list of track paths, e.g. mp3 files

    Returns:
        list: album folders
    """

    album_folders = []
    for path in track_paths:
        if os.path.isfile(path):
            album_folders.append(os.path.dirname(os.path.abspath(path)))
        elif is_album_folder(path):
            album_folders.append(os.path.abspath(path))

    return sorted(
        [str(folder) for folder in set(album_folders)], key=lambda s: s.lower()
    )


def is_album_folder(path):
    if os.path.isdir(path):
        for file in os.listdir(path):
            if file.lower().endswith(ut.AUDIO_EXTENSIONS):
                return True
    return False


def all_album_folders(root_dir: str):
    files = sorted(glob.glob(root_dir + "/**/*", recursive=True))
    return album_folders_from_track_paths(files)


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
