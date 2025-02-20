import asyncio
import logging
import os
import threading
import time
from abc import ABC, abstractmethod
from pathlib import Path
from posixpath import normpath
from pprint import pformat
from typing import Any, Callable, List, Literal

import nest_asyncio
from beets import autotag, importer, library, plugins
from beets.library import MediaFile
from beets.ui import UserError, _open_library, colorize, print_
from beets.ui.commands import show_change, summarize_items
from beets.util import displayable_path
from beets.util import pipeline as beets_pipeline
from deprecated import deprecated
from socketio import AsyncServer

from beets_flask.beets_sessions import BaseSession, set_config_defaults
from beets_flask.config import get_config
from beets_flask.disk import is_album_folder
from beets_flask.importer.progress import Progress, ProgressState
from beets_flask.importer.types import BeetsAlbumMatch, BeetsTrackMatch
from beets_flask.logger import log
from beets_flask.utility import capture_stdout_stderr

from .communicator import WebsocketCommunicator
from .pipeline import AsyncPipeline, Stage
from .stages import (
    group_albums,
    identify_duplicates,
    lookup_candidates,
    manipulate_files,
    mutator_stage,
    offer_match,
    plugin_stage,
    read_tasks,
    stage,
    user_query,
)
from .states import ProgressState, SessionState

nest_asyncio.apply()


