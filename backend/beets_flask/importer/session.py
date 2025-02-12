import asyncio
import logging
import os
import threading
import time
from pathlib import Path
from posixpath import normpath
from typing import Any, Callable, List

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
from beets_flask.config import config
from beets_flask.disk import is_album_folder
from beets_flask.importer.types import BeetsAlbumMatch, BeetsTrackMatch
from beets_flask.logger import log
from beets_flask.utility import capture_stdout_stderr

from .communicator import WebsocketCommunicator
from .pipeline import AsyncPipeline, mutator_stage, stage
from .states import CandidateState, ImportStatusMessage, SessionState

nest_asyncio.apply()


class BaseSessionNew(importer.ImportSession):
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
        self.state.upsert_task(task)

        task_state = self.state.get_task_state_for_task(task)
        if task_state is None:
            raise ValueError("No state found for thiis task.")

        for idx, cs in enumerate(task_state.candidate_states):
            duplicates = cs.identify_duplicates(self.lib)

            if len(duplicates) > 0:
                log.debug(f"Found duplicates for {cs.id=}: {duplicates}")

    @property
    def track_paths_before_import(self) -> list[Path]:
        """Returns the paths to all media files that would be imported.

        Relies on `self.path` pointing to an album or single track.
        """
        # im not sure if beets rescans the directory on task creation / run.
        if self.path.is_file():
            return [self.path]

        items: list[bytes] = []
        for _, i in importer.albums_in_dir(self.path):
            # the generator returns a nested list of the outer diretories
            # and file paths. thus, extend and then cast
            items.extend(i)

        return [Path(i.decode("utf-8")) for i in items]

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

    def set_status(self, status: ImportStatusMessage | str):
        """Set the status of the import session, and communicate the status changes.

        Note: currently we only implement status on the level of the whole import session,
        but should eventually do this per selection (task).
        """
        if isinstance(status, ImportStatusMessage):
            self.state.status = status
        else:
            # just convenience, not type-safe :P
            self.state.status = ImportStatusMessage(status)  # type: ignore String to Literal


