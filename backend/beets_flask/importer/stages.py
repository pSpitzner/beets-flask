"""Beets-flask extends every stage in the normal beets import session.

This allows us to keep track of the import state and communicate it to the frontend.
"""

from __future__ import annotations
import asyncio

from beets.importer import ImportSession, ImportTask


from .states import DetailedProgress, Progress
from .session import BaseSessionNew


from functools import wraps
from typing import Callable, TypeVarTuple


A = TypeVarTuple("A")
R = TypeVarTuple("R")


def set_progress(progress: Progress):
    """Decorator to set the progress of a task.

    Basically calls
    `session.set_progress(task, progress)`
    before the decorated function.

    Usage
    -----
    ```python
    @set_progress(Progress.READING_FILES)
    def read_task(session: BaseSessionNew, task: ImportTask):
        pass
    ```
    """

    def decorator(func: Callable[[BaseSessionNew, ImportTask, *A]]):
        @wraps(func)
        def wrapper(session: BaseSessionNew, task: ImportTask, *args: *A):
            # Set the task's progress
            session.set_progress(task, progress)
            # Execute the original function
            return func(session, task, *args)

        return wrapper

    return decorator


# --------------------------------- Producer --------------------------------- #


@set_progress(Progress.READING_FILES)
def read_task(
    session: BaseSessionNew,
    task: ImportTask,
):
    pass


# ----------------------------- Transform Stages ----------------------------- #


@set_progress(Progress.GROUPING_ALBUMS)
def group_albums(
    session: BaseSessionNew,
    task: ImportTask,
):
    pass


@set_progress(Progress.LOOKING_UP_CANDIDATES)
def lookup_candidates(
    session: BaseSessionNew,
    task: ImportTask,
):
    pass


@set_progress(Progress.IDENTIFYING_DUPLICATES)
def identify_duplicates(
    session: BaseSessionNew,
    task: ImportTask,
):
    pass


@set_progress(Progress.OFFERING_MATCHES)
def offer_match(
    session: BaseSessionNew,
    task: ImportTask,
):
    pass


@set_progress(Progress.WAITING_FOR_USER_SELECTION)
def user_query(
    session: BaseSessionNew,
    task: ImportTask,
):
    pass


# Dynamic set_progress for plugin name
# e.g. DetailedProgress(Progress.EARLY_IMPORT, plugin_name="my_plugin")
def plugin_stage(
    session: BaseSessionNew,
    task: ImportTask,
    progress: DetailedProgress,
):
    session.set_progress(task, progress)
    pass


# --------------------------------- Consumer --------------------------------- #


@set_progress(Progress.MANIPULATING_FILES)
def manipulate_files(
    session: BaseSessionNew,
    task: ImportTask,
):
    pass