class BaseSessionNew(importer.ImportSession, ABC):
    """Base class for our GUI-based ImportSessions.

    Operates on single Albums / files.

    Parameters
    ----------
    path : list[str]
        list of album folders to import
    config_overlay : str or dict
        path to a config file to overlay on top of the default config.
        Note that if `dict`, the lazyconfig notation e.g. `{import.default_action: skip}`
        wont work reliably. Better nest the dicts: `{import: {default_action: skip}}`

    Note: It's a design choice to require that you manually create and pass the
    `SessionState` object. Usually the states go into the database, which needs explizit
    handling beyond the session.
    """

    # attributes needed to create a beetsTag instance for our database
    # are contained in the associated SessionState -> TaskState -> CandidateStates
    state: SessionState

    pipeline: AsyncPipeline[importer.ImportTask, Any] | None = None

    # toppath. during run, multiple sessions, each with their own
    # subpath of this may be created
    path: Path

    def __init__(
        self,
        state: SessionState,
        config_overlay: dict | None = None,
    ):
        path = state.path

        if not path.exists():
            raise FileNotFoundError(f"Path {path} does not exist.")
        if not path.is_dir() and not is_album_folder(path):
            raise ValueError(f"Path {path} is not an album folder.")

        # FIXME: This is a super bad convention of the original beets.
        # We do not want to pollute a global config object every time a session runs.
        # This is fine for the cli tool, where each run creates only one session
        # but not for our long-running webserver.
        config = get_config()
        if isinstance(config_overlay, dict):
            config.set_args(config_overlay)

        self.state = state
        self.path = path

        super().__init__(
            lib=_open_library(config),
            paths=[path],
            query=None,
            loghandler=None,
        )
        # Hacky workaround to use our logging, to allow plugins to communicate
        self.logger.handlers = log.handlers
        log.debug(f"Created new {self.__class__.__name__} for {path}")

    @deprecated
    def run_and_capture_output(self) -> tuple[str, str]:
        """Run the import session and capture the output.

        Uses the original beets import session run method,
        with lots of overhead.
        Sets self.preivew to output and error messages occuring during run.

        Returns
        -------
            tuple[str, str]: out, err
        """
        self.logger.debug(f"{self.paths}")
        out, err, _ = capture_stdout_stderr(self.run)
        self.preview = out + "\n\n" + err if err else out
        return out, err

    # -------------------------- State handling helpers -------------------------- #

    def set_task_progress(
        self, task: importer.ImportTask, progress: ProgressState | Progress | str
    ):
        """Set the progress of the import session.

        If string is given it is set as the message of the current progress.
        Note: currently we only implement status on the level of the whole import session, but should eventually do this per selection (task).
        """

        task_state = self.state.get_task_state_for_task(task)
        assert task_state is not None, "Task state not found for task."

        task_state.set_progress(progress)

    def get_task_progress(self, task: importer.ImportTask) -> ProgressState | None:
        """Get the progress of the task, via this sessions state."""
        task_state = self.state.get_task_state_for_task(task)
        return task_state.progress if task_state else None

    # -------------------------------- Stages -------------------------------- #

    def resolve_duplicate(self, task: importer.ImportTask, found_duplicates):
        """Overload default resolve duplicate and skip it.

        This basically skips this stage.
        """
        self.logger.debug(f"skipping resolve_duplicates {task}")
        task.set_choice(importer.action.SKIP)

    def choose_item(self, task: importer.ImportTask):
        """Overload default choose item and skip it.

        This session should not reach this stage.
        """
        self.logger.debug(f"skipping choose_item {task}")
        return importer.action.SKIP

    def should_resume(self, path):
        """Overload default should_resume and skip it.

        Should normally be no problem if the config is set correctly, but just
        in case.
        """
        self.logger.debug(f"skipping should_resume {path}")
        return False

    def identify_duplicates(self, task: importer.ImportTask):
        """For all candidates, check if they have duplicates in the library."""
        task_state = self.state.get_task_state_for_task(task)
        if task_state is None:
            raise ValueError("No state found for thiis task.")

        for idx, cs in enumerate(task_state.candidate_states):
            # This is a mutable operation i.e. cs is modfied here!
            duplicates = cs.identify_duplicates(self.lib)

            if len(duplicates) > 0:
                log.debug(f"Found duplicates for {cs.id=}: {duplicates}")

    def lookup_candidates(self, task: importer.ImportTask):
        """Lookup candidates for the task."""

        # Restrict the initial lookup to IDs specified by the user via the -m
        # option. Currently all the IDs are passed onto the tasks directly.
        # FIXME: Revisit, we want to avoid using the global config.
        task.search_ids = self.config["search_ids"].as_str_seq()

        task.lookup_candidates()

        # Update our state
        task_state = self.state.get_task_state_for_task(task)
        if not task_state:
            raise ValueError(f"No task state found for {task=}")

        # FIXME: type hint should be fine once beets updates
        task_state.add_candidates(task.candidates)  # type: ignore

    # ---------------------------------- Run --------------------------------- #

    @abstractmethod
    def stages(self) -> List[Stage[importer.ImportTask, Any]]:
        """Return the stages of the pipeline."""
        pass

    def run_sync(self) -> SessionState:
        """Run the import session synchronously."""
        return asyncio.run(self.run_async())

    async def run_async(self) -> SessionState:
        """Run the import session asynchronously.

        Does not set tasks to completed at the end.
        Take care of this in subclasses.
        """
        # For now, until we improve the upstream beets config logic,
        # adhere to importer.ImportSession convention and create a local copy
        # of the config.
        config = get_config()
        self.set_config(config["import"])

        # TODO: check some config values. that are not compatible with our code.
        self.pipeline = AsyncPipeline(start_tasks=read_tasks(self))

        for s in self.stages():
            self.pipeline.add_stage(s)

        log.info(f"Running {self.__class__.__name__} on state<{self.state.id=}>.")
        log.debug(f"Running {len(self.pipeline.stages)} stages.")

        plugins.send("import_begin", session=self)
        try:
            assert self.pipeline is not None
            await self.pipeline.run_async()
        except importer.ImportAbortError:
            log.debug(f"Interactive import session aborted by user")

        log.info(f"Completed {self.__class__.__name__} on state<{self.state.id=}>.")

        return self.state


