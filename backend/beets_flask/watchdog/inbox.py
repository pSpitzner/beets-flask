import asyncio
import os
import signal
from pathlib import Path
from typing import List, OrderedDict

from watchdog.events import FileMovedEvent, FileSystemEvent
from watchdog.observers.polling import PollingObserver

from beets_flask import invoker
from beets_flask.config import get_config
from beets_flask.database.models.states import SessionStateInDb
from beets_flask.disk import (
    Folder,
    album_folders_from_track_paths,
    all_album_folders,
    path_to_folder,
)
from beets_flask.invoker import enqueue
from beets_flask.logger import log
from beets_flask.server.websocket.status import FileSystemUpdate, send_status_update
from beets_flask.watchdog.eventhandler import AIOEventHandler, AIOWatchdog

# ------------------------------------------------------------------------------------ #
#                                   init and watchdog                                  #
# ------------------------------------------------------------------------------------ #

_inboxes: List[OrderedDict] = []


def register_inboxes(timeout: float = 1, debounce: float = 1) -> AIOWatchdog | None:
    """
    Register file system watcher to monitor configured inboxes.

    Parameters
    ----------
    timeout: float
        Timeout for the polling observer in seconds (heartbeat, to recheck file system changes)
    debounce: float
        Debounce window in seconds, to wait before starting tagging operations.
        This is to avoid multiple triggers for changes in the same folder.
        You have to wait at least this long before an autotag will trigger
        after you add the last file to an inbox.
        Default is 30 seconds.
    """
    global _inboxes
    _inboxes = get_config()["gui"]["inbox"]["folders"].flatten().values()  # type: ignore
    auto_inboxes = [i for i in _inboxes if i.get("autotag", None)]

    if os.environ.get("RQ_WORKER_ID", None):
        # only launch the observer on the main process
        log.exception("WTF, redis what you doing?")
        return

    # Return early if no inboxes are configured.
    if len(auto_inboxes) == 0:
        return

    # One observer for all inboxes.
    handler = InboxHandler(debounce_window=debounce)
    observer = PollingObserver(timeout=timeout)
    # timeout/debounce in seconds

    watchdog = AIOWatchdog(
        paths=[Path(i["path"]) for i in auto_inboxes],
        handler=handler,
        observer=observer,
    )

    watchdog.start()

    # Stop watchdog on exit signals.
    signal.signal(signal.SIGINT, lambda s, f: watchdog.stop())
    signal.signal(signal.SIGHUP, lambda s, f: watchdog.stop())
    signal.signal(signal.SIGTERM, lambda s, f: watchdog.stop())
    signal.signal(signal.SIGQUIT, lambda s, f: watchdog.stop())

    # user would expect autotagging inboxes to automatically scan on first launch
    async def auto_tag_wait_for_workers(f: Path):
        # HACK: checking if redis is ready was not trivial enough, so we just wait a bit.
        await asyncio.sleep(10)
        await auto_tag(f)

    for inbox in auto_inboxes:
        album_folders = all_album_folders(inbox["path"])
        for f in album_folders:
            asyncio.create_task(auto_tag_wait_for_workers(f))

    return watchdog


class InboxHandler(AIOEventHandler):
    debounce: dict[str, asyncio.Task]

    def __init__(self, debounce_window: float) -> None:
        super().__init__()
        self.debounce = {}
        self.debounce_window = debounce_window

    async def on_any_event(self, event: FileSystemEvent):
        log.debug("Watchdog: got %r", event)

        if isinstance(event, FileMovedEvent):
            fullpath = str(event.dest_path)
        else:
            fullpath = str(event.src_path)
        if os.path.basename(fullpath).startswith("."):
            return

        # trigger cache clear and gui update of inbox directories
        path_to_folder.cache.clear()  # type: ignore
        status_update = asyncio.create_task(send_status_update(FileSystemUpdate()))

        try:
            album_folder = album_folders_from_track_paths([fullpath])[0]
        except IndexError:
            log.debug(f"File change at {fullpath} but is no album_folder")
            return

        album_folder_key = str(album_folder.resolve())

        task = asyncio.create_task(self.task_func(album_folder))
        if current := self.debounce.get(album_folder_key, None):
            try:
                current.cancel()
            except Exception as e:
                log.error(f"Error cancelling previous task for {album_folder_key}: {e}")

        self.debounce[album_folder_key] = task
        await status_update

    async def task_func(self, album_folder: Path):
        await asyncio.sleep(self.debounce_window)
        log.info(f"Watchdog: Starting inbox handler task {album_folder}")
        try:
            await auto_tag(album_folder)
        except Exception as e:
            log.exception(f"Error in inbox handler task for {album_folder}", e)


async def auto_tag(path: Path, inbox_kind: str | None = None):
    """Retag a (taggable) folder.

    Parameters
    ----------
    path: str
        Full path to the folder
    kind: str, optional
        If None, the configured autotag kind from the inbox this folder is in will be used.
    """
    inbox = get_inbox_for_path(path)
    if inbox is None:
        log.error(f"Path {path} is not in any inbox, skipping autotagging.")
        return

    if inbox_kind is None:
        inbox_kind = inbox.get("autotag", None)

    # Infer enqueue kind from inbox kind
    enq_kind: invoker.EnqueueKind
    enq_kwargs = {}
    match inbox_kind:
        case "preview":
            enq_kind = invoker.EnqueueKind.PREVIEW
        case "auto":
            enq_kind = invoker.EnqueueKind.IMPORT_AUTO
            enq_kwargs["import_threshold"] = inbox.get("auto_threshold", None)
        case "bootleg":
            enq_kind = invoker.EnqueueKind.IMPORT_BOOTLEG
        case None:
            log.error(f"Autotagging kind not found for path: {path}")
            return
        case False:
            log.debug(f"Skipping autotagging for {path} (inbox autotag = no).")
            return
        case _:
            log.error(f"Unknown autotagging kind {inbox_kind} for {path}")
            return

    folder = Folder.from_path(path)

    # check if we have a session for this folder already.
    # if so, skip imports but update the previews.
    state = SessionStateInDb.get_by_hash_and_path(hash=None, path=folder.full_path)

    should_enqueue = False
    if state is None:
        should_enqueue = True
    else:
        # keeps previews fresh when we have integrity warnings (i.e. content changed)
        if enq_kind == invoker.EnqueueKind.PREVIEW and folder.hash != state.folder_hash:
            should_enqueue = True

    if should_enqueue:
        log.info(f"Watchdog: Enqueuing {folder.full_path} as {enq_kind.value}")
        await enqueue(folder.hash, folder.full_path, kind=enq_kind, **enq_kwargs)
    else:
        log.info(f"Watchdog: skipping enqueue {folder.full_path}")


# ------------------------------------------------------------------------------------ #
#                                        inboxes                                       #
# ------------------------------------------------------------------------------------ #


def get_inbox_for_path(path: str | Path):
    if isinstance(path, str):
        path = Path(path)
    inbox = None
    for i in _inboxes:
        ipath = Path(i["path"])
        if path.is_relative_to(ipath) or path == ipath:
            inbox = i
            break
    return inbox


def get_inbox_folders() -> List[str]:
    return [i["path"] for i in _inboxes]


def is_inbox_folder(path: str) -> bool:
    return path in get_inbox_folders()


def get_inboxes():
    return _inboxes
