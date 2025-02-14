"""Beets-flask extends every stage in the normal beets import session.

This allows us to keep track of the import state and communicate it to the frontend.
"""

from __future__ import annotations

import asyncio
import itertools
from enum import Enum
from functools import total_ordering, wraps
from typing import TYPE_CHECKING, Callable, TypeVar, TypeVarTuple

from beets import library, plugins
from beets.importer import (
    ImportSession,
    ImportTask,
    ImportTaskFactory,
    SentinelImportTask,
    SingletonImportTask,
    _extend_pipeline,
    _freshen_items,
    action,
    apply_choice,
    resolve_duplicates,
)
from beets.util import MoveOperation, displayable_path
from beets.util import pipeline as beets_pipeline

from beets_flask import log
from beets_flask.importer.pipeline import mutator_stage, stage

if TYPE_CHECKING:
    from .session import BaseSessionNew, InteractiveImportSession
    from .states import ProgressState

    # Tell type-checking that subclasses of BaseSession are allowed
    Session = TypeVar("Session", bound=BaseSessionNew)

A = TypeVarTuple("A")
R = TypeVarTuple("R")


@total_ordering
class Progress(Enum):
    """The progress of the current session in chronological order.

    Allows to resume a import at any time using our state dataclasses. We might
    also want to add the plugin stages or refine this.

    @PS: I like it this far, you have ideas for more progress. I think this should be on
    task level.
    """

    NOT_STARTED = 0
    READING_FILES = 1
    GROUPING_ALBUMS = 2
    LOOKING_UP_CANDIDATES = 3
    IDENTIFYING_DUPLICATES = 4
    OFFERING_MATCHES = 5
    WAITING_FOR_USER_SELECTION = 6
    EARLY_IMPORTING = 7
    IMPORTING = 8
    MANIPULATING_FILES = 9
    COMPLETED = 10

    def __lt__(self, other: Progress) -> bool:
        return self.value < other.value


def set_progress(progress: Progress):
    """Decorate to set the progress of a task.

    Basically calls
    `session.set_progress(task, progress)`
    before the decorated function.

    Also skips the function if the task is already progressed!

    Usage
    -----
    ```python
    @set_progress(Progress.READING_FILES)
    def read_task(session: BaseSessionNew, task: ImportTask):
        pass
    ```
    """

    def decorator(func: Callable[[Session, ImportTask, *A]]):
        @wraps(func)
        def wrapper(session: Session, task: ImportTask, *args: *A):

            # Skip automatically if the task is already progressed
            task_progress = session.get_progress(task)
            if task_progress and task_progress.progress > progress:
                return task  # This could be wrong (yield?)

            # Set the task's progress
            session.set_progress(task, progress)
            return func(session, task, *args)

        return wrapper

    return decorator


# --------------------------------- Producer --------------------------------- #


def read_tasks(
    session: BaseSessionNew,
):
    """Read the files from the paths and generate tasks.

    If the session already has tasks yield them.

    Adapted closely from beets, but we do not need/support resuming and skipping
    """

    log.warning(f"Reading files")

    # Our Skip-check usually uses Progress, but here we do not have progress yet
    # We want to catch the case when we resume a session,
    # where we manually add old tasks from disk.
    if len(session.state.tasks) > 0:
        for task in session.state.tasks:
            yield task
        return

    for toppath in session.paths:
        task_factory = ImportTaskFactory(toppath, session)
        for task in task_factory.tasks():

            if isinstance(task, SentinelImportTask):
                log.warning(f"Skipping {displayable_path(toppath)}")
                continue

            task_state = session.state.upsert_task(task)
            log.warning(f"Reading files from {displayable_path(toppath)}")
            task_state.set_progress(Progress.READING_FILES)
            yield task

        if not task_factory.imported:
            log.warning(f"No files imported from {displayable_path(toppath)}")


# ----------------------------- Transform Stages ----------------------------- #


def __group(item: library.Item) -> tuple[str, str]:
    return (item.albumartist or item.artist, item.album)


@stage
@set_progress(Progress.GROUPING_ALBUMS)
def group_albums(
    session: BaseSessionNew,
    task: ImportTask,
):
    """Highly likely this will work?? Hopefully.

    Yielding might not work as expected yet.
    """

    tasks = []
    sorted_items = sorted(task.items, key=__group)
    for _, items in itertools.groupby(sorted_items, __group):
        items = list(items)
        task = ImportTask(task.toppath, [i.path for i in items], items)
        tasks += task.handle_created(session)

    # FIXME: Not really sure we need this tbh, see also task.skip
    tasks.append(SentinelImportTask(task.toppath, task.paths))

    yield from tasks


