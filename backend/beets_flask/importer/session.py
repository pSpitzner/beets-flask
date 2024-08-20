import time
from typing import Callable, Type

from beets import importer, plugins
from beets.util import pipeline as beets_pipeline


from beets_flask.beets_sessions import BaseSession, set_config_defaults
from beets_flask.config import config
from beets_flask.logger import log

from .states import ImportState
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

    def offer_match(self, task: importer.ImportTask):

        log.debug(f"Offering match for task: {task}")

        # Update state with new task. In parallel pipeline, user should be able to choose from all tasks simultaneously.
        # Emit the task to the user
        self.import_state.upsert_task(task)
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
        # use communicator to receive user input
        completed = sel_state.await_completion()

        log.debug(f"User selection completed: {completed}")

        if self.import_state.user_response == "abort":
            return importer.action.SKIP

        if sel_state.current_candidate_idx is None:
            raise ValueError("No candidate selection found. This should not happen!")

        match = task.candidates[sel_state.current_candidate_idx]

        log.debug(f"Returning {match=} for {task=}")

        return match

    def set_status(self, status: str):
        """
        Set the status of the import session, and communicate the status change to the frontend.

        Note: currently we only implement status on the level of the whole import session,
        but should eventually do this per selection (task).
        """
        log.debug(f"Setting status to {status}")
        self.import_state.status = status
        self.communicator.emit_custom("import_state_status", status)

    def run(self):
        """Run the import task. Customized version of ImportSession.run"""
        self.logger.info(f"import started {time.asctime()}")
        self.set_config(config["import"])

        # mutator stage does not work for first task, set status manually
        self.set_status("reading files")
        stages = [
            importer.read_tasks(self),
        ]

        if self.config["group_albums"] and not self.config["singletons"]:
            stages += [
                status_stage(self, "grouping albums"),  # type: ignore
                importer.group_albums(self),
            ]

        stages += [
            status_stage(self, "looking up candidates"),
            importer.lookup_candidates(self),  # type: ignore
            offer_match(self),  # type: ignore
            status_stage(self, "waiting for user selection"),  # type: ignore
            importer.user_query(self),  # type: ignore
        ]

        # Plugin stages.
        for stage_func in plugins.early_import_stages():
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore
            stages.append(status_stage(self, f"early import plugin: {stage_func.__name__}"))  # type: ignore
        for stage_func in plugins.import_stages():
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore
            stages.append(status_stage(self, f"import plugin: {stage_func.__name__}"))  # type: ignore

        stages += [
            status_stage(self, "manipulating files"),  # type: ignore
            importer.manipulate_files(self),  # type: ignore
        ]

        self.pipeline = beets_pipeline.Pipeline(stages)

        log.debug(f"Running pipeline stages: {self.pipeline.stages}")

        # Run the pipeline.
        plugins.send("import_begin", session=self)
        try:
            self.pipeline.run_sequential()
        except importer.ImportAbort:
            self.logger.debug(f"Interactive import session aborted by user")

        log.debug(f"Pipeline completed")

        self.set_status("completed")
        if self.cleanup:
            self.cleanup()


from .pipeline import mutator_stage


@mutator_stage
def offer_match(session: InteractiveImportSession, task: importer.ImportTask):
    """
    Mutator stage to offer a match to the user. This is non-blocking. Essentially
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
    session: InteractiveImportSession, status: str, task: importer.ImportTask
):
    """
    Mutator stage to call sessions `set_status` method.
    """
    # sentinel tasks (this is what beets does in choose_match)
    if task.skip:
        return task
    session.set_status(status)