class PreviewSessionNew(BaseSessionNew):
    """Preview what would be imported. Only fetches candidates."""

    def stages(self):
        stages: List[Stage[importer.ImportTask, Any]] = []

        if self.config["group_albums"] and not self.config["singletons"]:
            # FIXME once migrated to next beets version
            stages.append(group_albums(self))

        # main stages
        stages += [
            lookup_candidates(self),
            identify_duplicates(self),
            # TODO: check if we want to enable this plugin stage
            # TODO: Start documentation of plugins that work with us.
            # c.f. https://docs.beets.io/en/latest/dev/plugins.html
            # offer_match(self) -> invokes plugins.send("import_task_before_choice", session=self, task=task).
        ]
        return stages


class ImportSessionNew(BaseSessionNew):
    """Import session that assumes we already have a match-id."""

    match_url: str | None
    duplicate_action: Literal["skip", "keep", "remove", "merge", "ask"]

    def __init__(
        self,
        state: SessionState,
        config_overlay: dict | None = None,
        match_url: str | None = None,
        duplicate_action: (
            Literal["skip", "keep", "remove", "merge", "ask"] | None
        ) = None,
    ):
        """Create new.

        Parameters
        ----------
        match_url : str
            The URL of the match to import, if any. Normally this should be infered from
            the state.
        duplicate_action : str
            The action to take if duplicates are found. One of "skip", "keep",
            "remove", "merge", "ask". If not specified, the default is read from
            the user config.
        """
        if (
            config_overlay
            and config_overlay.get("import", {}).get("search_ids") is not None
        ):
            raise ValueError("search_ids set in config_overlay. This is not supported.")

        if match_url is not None and state.progress > Progress.NOT_STARTED:
            raise ValueError("Cannot set match_url and for pre-populated state.")

        self.match_url = match_url

        if duplicate_action is None:
            duplicate_action = config["import"]["duplicate_action"].as_str()  # type: ignore
        self.duplicate_action = duplicate_action.lower()  # type: ignore
        super().__init__(state, config_overlay)

    # -------------------------------- Stages -------------------------------- #

    def lookup_candidates(self, task: importer.ImportTask):
        """Lookup candidates for the task."""

        if self.match_url is not None:
            task.search_ids = [self.match_url]

        super().lookup_candidates(task)

    def choose_match(self, task: importer.ImportTask):
        self.logger.setLevel(logging.DEBUG)
        self.logger.debug(f"choose_match {task}")

        try:
            match: BeetsAlbumMatch | BeetsTrackMatch = task.candidates[0]
        except IndexError:
            # FIXME: where and how is this handled? TODO: InvalidUrlError
            log.error(f"No matches found for {task=} {task.candidates=}")
            raise ValueError("No matches found. Is the provided search URL correct?")

        # Let plugins display info
        results = plugins.send("import_task_before_choice", session=self, task=task)
        actions = [action for action in results if action]

        if len(actions) > 0:
            # decide if we can just move past this and ignore the plugins
            raise UserError(
                f"Plugins returned actions, which is not supported for {self.__class__.__name__}"
            )

        return match

    def stages(self) -> List[Stage[importer.ImportTask, Any]]:
        """Return the stages of the pipeline."""
        stages: List[Stage[importer.ImportTask, Any]] = []

        if self.config["group_albums"] and not self.config["singletons"]:
            # FIXME once migrated to next beets version
            stages.append(group_albums(self))

        stages += [
            lookup_candidates(self),
            identify_duplicates(self),
            # FIXME: user_query calls task.choose_match, which calls session.choose_match.
            # Better abstraction needed upstream.
            user_query(self),
        ]

        # plugin stages
        for stage_func in plugins.early_import_stages():
            stages.append(
                plugin_stage(
                    self,
                    stage_func,
                    ProgressState(
                        Progress.EARLY_IMPORTING,
                        plugin_name=stage_func.__name__,
                    ),
                ),
            )

        for stage_func in plugins.import_stages():
            stages.append(
                plugin_stage(
                    self,
                    stage_func,
                    ProgressState(
                        Progress.IMPORTING,
                        plugin_name=stage_func.__name__,
                    ),
                ),
            )

        # finally, move files
        stages.append(
            manipulate_files(self),
        )

        return stages

    def resolve_duplicate(self, task: importer.ImportTask, found_duplicates):
        log.debug(
            f"Resolving duplicates for {task} with action {self.duplicate_action}"
        )
        match self.duplicate_action:
            case "skip":
                task.set_choice(importer.action.SKIP)
            case "keep":
                pass
            case "remove":
                task.should_remove_duplicates = True
            case "merge":
                task.should_merge_duplicates = True
            case "ask":
                task.set_choice(importer.action.SKIP)
            case _:
                log.warning(
                    f"Unknown duplicate resolution action: {self.duplicate_action}"
                )
                task.set_choice(importer.action.SKIP)


