import os
import glob
from typing import List, OrderedDict
from cachetools import cached, LRUCache, TTLCache
import threading
from time import time
from datetime import datetime
from pathlib import Path
from watchdog.observers import Observer
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler, FileSystemEvent, FileMovedEvent

from beets_flask import invoker
from beets_flask import utility as ut
from beets_flask.db_engine import db_session
from beets_flask.models.tag import Tag
from beets_flask.logger import log
from beets_flask.config import config


# ------------------------------------------------------------------------------------ #
#                                   init and watchdog                                  #
# ------------------------------------------------------------------------------------ #

_inboxes : List[OrderedDict] = []

def register_inboxes():

    global _inboxes
    _inboxes = config["gui"]["inbox"]["folders"].get()  # type: ignore

    for i in _inboxes:
        i["last_tagged"] = None


    if os.environ.get("RQ_WORKER_ID", None):
        # only launch the observer on the main process
        return

    num_watched_inboxes = len([i for i in _inboxes if i["autotag"]])
    if num_watched_inboxes == 0:
        return

    handler = InboxHandler()
    observer = PollingObserver(timeout=handler.poll_interval)

    for inbox in _inboxes:
        if not inbox["autotag"]:
            log.debug(f'Skipping observer for inbox {inbox["path"]}')
            continue

        log.debug(f'Starting observer for {inbox["path"]}')
        try:
            # the polling observer worked more reliably for me than the default observer.
            observer.schedule(handler, path=inbox["path"], recursive=True)
        except FileNotFoundError:
            log.error(
                f'Could not find inbox directory ({inbox["path"]}). Check your config!'
            )
            continue

    observer.start()

    def try_to_import(observer, handler):
        try:
            while observer.is_alive():
                observer.join(1)
                handler.try_to_import()
        finally:
            log.error("observer died")
            observer.stop()
            observer.join()

    threading.Thread(
        target=try_to_import, args=(observer, handler), daemon=True
    ).start()


class InboxHandler(FileSystemEventHandler):

    def __init__(self):
        self.debounce = {}
        self.debounce_window = 30  # seconds
        self.poll_interval = 5  # seconds
        super().__init__()

    def try_to_import(self):
        """
        Import paths that had no event for a few seconds (following DEBOUNCE_WINDOW).
        Cleanup paths that have been imported.
        """
        if self.debounce:
            limit = time() - self.debounce_window
            for path, timestamp in list(self.debounce.items()):
                if timestamp <= 0:
                    del self.debounce[path]
                elif timestamp <= limit:
                    self.debounce[path] = -1
                    log.info("Processing %s", path)
                    retag_folder(path)

    def on_any_event(self, event: FileSystemEvent):
        log.debug("got %r", event)

        if isinstance(event, FileMovedEvent):
            fullpath = event.dest_path
        else:
            fullpath = event.src_path
        if os.path.basename(fullpath).startswith("."):
            return

        # trigger cache clear and gui update of inbox directories
        path_to_dict.cache.clear()  # type: ignore
        ut.update_client_view("inbox")

        try:
            album_folder = album_folders_from_track_paths([fullpath])[0]
        except IndexError:
            log.debug(f"File change at {fullpath} but is no album_folder")
            return

        current = self.debounce.get(album_folder, 1)
        if current > 0:
            self.debounce[album_folder] = time()


def retag_folder(path: str, kind: str | None = None):
    """
    For a single folder, we are fine with retagging a bit eagerly.
    Anything whose status is not in
        ["pending", "tagging", "importing", "imported", "cleared"]
    will get a new preview.
    E.g. when files are added over time, we would want to reduce the number of missing tracks.
    """

    inbox = get_inbox_for_path(path)

    if inbox and kind is None:
        kind = inbox["kind"]

    if kind is None:
        raise ValueError(f"Autotagging kind not found for path: {path}")

    log.debug(f"retagging {path} with kind {kind} ...")

    status = invoker.tag_status(path=path)
    if status in ["pending", "tagging", "importing", "imported", "cleared"]:
        log.debug(f"folder {path} is {status}. skipping")
        return
    else:
        log.debug(f"tagging folder {path}")
        invoker.enqueue_tag_path(path, kind=kind)

    if inbox:
        inbox["last_tagged"] = datetime.now().isoformat()


def retag_inbox(
    inbox_dir: str,
    with_status: list[str] = ["unmatched", "failed", "tagged", "notag"],
    kind: str | None = None,
):
    """
    Refresh an inbox folder, retagging all its subfolders
    """

    inbox = get_inbox_for_path(inbox_dir)

    if inbox and kind is None:
        kind = inbox["kind"]

    if kind is None:
        raise ValueError(f"Autotagging kind not found for {inbox_dir=}")

    log.debug(f"Refreshing all folders in {inbox_dir} to {kind=} {with_status=}")

    # first do the tags that dont have any info yet, or had problems.
    todo_first = []
    todo_second = []
    for f in all_album_folders(inbox_dir):
        status = invoker.tag_status(f)
        if status is not None and status not in with_status:
            log.debug(f"folder {f} has {status=}. skipping")
            continue
        if status is None or status != "tagged":
            todo_first.append(f)
        else:
            todo_second.append(f)
        log.debug(f"tagging folder {f} with status {status}")

    for f in todo_first + todo_second:
        retag_folder(f, kind=kind)


# ------------------------------------------------------------------------------------ #
#                                        inboxes                                       #
# ------------------------------------------------------------------------------------ #

def get_inbox_for_path(path):
    inbox = None
    for i in _inboxes:
        if path.startswith(i['path']):
            inbox = i
            break
    return inbox

def get_inbox_folders() -> List[str]:
    return [i["path"] for i in _inboxes]

def get_inboxes():
    return _inboxes

# ------------------------------------------------------------------------------------ #
#                                   folder structure                                   #
# ------------------------------------------------------------------------------------ #



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
        elif os.path.isdir(path):
            for file in os.listdir(path):
                if file.lower().endswith(ut.AUDIO_EXTENSIONS):
                    album_folders.append(os.path.abspath(path))
                    break
    return sorted(
        [str(folder) for folder in set(album_folders)], key=lambda s: s.lower()
    )


def all_album_folders(root_dir: str):
    files = sorted(glob.glob(root_dir + "/**/*", recursive=True))
    return album_folders_from_track_paths(files)


# cache data for no longer than one minutes
@cached(cache=TTLCache(maxsize=1024, ttl=60), info=True)
def dir_size(path: Path):
    return sum(file.stat().st_size for file in path.rglob("*"))
