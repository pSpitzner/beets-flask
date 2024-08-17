import time

from beets import importer, plugins
from beets.util import pipeline as beets_pipeline


from beets_flask.beets_sessions import BaseSession, set_config_defaults
from beets_flask.config import config
from beets_flask.logger import log

from .states import ImportState
from .emitter import ImportCommunicator, WebsocketEmitter


class InteractiveImportSession(BaseSession):
    """
    The interactive import session is used to parallely tag a directory and
    choose the correct match for each album via external input. The current state
    of the import is communicated to the user via an emitter.
    Feel free to implement your own emitter by subclassing the `Emitter` abc.
    """

    # current session state
    import_state = ImportState()
    communicator: ImportCommunicator

    task: importer.ImportTask | None = None
    pipeline: beets_pipeline.Pipeline | None = None

    def __init__(self, path: str, config_overlay: str | dict | None = None):
        """
        Create a new interactive import session. Automatically sets the default config values.

        Parameters:
        -----------
        path : str
            The path to the directory to import.
        config_overlay : str | dict | None
            Path to a config file to overlay on top of the default config.
            Note that if `dict`, the lazyconfig notation e.g. `{import.default_action: skip}` wont work reliably. Better nest the dicts: `{import: {default_action: skip}}`
        """

        set_config_defaults()
        super(InteractiveImportSession, self).__init__(path, config_overlay)
        self.communicator = WebsocketEmitter(self.import_state, sio)

    def offer_match(self, task: importer.ImportTask):

        # Update state with new task
        # Emit the task to the user
        # TODO: Think about partial updates/emits for task diffs
        self.import_state.upsert_task(task)
        self.communicator.emit_status(self.import_state)

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

        state = self.import_state.get_selection_state_for_task(task)
        self.communicator.emit_status(state)

        if state is None:
            raise ValueError("No selection state found for task.")

        # BLOCKING
        state.await_completion()

        if state.current_candidate_idx is None:
            raise ValueError("No candidate selected.")

        match = task.candidates[state.current_candidate_idx]

        return match

    def run(self):
        """Run the import task. Customized version of ImportSession.run"""
        self.logger.info(f"import started {time.asctime()}")
        self.set_config(config["import"])

        self.import_state.set_status("reading files")
        stages = [
            # mutator stage does not work for first task, set status manually
            importer.read_tasks(self),
        ]

        if self.config["group_albums"] and not self.config["singletons"]:
            stages += [
                set_status(self, "grouping albums"),  # type: ignore
                importer.group_albums(self),
            ]

        stages += [
            set_status(self, "looking up candidates"),
            importer.lookup_candidates(self),  # type: ignore
            offer_match(self),  # type: ignore
            set_status(self, "waiting for user selection"),  # type: ignore
            importer.user_query(self),  # type: ignore
        ]

        # Plugin stages.
        for stage_func in plugins.early_import_stages():
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore
        for stage_func in plugins.import_stages():
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore

        stages += [
            set_status(self, "manipulating files"),  # type: ignore
            importer.manipulate_files(self),  # type: ignore
        ]

        self.pipeline = beets_pipeline.Pipeline(stages)

        # Run the pipeline.
        plugins.send("import_begin", session=self)
        try:
            self.pipeline.run_sequential()
        except importer.ImportAbort:
            self.logger.debug(f"Interactive import session aborted by user")

        self.import_state.set_status("completed")


from .pipeline import mutator_stage


@mutator_stage
def offer_match(session: InteractiveImportSession, task: importer.ImportTask):
    session.offer_match(task)


@mutator_stage
def set_status(
    session: InteractiveImportSession, status: str, task: importer.ImportTask
):
    log.debug(f"mutator_stage {status=}")
    session.import_state.set_status(status)
