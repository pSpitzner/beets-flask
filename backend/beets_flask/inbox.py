import asyncio
import os
import threading
from datetime import datetime
from time import time
from typing import List, OrderedDict

from watchdog.events import FileMovedEvent, FileSystemEvent, FileSystemEventHandler
from watchdog.observers.polling import PollingObserver

from beets_flask import invoker
from beets_flask.config import get_config
from beets_flask.disk import (
    File,
    Folder,
    album_folders_from_track_paths,
    all_album_folders,
    path_to_folder,
)
from beets_flask.logger import log
from beets_flask.server.routes.status import update_client_view

# ------------------------------------------------------------------------------------ #
#                                   init and watchdog                                  #
# ------------------------------------------------------------------------------------ #

_inboxes: List[OrderedDict] = []


def register_inboxes():
    global _inboxes
    _inboxes = get_config()["gui"]["inbox"]["folders"].flatten().values()  # type: ignore

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
            log.info(f"Skipping observer for inbox {inbox['path']}")
            continue

        log.info(f"Starting observer for {inbox['path']}")
        try:
            # the polling observer worked more reliably for me than the default observer.
            observer.schedule(handler, path=inbox["path"], recursive=True)
        except FileNotFoundError:
            log.error(
                f"Could not find inbox directory ({inbox['path']}). Check your config!"
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
                try:
                    os.utime(f, None)
                except Exception as e:
                    log.error(f"Could not touch {f}. Check the permissions! {e}")


class InboxHandler(FileSystemEventHandler):
    def __init__(self):
        self.debounce = {}
        self.debounce_window = 30  # seconds
        self.poll_interval = 5  # seconds
        super().__init__()

    def try_to_import(self):
        """Import paths that had no event for a few seconds (following DEBOUNCE_WINDOW).

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
            fullpath = str(event.dest_path)
        else:
            fullpath = str(event.src_path)
        if os.path.basename(fullpath).startswith("."):
            return

        # trigger cache clear and gui update of inbox directories
        path_to_folder.cache.clear()  # type: ignore
        update_client_view("inbox")

        try:
            album_folder = album_folders_from_track_paths([fullpath])[0]
        except IndexError:
            log.debug(f"File change at {fullpath} but is no album_folder")
            return

        current = self.debounce.get(album_folder, 1)
        if current > 0:
            self.debounce[album_folder] = time()


def retag_folder(
    path: str, kind: str | None = None, with_status: None | list[str] = None
):
    """Retag a (taggable) folder.

    Parameters
    ----------
    path: str
        Full path to the folder
    kind: str, optional
        If None, the configured autotag kind from the inbox this folder is in will be used.
    with_status: list[str], optional
        If None (default), always retag, no matter what. If list of strings, only retag if the tag for the folder matches one of the supplied statuses.
    """
    inbox = get_inbox_for_path(path)

    if inbox and kind is None:
        kind = inbox["autotag"]

    if not kind:
        raise ValueError(f"Autotagging kind not found for path: {path}")

    log.debug(f"retagging {path} with {kind=} ...")

    status = invoker.tag_status(path=path)
    if with_status is None or status in with_status:
        invoker.enqueue(path, kind=kind)
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
    """Refresh an inbox folder, retagging all its subfolders.

    # Args
    path: str, full path to the inbox
    kind: str or None (default). If None, the configured autotag kind from the inbox in will be used.
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


def is_inbox_folder(path: str) -> bool:
    return path in get_inbox_folders()


def get_inboxes():
    return _inboxes


def mark_inbox_folder(fspath: Folder | File) -> Folder | File:
    """Given a FolderStructure, mark the highest level folder as inbox if it actually is one."""
    # we would want to do this directly in path_to_dict() in disk.py, but
    # then we'd have circular imports.
    # since we go top-down, and there should be nothing higher up than an inbox (?)
    # no need to check children.
    if is_inbox_folder(fspath["full_path"]) and fspath["type"] == "directory":
        fspath["is_inbox"] = True
    return fspath
