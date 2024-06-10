import os
import glob
import cachetools
import threading
from time import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler, FileSystemEvent, FileMovedEvent

from . import invoker
from . import utility as ut

from .logger import log

inbox_dir = os.environ.get("INBOX", "/music/inbox")
_cache = cachetools.TTLCache(maxsize=100, ttl=900)
_cache_lock = threading.Lock()


# ------------------------------------------------------------------------------------ #
#                                   init and watchdog                                  #
# ------------------------------------------------------------------------------------ #


def init():
    if os.environ.get("RQ_WORKER_ID", None):
        # only launch the observer on the main process
        return

    log.debug(f"Starting observer for {inbox_dir}")
    try:
        handler = InboxHandler()
        # the polling observer worked more reliably for me than the default observer.
        observer = PollingObserver(timeout=handler.poll_interval)
        observer.schedule(handler, path=inbox_dir, recursive=True)
        observer.start()
    except FileNotFoundError:
        log.error(
            f"Could not find inbox directory ({inbox_dir}). Check your INBOX env var."
        )
        return

    # run this in its own thread to not block the webserver.
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
                    refresh_folder(path)

    def on_any_event(self, event: FileSystemEvent):
        log.debug("got %r", event)

        if isinstance(event, FileMovedEvent):
            fullpath = event.dest_path
        else:
            fullpath = event.src_path
        if os.path.basename(fullpath).startswith("."):
            return

        get_inbox_dict(use_cache=False)
        ut.update_client_view("inbox")

        try:
            album_folder = album_folders_from_track_paths([fullpath])[0]
        except IndexError:
            log.debug(f"File change at {fullpath} but is no album_folder")
            return

        current = self.debounce.get(album_folder, 1)
        if current > 0:
            self.debounce[album_folder] = time()


def refresh_folder(album_folder: str):
    """
    For a single folder, we are fine with retagging a bit more eagerly. E.g. when files are added over time, we would want to reduce the number of missing tracks.
    """

    log.debug(f"refreshing {album_folder} ...")

    status = invoker.tag_status(path = album_folder)
    if status in ["pending", "tagging", "importing", "imported", "cleared"]:
        log.debug(f"folder {album_folder} is {status}. skipping")
        return
    else:
        log.debug(f"tagging folder {album_folder}")
        raise NotImplementedError("refresh_folder is not implemented yet")
        # beets_tasks.task_for_paths([album_folder], {"task": "preview"})


def refresh_all_folders(
    with_status: list[str] = ["unmatched", "failed", "tagged", "notag"]
):
    log.debug(f"Refreshing all folders {with_status=}")
    for f in all_album_folders():
        status = invoker.tag_status(f)
        if status in with_status:
            log.debug(f"tagging folder {f} with status {status}")
            raise NotImplementedError("refresh_folder is not implemented yet")
        else:
            log.debug(f"folder {f} is {status}. skipping")
            continue


# ------------------------------------------------------------------------------------ #
#                                   folder structure                                   #
# ------------------------------------------------------------------------------------ #


def get_inbox_dict(use_cache: bool = True) -> dict:
    global _cache
    with _cache_lock:
        if use_cache and "inbox" in _cache:
            inbox = _cache["inbox"]
        else:
            log.debug("renewing cache for inbox dict")
            inbox = path_to_dict(inbox_dir)
            _cache["inbox"] = inbox

    return inbox


def path_to_dict(root_dir, relative_to="/") -> dict:
    """
    Generate our nested dict structure for the specified path.

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


def all_album_folders(root_dir: str = inbox_dir):
    files = sorted(glob.glob(root_dir + "/**/*", recursive=True))
    return album_folders_from_track_paths(files)


def dir_size(dir: str, use_cache: bool = True):
    global _cache
    if use_cache and dir in _cache:
        return _cache[dir]

    size = sum(file.stat().st_size for file in Path(dir).rglob("*"))
    _cache[dir] = size

    return size
