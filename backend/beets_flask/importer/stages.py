"""Beets-flask extends every stage in the normal beets import session.

This allows us to keep track of the import state and communicate it to the frontend.
"""

from __future__ import annotations

import asyncio
import itertools
from enum import Enum
from functools import total_ordering, wraps
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Coroutine,
    Generator,
    Generic,
    Iterable,
    Optional,
    ParamSpec,
    Sequence,
    Sized,
    Tuple,
    TypeVar,
    TypeVarTuple,
    Union,
    Unpack,
    cast,
)

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
from beets_flask.importer.progress import Progress, ProgressState

if TYPE_CHECKING:
    from beets_flask.importer.session import (
        AutoImportSession,
        BaseSession,
        ImportSession,
        InteractiveImportSession,
    )

    from .pipeline import Stage

    # Tell type-checking that subclasses of BaseSession are allowed
    Session = TypeVar("Session", bound=BaseSession)


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

    def decorator(func: Callable[[Session, ImportTask, *Arg]]):
        @wraps(func)
        def wrapper(session: Session, task: ImportTask, *args: *Arg):
            # Skip automatically if the task is already progressed
            # Note that >= and > below both have caveats:
            # >= might give us a too optimistic state if the function call fails
            # > might re-run the function if we resume, and we have not testet
            # what happens when doing the same state-mutation twice
            task_progress = session.state.upsert_task(task)
            if task_progress and task_progress.progress >= progress:
                log.debug(f"Skipping {progress} for {task}")
                return task

            # Set the task's progress
            session.set_task_progress(task, progress)
            log.debug(f"Running {progress} for {task}")
            return func(session, task, *args)

        return wrapper

    return decorator


class StageOrder(dict):
    """An ordered dict of stages, mapping the stage name to its generator.

    Returned by each sessions `.stages` property.
    """

    def append(self, stage: Stage[ImportTask, Any], name: str | None = None):
        """Append a stage to the Order."""

        name = name or str(getattr(stage, "__name__", f"unknown_stage"))
        if name in self.keys():
            raise ValueError(f"Stage with name {name} already exists.")

        self[name] = stage

    def insert(
        self,
        stage: Stage[ImportTask, Any],
        name: str | None = None,
        after: str | None = None,
        before: str | None = None,
    ):
        """Insert a stage after or before another specific stage."""

        if after is None and before is None or (after and before):
            raise ValueError("Either `after` or `before` must be specified.")

        name = name or str(getattr(stage, "__name__", f"unknown_stage"))
        if name in self.keys():
            raise ValueError(f"Stage with name {name} already exists.")

        # even for the OrderedDict there is no insert at index method, so just rebuild
        keys = list(self.keys())
        values = list(self.values())

        idx = keys.index(after or before)  # type: ignore
        if after:
            idx += 1
        keys.insert(idx, name)
        values.insert(idx, stage)

        self = StageOrder(zip(keys, values))


# --------------------------------- Decorator -------------------------------- #

Arg = TypeVarTuple("Arg")  # args und kwargs
Ret = TypeVar("Ret")  # return type
Task = TypeVar("Task")  # task


def stage(func: Callable[[Unpack[Arg], Task], Ret]):
    """Decorate a function to become a simple stage.

    Yields a task and waits until the next task is sent to it.

    >>> @stage
    ... def add(n, i):
    ...     return i + n
    >>> pipe = Pipeline([
    ...     iter([1, 2, 3]),
    ...     add(2),
    ... ])
    >>> list(pipe.pull())
    [3, 4, 5]
    """

    # use the wraps decorator to lift function name etc, we use this in StageOrder class
    @wraps(func)
    def coro(*args: Unpack[Arg]) -> Generator[Union[Ret, Task, None], Task, None]:
        # in some edge-cases we get no task. thus, we have to include the generic R
        task: Optional[Task | Ret] = None
        while True:
            task = yield task  # wait for send to arrive. the first next() always returns None
            # yield task, call func which gives new task, yield new task in next()
            # FIXME: Generator support!
            task = func(*(args + (task,)))

    return coro


def mutator_stage(func: Callable[[Unpack[Arg], Task], Ret], name: str | None = None):
    """Decorate a function that manipulates items in a coroutine to become a simple stage.

    Yields a task and waits until the next task is sent to it.

    >>> @mutator_stage
    ... def setkey(key, item):
    ...     item[key] = True
    >>> pipe = Pipeline([
    ...     iter([{'x': False}, {'a': False}]),
    ...     setkey('x'),
    ... ])
    >>> list(pipe.pull())
    [{'x': True}, {'a': False, 'x': True}]
    """

    @wraps(func)
    def coro(
        *args: Unpack[Arg],
    ) -> Generator[Union[Ret, Task, None], Task, Optional[Ret]]:
        task = None
        while True:
            task = yield task  # wait for send to arrive. the first next() always returns None
            # perform function on task, and in next() send the same, modified task
            # funcs prob. modify task in place?
            func(*(args + (task,)))

    return coro


# --------------------------------- Producer --------------------------------- #


def read_tasks(
    session: BaseSession,
):
    """Read the files from the paths and generate tasks.

    If the session already has tasks yield them.

    Adapted closely from beets, but we do not need/support resuming and skipping
    """

    log.debug(f"Reading files")

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
                log.debug(f"Skipping {displayable_path(toppath)}")
                continue

            task_state = session.state.upsert_task(task)
            log.debug(f"Reading files from {displayable_path(toppath)}")
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
    session: BaseSession,
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
    session: BaseSession,
    task: ImportTask,
):
    """Performing the initial MusicBrainz lookup for an album.

    We tweaks this from upstream beets to not
    call `task.lookup_candidates()` but instead `session.lookup_candidates(task)`, with some extra logic

    This is more consistent, as it allows the logic
    to be modified by each kind of session.

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

    session.lookup_candidates(task)


@mutator_stage
@set_progress(Progress.IDENTIFYING_DUPLICATES)
def identify_duplicates(
    session: BaseSession,
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
    session: BaseSession,
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
    # This calls session.choose_match(task)... but whyyy?
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


# Dynamicly set_progress for plugin name
# e.g. DetailedProgress(Progress.EARLY_IMPORT, plugin_name="my_plugin")
@mutator_stage
def plugin_stage(
    session: BaseSession,
    func: Callable[[BaseSession, ImportTask], None],
    progress: ProgressState,
    task: ImportTask,
):
    # TODO: Skip if already progressed
    session.set_task_progress(task, progress)
    if task.skip:
        return

    func(session, task)

    task.reload()


@mutator_stage
@set_progress(Progress.MATCH_THRESHOLD)
def match_threshold(
    session: AutoImportSession,
    task: ImportTask,
):
    """Stage to determine if a match is good enough to be auto-imported."""
    if task.skip:
        log.debug(f"Skipping task: {session=}, {task=}")
        return task

    session.match_threshold(task)


# --------------------------------- Consumer --------------------------------- #


@stage
@set_progress(Progress.MANIPULATING_FILES)
def manipulate_files(
    session: BaseSession,
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
    return task


@stage
@set_progress(Progress.COMPLETED)
def mark_tasks_completed(session: BaseSession, task: ImportTask):
    """
    Wrapper to mark task as completed.

    This is mainly a workaround because our progressd decorator cannot set the
    progress after stage has finished.
    """
    return task


__all__ = [
    "read_tasks",
    "group_albums",
    "lookup_candidates",
    "identify_duplicates",
    "offer_match",
    "user_query",
    "plugin_stage",
    "manipulate_files",
    "mark_tasks_completed",
]