@mutator_stage
@set_progress(Progress.LOOKING_UP_CANDIDATES)
def lookup_candidates(
    session: BaseSessionNew,
    task: ImportTask,
):
    """Performing the initial MusicBrainz lookup for an album.

    Calls `task.lookup_candidates()`,
    which sets attributes of the task:
        - cur_artist   # metadata in file
        - cur_album
        - candidates
        - rec
    """
    if task.skip:
        # FIXME This gets duplicated a lot. We need a better
        # abstraction.
        return

    # FIXME: what happens with our new skip logic and plugins?
    plugins.send("import_task_start", session=session, task=task)
    log.debug(f"Looking up: {displayable_path(task.paths)}")

    # Restrict the initial lookup to IDs specified by the user via the -m
    # option. Currently all the IDs are passed onto the tasks directly.
    # FIXME: Revisit, we want to avoid using the global config.
    task.search_ids = session.config["search_ids"].as_str_seq()

    task.lookup_candidates()


@mutator_stage
@set_progress(Progress.IDENTIFYING_DUPLICATES)
def identify_duplicates(
    session: BaseSessionNew,
    task: ImportTask,
):
    """Stage to identify which candidates would be duplicates if imported."""
    if task.skip:
        return
    session.identify_duplicates(task)


@mutator_stage
@set_progress(Progress.OFFERING_MATCHES)
def offer_match(
    session: InteractiveImportSession,
    task: ImportTask,
):
    """Stage to offer a match to the user.

    This is non-blocking. Essentially we split the `user_query` stage (which calls `choose_match`) into two stages.
    The first is `offer_match` sending info to the frontend, while the second is
    `choose_match` that waits until all user choices have been made.
    """
    # For historic reasons? Sentinel tasks (this is what beets does in choose_match)
    if task.skip:
        log.debug(f"Skipping task: {session=}, {task=}")
        return task

    session.offer_match(task)


@stage
@set_progress(Progress.WAITING_FOR_USER_SELECTION)
def user_query(
    session: BaseSessionNew,
    task: ImportTask,
):
    """A coroutine for interfacing with the user about the tagging process.

    The coroutine accepts an ImportTask objects. It uses the
    session's `choose_match` method to determine the `action` for
    this task. Depending on the action additional stages are executed
    and the processed task is yielded.

    It emits the ``import_task_choice`` event for plugins. Plugins have
    access to the choice via the ``task.choice_flag`` property and may
    choose to change it.
    """

    if task.skip:
        return task

    if session.already_merged(task.paths):
        return beets_pipeline.BUBBLE

    # Ask the user for a choice.
    task.choose_match(session)
    plugins.send("import_task_choice", session=session, task=task)

    # TODO: Import as singletons i.e. task.choice_flag is action.TRACKS

    # As albums: group items by albums and create task for each album
    if task.choice_flag is action.ALBUMS:
        return _extend_pipeline(
            [task],
            group_albums(session),
            lookup_candidates(session),
            user_query(session),
        )

    # Note: this checks the global config for the default action.
    resolve_duplicates(session, task)

    if task.should_merge_duplicates:
        # Create a new task for tagging the current items
        # and duplicates together
        duplicate_items = task.duplicate_items(session.lib)

        # Duplicates would be reimported so make them look "fresh"
        _freshen_items(duplicate_items)
        duplicate_paths = [item.path for item in duplicate_items]

        # Record merged paths in the session so they are not reimported
        session.mark_merged(duplicate_paths)

        merged_task = ImportTask(
            None, task.paths + duplicate_paths, task.items + duplicate_items
        )
        return _extend_pipeline(
            [merged_task], lookup_candidates(session), user_query(session)
        )

    apply_choice(session, task)
    return task


# Dynamic set_progress for plugin name
# e.g. DetailedProgress(Progress.EARLY_IMPORT, plugin_name="my_plugin")
@mutator_stage
def plugin_stage(
    session: BaseSessionNew,
    func: Callable[[BaseSessionNew, ImportTask], None],
    progress: ProgressState,
    task: ImportTask,
):
    # TODO: Skip if already progressed
    session.set_progress(task, progress)
    if task.skip:
        return

    func(session, task)

    task.reload()


# --------------------------------- Consumer --------------------------------- #


@stage
@set_progress(Progress.MANIPULATING_FILES)
def manipulate_files(
    session: BaseSessionNew,
    task: ImportTask,
):
    """A coroutine (pipeline stage) that performs necessary file.

    manipulations *after* items have been added to the library and
    finalizes each task.
    """
    if not task.skip:
        if task.should_remove_duplicates:
            task.remove_duplicates(session.lib)

        if session.config["move"]:
            operation = MoveOperation.MOVE
        elif session.config["copy"]:
            operation = MoveOperation.COPY
        elif session.config["link"]:
            operation = MoveOperation.LINK
        elif session.config["hardlink"]:
            operation = MoveOperation.HARDLINK
        elif session.config["reflink"] == "auto":
            operation = MoveOperation.REFLINK_AUTO
        elif session.config["reflink"]:
            operation = MoveOperation.REFLINK
        else:
            operation = None

        task.manipulate_files(
            operation,
            write=session.config["write"],
            session=session,
        )

    # Progress, cleanup, and event.
    task.finalize(session)


__all__ = [
    "read_tasks",
    "group_albums",
    "lookup_candidates",
    "identify_duplicates",
    "offer_match",
    "user_query",
    "plugin_stage",
    "manipulate_files",
]