class PreviewSessionNew(BaseSessionNew):
    """Mocks an Import to gather the info displayed to the user.

    Only fetches candidates.
    """

    def run(self):
        raise NotImplementedError("This method should not be called!")

    async def run_async(self) -> SessionState:
        self.logger.info(f"import started {time.asctime()}")
        self.set_config(config["import"])

        # TODO: check some config values. that are not compatible with our code.

        self.set_status(ImportStatusMessage("reading files"))
        self.pipeline = AsyncPipeline(start_tasks=importer.read_tasks(self))

        if self.config["group_albums"] and not self.config["singletons"]:
            self.pipeline.add_stage(
                status_stage(self, ImportStatusMessage("grouping albums"))
            )
            # FIXME once migrated to next beets version
            self.pipeline.add_stage(importer.group_albums(self))  # type: ignore

        # main stages
        self.pipeline.add_stage(
            status_stage(self, ImportStatusMessage("looking up candidates")),
            importer.lookup_candidates(self),  # type: ignore
            status_stage(self, ImportStatusMessage("identifying duplicates")),
            identify_duplicates(self),
            # offer_match(self) -> invokes plugins.send("import_task_before_choice", session=self, task=task). check if we want to enable this plugin stage
        )

        log.debug(f"Running pipeline stages: {self.pipeline.stages}")

        plugins.send("import_begin", session=self)
        try:
            assert self.pipeline is not None
            await self.pipeline.run_async()
        except importer.ImportAbortError:
            self.logger.debug(f"Interactive import session aborted by user")

        log.debug(f"Pipeline completed")

        # FIXME: Status messages for preview
        self.set_status(ImportStatusMessage("preview completed"))  # type: ignore

        return self.state


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
        path: str,
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
        super().__init__(path, config_overlay, state)
        self.communicator = communicator

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
                    self.set_status(ImportStatusMessage("aborted"))
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
        if candidate.id == "asis":
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

    def set_status(self, status: ImportStatusMessage | str):
        """Set the status of the import session, and communicate the status changes.

        Note: currently we only implement status on the level of the whole import session,
        but should eventually do this per selection (task).
        """
        super().set_status(status)  # this mutates the state
        self.communicator.emit_status_sync(self.state.status)

    async def run_async(self):
        """Run the import task.

        Basically a customized version of `ImportSession.run`.
        """
        self.logger.info(f"import started {time.asctime()}")

        # TODO: check some config values. that are not compatible with our code.
        self.set_config(config["import"])

        self.set_status(ImportStatusMessage("reading files"))
        # FIXME: This should also deserialize saved state
        self.pipeline = AsyncPipeline(start_tasks=importer.read_tasks(self))

        if self.config["group_albums"] and not self.config["singletons"]:
            self.pipeline.add_stage(
                status_stage(self, ImportStatusMessage("grouping albums"))
            )
            self.pipeline.add_stage(importer.group_albums(self))  # type: ignore

        # main stages
        self.pipeline.add_stage(
            status_stage(self, ImportStatusMessage("looking up candidates")),
            importer.lookup_candidates(self),  # type: ignore
            status_stage(self, ImportStatusMessage("identifying duplicates")),
            identify_duplicates(self),
            offer_match(self),
            status_stage(self, ImportStatusMessage("waiting for user selection")),
            importer.user_query(self),  # type: ignore
        )

        # plugin stages
        for stage_func in plugins.early_import_stages():
            self.pipeline.add_stage(
                status_stage(
                    self,
                    ImportStatusMessage(
                        message="plugin",
                        plugin_stage="early import",
                        plugin_name=stage_func.__name__,
                    ),
                ),
                importer.plugin_stage(self, stage_func),  # type: ignore
            )

        for stage_func in plugins.import_stages():
            self.pipeline.add_stage(
                status_stage(
                    self,
                    ImportStatusMessage(
                        message="plugin",
                        plugin_stage="import",
                        plugin_name=stage_func.__name__,
                    ),
                ),
                importer.plugin_stage(self, stage_func),  # type: ignore
            )

        # finally, move files
        self.pipeline.add_stage(
            status_stage(self, ImportStatusMessage("manipulating files")),
            importer.manipulate_files(self),  # type: ignore
        )

        log.debug(f"Running pipeline stages: {self.pipeline.stages}")

        plugins.send("import_begin", session=self)
        try:
            assert self.pipeline is not None
            await self.communicator.emit_current_async()
            await self.pipeline.run_async()
        except importer.ImportAbortError:
            self.logger.debug(f"Interactive import session aborted by user")

        log.debug(f"Pipeline completed")
        self.set_status(ImportStatusMessage("completed"))


@mutator_stage
def identify_duplicates(session: BaseSessionNew, task: importer.ImportTask):
    """Stage to identify which candidates would be duplicates if imported."""
    if task.skip:
        return task
    session.identify_duplicates(task)


@mutator_stage
def offer_match(session: InteractiveImportSession, task: importer.ImportTask):
    """Stage to offer a match to the user.

    This is non-blocking. Essentially we split the `user_query` stage (which calls `choose_match`) into two stages.
    The first is `offer_match` sending info to the frontend, while the second is
    `choose_match` that waits until all user choices have been made.
    """
    # sentinel tasks (this is what beets does in choose_match)
    if task.skip:
        return task
    session.offer_match(task)


@mutator_stage
def status_stage(
    session: BaseSessionNew,
    status: ImportStatusMessage | None,
    task: importer.ImportTask,
):
    """Stage to call sessions `set_status` method."""
    # sentinel tasks (this is what beets does in choose_match)
    # sio: AsyncServer = session.communicator.sio
    # log.debug(
    #     f"\nStatus stage:\n\t{status.value}\n\t{threading.get_ident()=}\n\t{task.skip=}\n\t{sio=}\n\t{sio.manager.rooms['/import']=}"
    # )
    if task.skip:
        return task
    session.set_status(status or ImportStatusMessage("unknown"))
