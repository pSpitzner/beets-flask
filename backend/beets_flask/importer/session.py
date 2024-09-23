from enum import Enum
import time
from typing import Callable, List

from beets import importer, plugins, library, autotag

from beets.util import pipeline as beets_pipeline


from beets_flask.beets_sessions import BaseSession, set_config_defaults
from beets_flask.config import config
from beets_flask.importer.types import AlbumMatch, TrackMatch
from beets_flask.logger import log

from .pipeline import mutator_stage
from .states import ImportState, CandidateState, ImportStatus
from .communicator import ImportCommunicator


class InteractiveImportSession(BaseSession):
    """
    The interactive import session is used to parallely tag a directory and
    choose the correct match for each album via external input. The current state
    of the import is communicated to the user via an emitter.
    Feel free to implement your own emitter by subclassing the `Emitter` abc.
    """

    # current session state
    import_state: ImportState
    # usually this is a WebsocketCommunicator inheriting from ImportCommunicator
    communicator: ImportCommunicator

    task: importer.ImportTask | None = None
    pipeline: beets_pipeline.Pipeline | None = None
    cleanup: Callable | None = None

    def __init__(
        self,
        import_state: ImportState,
        communicator: ImportCommunicator,
        path: str,
        config_overlay: str | dict | None = None,
        cleanup: Callable | None = None,
    ):
        """
        Create a new interactive import session. Automatically sets the default config values.

        Parameters:
        -----------
        path : str
            The path to the directory to import.
        config_overlay : str | dict | None
            Path to a config file to overlay on top of the default config.
            Note that if `dict`, the lazyconfig notation e.g. `{import.default_action: skip}` wont work reliably. Better nest the dicts: `{import: {default_action: skip}}`
        cleanup : Callable | None
            Called after the import session is done.
        """

        set_config_defaults()
        super(InteractiveImportSession, self).__init__(path, config_overlay)
        self.communicator = communicator
        self.import_state = import_state
        self.cleanup = cleanup

    def identify_duplicates(self, task: importer.ImportTask):
        """
        Identify which candidates of a task would be duplicates, and flag them as such.
        """

        # Update state with new task. In parallel pipeline, user should be able to choose from all tasks simultaneously.
        # Emit the task to the user
        self.import_state.upsert_task(task)
        # self.communicator.emit_state(self.import_state)

        sel_state = self.import_state.get_selection_state_for_task(task)
        if sel_state is None:
            raise ValueError("No selection state found for task.")

        def _is_duplicate(candidate_state: CandidateState):
            """Copy of beets' `task.find_duplicate` but works on any candidates' match"""
            info = candidate_state.match.info.copy()
            info["albumartist"] = info["artist"]

            if info["artist"] is None:
                # As-is import with no artist. Skip check.
                return []

            # Construct a query to find duplicates with this metadata. We
            # use a temporary Album object to generate any computed fields.
            tmp_album = library.Album(self.lib, **info)
            keys: List[str] = config["import"]["duplicate_keys"]["album"].as_str_seq() or []  # type: ignore
            dup_query = library.Album.all_fields_query(
                {key: tmp_album.get(key) for key in keys}
            )

            # Don't count albums with the same files as duplicates.
            task_paths = {i.path for i in task.items if i}

            duplicates = []
            for album in self.lib.albums(dup_query):
                # Check whether the album paths are all present in the task
                # i.e. album is being completely re-imported by the task,
                # in which case it is not a duplicate (will be replaced).
                album_paths = {i.path for i in album.items()}
                if not (album_paths <= task_paths):
                    duplicates.append(album)

            return duplicates

        for idx, cs in enumerate(sel_state.candidate_states):
            duplicates = _is_duplicate(cs)
            if len(duplicates) > 0:
                cs.duplicate_in_library = True

    def offer_match(self, task: importer.ImportTask):
        """
        Triggers selection screen in the frontend. This is non-blocking.
        """

        log.debug(f"Offering match for task: {task}")

        # # Update state with new task. In parallel pipeline, user should be able to choose from all tasks simultaneously.
        # # Emit the task to the user
        # self.import_state.upsert_task(task)
        self.communicator.emit_state(self.import_state)

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

        sel_state = self.import_state.get_selection_state_for_task(task)
        self.communicator.emit_state(sel_state)

        if sel_state is None:
            raise ValueError("No selection state found for task.")

        # BLOCKING
        # We use the communicator to receive user input, which modifies the sel_state
        while True:
            if sel_state.completed:
                break
            if self.import_state.user_response == "abort":
                self.set_status(ImportStatus("aborted"))
                return importer.action.SKIP

            # SEARCHES
            if (
                sel_state.current_search_id is not None
                or sel_state.current_search_artist is not None
            ):
                candidates = self.search_candidates(
                    task,
                    sel_state.current_search_id,
                    sel_state.current_search_artist,
                    sel_state.current_search_album,
                )

                # Add the new candidates to the selection state
                sel_state.add_candidates(candidates)

                # Reset search
                sel_state.current_search_id = None
                sel_state.current_search_artist = None
                sel_state.current_search_album = None

                continue

            time.sleep(3)

        if sel_state.current_candidate_id is None:
            raise ValueError("No candidate selection found. This should not happen!")

        candidate = sel_state.current_candidate_state
        if candidate is None:
            raise ValueError("No candidate state found. This should not happen!")

        # the dummmy candidate to signal we want to import `asis` has a hard-coded id:
        if candidate.id == "asis":
            return importer.action.ASIS

        match: AlbumMatch = candidate.match  # type: ignore
        log.debug(f"Returning {match.info.album=} {match.info.album_id=} for {task=}")

        return match

    def search_candidates(
        self,
        task: importer.ImportTask,
        search_id: str | None,
        search_artist: str | None,
        search_album: str | None,
    ) -> List[AlbumMatch | TrackMatch]:
        """
        Search for candidates for the current selection.
        """
        log.debug("searching more candidates")

        candidates = []
        if search_artist is not None:
            # @ps: why is an assert here? This will error, no?
            assert search_album is not None
            _, _, proposal = autotag.tag_album(
                task.items,
                search_artist=search_artist,
                search_album=search_album,
            )
            candidates = proposal.candidates + candidates

        if search_id is not None:
            _, _, proposal = autotag.tag_album(
                task.items,
                search_ids=search_id.split(),
            )
            candidates = proposal.candidates + candidates

        log.debug(f"found {len(candidates)} new candidates")

        return candidates

    def resolve_duplicate(self, task, found_duplicates):
        """
        Decide what to do when a new album or item seems
        similar to one that's already in the library.
        """
        sel_state = self.import_state.get_selection_state_for_task(task)
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

    def set_status(self, status: ImportStatus):
        """
        Set the status of the import session, and communicate the status change to the frontend.

        Note: currently we only implement status on the level of the whole import session,
        but should eventually do this per selection (task).
        """
        log.debug(f"Setting status to {status.value}")
        self.import_state.status = status
        self.communicator.emit_status(status)

    def run(self):
        """Run the import task. Customized version of ImportSession.run"""
        self.logger.info(f"import started {time.asctime()}")
        self.set_config(config["import"])

        # mutator stage does not work for first task, set status manually
        self.set_status(ImportStatus("reading files"))
        stages = [
            importer.read_tasks(self),
        ]

        if self.config["group_albums"] and not self.config["singletons"]:
            stages += [
                status_stage(self, ImportStatus("grouping albums")),
                importer.group_albums(self),
            ]

        stages += [
            status_stage(self, ImportStatus("looking up candidates")),
            importer.lookup_candidates(self),  # type: ignore
            status_stage(self, ImportStatus("identifying duplicates")),
            identify_duplicates(self),
            offer_match(self),
            status_stage(self, ImportStatus("waiting for user selection")),
            importer.user_query(self),  # type: ignore
        ]

        # Plugin stages.
        for stage_func in plugins.early_import_stages():
            stages.append(
                status_stage(
                    self,
                    ImportStatus(
                        message="plugin",
                        plugin_stage="early import",
                        plugin_name=stage_func.__name__,
                    ),
                )
            )
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore
        for stage_func in plugins.import_stages():
            stages.append(
                status_stage(
                    self,
                    ImportStatus(
                        message="plugin",
                        plugin_stage="import",
                        plugin_name=stage_func.__name__,
                    ),
                )
            )
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore

        stages += [
            status_stage(self, ImportStatus("manipulating files")),
            importer.manipulate_files(self),  # type: ignore
        ]

        self.pipeline = beets_pipeline.Pipeline(stages)

        log.debug(f"Running pipeline stages: {self.pipeline.stages}")

        # Run the pipeline.
        plugins.send("import_begin", session=self)
        try:
            self.pipeline.run_sequential()
            # parallel still broken. no attribute queue.mutex, no idea why
            # self.pipeline.run_parallel()
        except importer.ImportAbort:
            self.logger.debug(f"Interactive import session aborted by user")

        log.debug(f"Pipeline completed")

        self.set_status(ImportStatus("completed"))
        if self.cleanup:
            self.cleanup()


@mutator_stage
def identify_duplicates(session: InteractiveImportSession, task: importer.ImportTask):
    """
    Stage to identify which candidates would be duplicates if imported.
    """
    if task.skip:
        return task
    session.identify_duplicates(task)


@mutator_stage
def offer_match(session: InteractiveImportSession, task: importer.ImportTask):
    """
    Stage to offer a match to the user. This is non-blocking. Essentially
    we split the `user_query` stage (which calls `choose_match`) into two stages.
    The first is `offer_match` sending info to the frontend, while the second is
    `choose_match` that waits until all user choices have been made.
    """
    # sentinel tasks (this is what beets does in choose_match)
    if task.skip:
        return task
    session.offer_match(task)


@mutator_stage
def status_stage(
    session: InteractiveImportSession,
    status: ImportStatus,
    task: importer.ImportTask,
):
    """
    Stage to call sessions `set_status` method.
    """
    # sentinel tasks (this is what beets does in choose_match)
    if task.skip:
        return task
    session.set_status(status)
