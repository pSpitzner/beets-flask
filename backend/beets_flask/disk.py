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
from beets_flask.routes.sse import update_client_view


# ------------------------------------------------------------------------------------ #
#                                   init and watchdog                                  #
# ------------------------------------------------------------------------------------ #

_inboxes: List[OrderedDict] = []


def register_inboxes():

    global _inboxes
    _inboxes = config["gui"]["inbox"]["folders"].get().values()  # type: ignore

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
            log.info(f'Skipping observer for inbox {inbox["path"]}')
            continue

        log.info(f'Starting observer for {inbox["path"]}')
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

    # user would expect autotagging inboxes to automatically scan on first launch,
    # we touch to trigger debounce and give sql time to init.
    for inbox in _inboxes:
        if inbox["autotag"]:
            album_folders = all_album_folders(inbox["path"])
            for f in album_folders:
                os.utime(f, None)



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
                    log.debug("Processing %s", path)
                    retag_folder(path, with_status=["untagged"])

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
        update_client_view("inbox")

        try:
            album_folder = album_folders_from_track_paths([fullpath])[0]
        except IndexError:
            log.debug(f"File change at {fullpath} but is no album_folder")
            return

        current = self.debounce.get(album_folder, 1)
        if current > 0:
            self.debounce[album_folder] = time()


def retag_folder(path: str,
                 kind: str | None = None,
                 with_status : None | list[str] = None
                 ):
    """
    Retag a (taggable) folder.

    # Args
    path: str, full path to the folder
    kind: str, 'preview' or 'import'
    with_status: None or list of strings. If None (default), always retag, no matter what. If list of strings, only retag if the tag for the folder matches one of the supplied statuses.
    """

    inbox = get_inbox_for_path(path)

    if inbox and kind is None:
        kind = inbox["autotag"]

    if not kind:
        raise ValueError(f"Autotagging kind not found for path: {path}")

    log.debug(f"retagging {path} with {kind=} ...")

    status = invoker.tag_status(path=path)
    if with_status is None or status in with_status:
        invoker.enqueue_tag_path(path, kind=kind)
        log.debug(f"tagging folder {path}")
    else:
        log.debug(f"folder {path} has {status=}. skipping.")
        return

    if inbox:
        inbox["last_tagged"] = datetime.now().isoformat()


def retag_inbox(
    inbox_dir: str,
    with_status: None | list[str] = None,
    kind: str | None = None,
):
    """
    Refresh an inbox folder, retagging all its subfolders.

    # Args
    path: str, full path to the inbox
    kind: str, 'preview' or 'import'
    with_status: None or list of strings. If None (default), always retag, no matter what. If list of strings, only retag if the tag for the folder matches one of the supplied statuses.
    """

    inbox = get_inbox_for_path(inbox_dir)

    if inbox and kind is None:
        kind = inbox["autotag"]

    if not kind:
        raise ValueError(f"Autotagging kind not found for {inbox_dir=}")

    log.debug(f"Refreshing all folders in {inbox_dir} to {kind=} {with_status=}")

    # first do the tags that dont have any info yet, or had problems.
    todo_first = []
    todo_second = []
    for f in all_album_folders(inbox_dir):
        status = invoker.tag_status(path=f)
        if with_status and status not in with_status:
            log.debug(f"folder {f} has {status=}. skipping")
            continue
        if status == "untagged":
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
        if path.startswith(i["path"]):
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