class InteractiveImportSession(BaseSessionNew):
    """Interactive Import Session.

    The interactive import session is used to parallel tag a directory and
    choose the correct match for each album via external input. The current state
    of the import is communicated to the user via an emitter.
    Feel free to implement your own emitter by subclassing the `Emitter` abc.
    """

    # usually this is a WebsocketCommunicator inheriting from ImportCommunicator
    communicator: WebsocketCommunicator

    def __init__(
        self,
        communicator: WebsocketCommunicator,
        state: SessionState,
        config_overlay: dict | None = None,
    ):
        """Create a new interactive import session.

        Automatically sets the default config values.

        Parameters
        ----------
        path : str
            The path to the directory to import.
        state:
            Session state, here tied to the communicator. The communicator puts
            updates into the sate which the session awaits.
        """
        set_config_defaults()
        super().__init__(state, config_overlay)
        self.communicator = communicator

    def set_task_progress(
        self, task: importer.ImportTask, progress: ProgressState | Progress | str
    ):
        """In addition to the default, emit the current state via connector."""
        super().set_task_progress(task, progress)  # this mutates the state
        self.communicator.emit_status_sync(self.state.progress)

    # -------------------------------- Stages -------------------------------- #

    def identify_duplicates(self, task: importer.ImportTask):
        """Identify and flag candidates of a task that are duplicates."""
        # Update state with new task. In parallel pipeline, user should be able to choose from all tasks simultaneously.
        # Emit the task to the user
        super().identify_duplicates(task)
        self.communicator.emit_state_sync(self.state)

    def offer_match(self, task: importer.ImportTask):
        """Triggers selection update using communicator.

        This is non-blocking.
        """
        log.debug(f"Offering match for task: {task}")

        # # Update state with new task. In parallel pipeline, user should be able to choose from all tasks simultaneously.
        # # Emit the task to the user
        # self.import_state.upsert_task(task)
        self.communicator.emit_state_sync(self.state)

        # tell plugins we are starting user_query
        results = plugins.send("import_task_before_choice", session=self, task=task)
        actions = [action for action in results if action]
        # but do not support actions via gui (yet?)
        if len(actions) > 0:
            raise ValueError(
                "Plugins are not allowed to return actions for GUI Sessions"
            )

    def choose_match(self, task: importer.ImportTask):
        """
        Needs to return an AlbumMatch object, ASIS, or SKIP.

        this blocks the stages pipeline, until choose_match invoked by each task has
        returned one of the above.
        """
        log.debug(f"Waiting for user selection for task: {task}")

        task_state = self.state.get_task_state_for_task(task)

        self.communicator.emit_state_sync(self.state)

        if task_state is None:
            raise ValueError("No selection state found for task.")

        async def wait_for_user_input():
            while True:
                if task_state.completed:
                    break
                if self.state.user_response == "abort":
                    self.set_task_progress(
                        task,
                        ProgressState(Progress.COMPLETED, "aborted"),
                    )
                    return importer.action.SKIP

                # SEARCHES
                if (
                    task_state.current_search_id is not None
                    or task_state.current_search_artist is not None
                ):
                    candidates = self.search_candidates(
                        task,
                        task_state.current_search_id,
                        task_state.current_search_artist,
                        task_state.current_search_album,
                    )

                    # Add the new candidates to the selection state
                    task_state.add_candidates(candidates)

                    # Reset search
                    task_state.current_search_id = None
                    task_state.current_search_artist = None
                    task_state.current_search_album = None

                    continue

                log.debug(f"Waiting for user input  {task_state=}")
                await asyncio.sleep(1)

        asyncio.run(wait_for_user_input())
        log.debug(f"User input received {task_state=}")

        if task_state.current_candidate_id is None:
            raise ValueError("No candidate selection found. This should not happen!")

        candidate = task_state.current_candidate_state
        if candidate is None:
            raise ValueError("No candidate state found. This should not happen!")

        # the dummmy candidate to signal we want to import `asis` has a hard-coded id:
        if candidate.is_asis:
            return importer.action.ASIS

        match: BeetsAlbumMatch = candidate.match  # type: ignore
        log.debug(f"Returning {match.info.album=} {match.info.album_id=} for {task=}")

        return match

    def search_candidates(
        self,
        task: importer.ImportTask,
        search_id: str | None,
        search_artist: str | None,
        search_album: str | None,
    ) -> List[BeetsAlbumMatch | BeetsTrackMatch]:
        """Search for candidates for the current selection."""
        log.debug("searching more candidates")

        candidates: list[BeetsAlbumMatch | BeetsTrackMatch] = []
        if search_artist is not None:
            # @ps: why is an assert here? This will error, no?
            assert search_album is not None
            _, _, proposal = autotag.tag_album(
                task.items,
                search_artist=search_artist,
                search_album=search_album,
            )
            candidates = list(proposal.candidates) + candidates

        if search_id is not None:
            _, _, proposal = autotag.tag_album(
                task.items,
                search_ids=search_id.split(),
            )
            candidates = list(proposal.candidates) + candidates

        log.debug(f"found {len(candidates)} new candidates")

        return candidates

    def resolve_duplicate(self, task, found_duplicates):
        """Handle duplicates.

        Decide what to do when a new album or item seems
        similar to one that's already in the library.
        """
        sel_state = self.state.get_task_state_for_task(task)
        if sel_state is None:
            raise ValueError("No selection state found for task.")

        sel = sel_state.duplicate_action
        log.debug(f"Resolving duplicates for {sel_state.id=} with action '{sel}'")

        if sel == "skip":
            # Skip new.
            task.set_choice(importer.action.SKIP)
        elif sel == "keep":
            # Keep both. Do nothing; leave the choice intact.
            pass
        elif sel == "remove":
            # Remove old.
            task.should_remove_duplicates = True
        elif sel == "merge":
            task.should_merge_duplicates = True
        else:
            raise ValueError(f"Unknown duplicate resolution action: {sel}")

    def stages(self) -> List[Stage[importer.ImportTask, Any]]:
        """Return the stages of the pipeline."""
        stages: List[Stage[importer.ImportTask, Any]] = []

        if self.config["group_albums"] and not self.config["singletons"]:
            # FIXME once migrated to next beets version
            stages.append(group_albums(self))

        stages += [
            lookup_candidates(self),
            identify_duplicates(self),
            offer_match(self),
            user_query(self),
        ]

        # plugin stages
        for stage_func in plugins.early_import_stages():
            stages.append(
                plugin_stage(
                    self,
                    stage_func,
                    ProgressState(
                        Progress.EARLY_IMPORTING,
                        plugin_name=stage_func.__name__,
                    ),
                ),
            )

        for stage_func in plugins.import_stages():
            stages.append(
                plugin_stage(
                    self,
                    stage_func,
                    ProgressState(
                        Progress.IMPORTING,
                        plugin_name=stage_func.__name__,
                    ),
                ),
            )

        # finally, move files
        stages.append(
            manipulate_files(self),
        )

        return stages

    async def run_async(self):
        await self.communicator.emit_current_async()
        state = await super().run_async()

        # FIXME: Why do we need this here? Set progress to completed
        for task in self.state.tasks:
            self.set_task_progress(task, ProgressState(Progress.COMPLETED))

        return state
