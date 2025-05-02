import asyncio
import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable, List, Mapping, TypedDict, TypeGuard

import nest_asyncio
from beets import autotag, importer, plugins
from beets.ui import UserError, _open_library
from deprecated import deprecated

from beets_flask.config import get_config
from beets_flask.disk import is_album_folder
from beets_flask.importer.progress import Progress, ProgressState
from beets_flask.importer.types import (
    BeetsAlbum,
    BeetsAlbumMatch,
    BeetsLibrary,
    BeetsTrackMatch,
    DuplicateAction,
)
from beets_flask.logger import log
from beets_flask.server.exceptions import to_serialized_exception
from beets_flask.utility import capture_stdout_stderr

from .communicator import WebsocketCommunicator
from .pipeline import AsyncPipeline, Stage
from .stages import (
    StageOrder,
    group_albums,
    identify_duplicates,
    import_asis,
    lookup_candidates,
    manipulate_files,
    mark_tasks_completed,
    mark_tasks_preview_completed,
    match_threshold,
    offer_match,
    plugin_stage,
    read_tasks,
    user_query,
)
from .states import ProgressState, SessionState

nest_asyncio.apply()


class BaseSession(importer.ImportSession, ABC):
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
    config_overlay: dict

    # FIXME: only for typehint until we update beets
    lib: BeetsLibrary  # type: ignore

    def __init__(
        self,
        state: SessionState,
        config_overlay: dict | None = None,
    ):
        if not state.path.exists():
            raise FileNotFoundError(f"Path {state.path} does not exist.")
        if not state.path.is_dir() and not is_album_folder(state.path):
            raise ValueError(f"Path {state.path} is not an album folder.")

        # FIXME: This is a super bad convention of the original beets.
        # We do not want to pollute a global config object every time a session runs.
        # This is fine for the cli tool, where each run creates only one session
        # but not for our long-running webserver.
        config = get_config()
        if isinstance(config_overlay, dict):
            config.set_args(config_overlay)

        self.config_overlay = config_overlay or {}
        self.state = state

        super().__init__(
            lib=_open_library(config),
            paths=[state.path],
            query=None,
            loghandler=None,
        )
        # Hacky workaround to use our logging, to allow plugins to communicate
        self.logger.handlers = log.handlers
        log.debug(f"Created new {self.__class__.__name__} for {state.path}")

    @property
    def path(self) -> Path:
        return self.state.path

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

    def get_config_value(self, key: str, type_func: Callable | None = None) -> Any:
        """Get a config value from the overlay or default.

        Use dots to separate levels.
        """

        path = key.split(".")

        overlay = self.config_overlay
        for p in path:
            overlay = overlay.get(p, {})

        # overlay takes priority
        if not isinstance(overlay, dict):
            return type_func(overlay) if type_func else overlay

        # get settings from user settings, this is not a dict, but confuse config
        # the confuse config views do not throw key errors, and their .get() is not
        # the same as dict.get(), but rather resolves the value.
        default = get_config()
        for p in path:
            default = default[p]
        default = default.get(type_func) if type_func else default.get()
        return default

    # -------------------------- State handling helpers -------------------------- #

    def set_task_progress(
        self, task: importer.ImportTask, progress: ProgressState | Progress | str
    ):
        """Set the progress for a task belonging to the session.

        If string is given it is set as the message of the current progress.
        Note: currently we only implement status on the level of the whole import session,
        but should eventually do this per selection (task).
        """

        task_state = self.state.get_task_state_for_task(task)
        assert task_state is not None, "Task state not found for task."

        task_state.set_progress(progress)

    def get_task_progress(self, task: importer.ImportTask) -> ProgressState | None:
        """Get the progress of the task, via this sessions state."""
        task_state = self.state.get_task_state_for_task(task)
        return task_state.progress if task_state else None

    # -------------------------------- Stages -------------------------------- #

    @property
    @abstractmethod
    def stages(self) -> StageOrder:
        """Set the stages for the session.

        In Subclasses, define the order of stages here.
        """
        raise NotImplementedError("Implement in subclass")

    def resolve_duplicate(self, task: importer.ImportTask, found_duplicates):
        """Overload default resolve duplicate and skip it.

        This basically skips this stage.
        """
        self.logger.warning(
            "Skipping duplicate resolution. "
            + f"Your session should implement this! -> {self.__class__.__name__}"
        )
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

        for s in self.stages.values():
            self.pipeline.add_stage(s)

        log.info(f"Running {self.__class__.__name__} on state<{self.state.id=}>.")
        log.debug(f"Running {len(self.pipeline.stages)} stages.")

        # reset exception state
        self.state.exc = None
        plugins.send("import_begin", session=self)
        try:
            assert self.pipeline is not None
            await self.pipeline.run_async()
        except importer.ImportAbortError:
            log.debug(f"Interactive import session aborted by user")
        except Exception as e:
            self.state.exc = to_serialized_exception(e)
            raise e

        log.info(f"Completed {self.__class__.__name__} on state<{self.state.id=}>.")
        return self.state


class PreviewSession(BaseSession):
    """Preview what would be imported. Only fetches candidates."""

    def __init__(
        self, state: SessionState, config_overlay: dict | None = None, **kwargs
    ):
        super().__init__(state, config_overlay, **kwargs)

    @property
    def stages(self) -> StageOrder:
        stages = StageOrder()
        if self.get_config_value("import.group_albums") and not self.get_config_value(
            "import.singletons"
        ):
            stages.append(group_albums(self))

        stages.append(lookup_candidates(self))
        stages.append(identify_duplicates(self))

        # this is carbon copy of mark_completed
        # -> can we get a general "set progress" stage?
        stages.append(mark_tasks_preview_completed(self))

        return stages


class Search(TypedDict):
    """Search for a candidate.

    This is used to search for a candidate in the preview session.
    """

    search_ids: list[str]
    search_artist: str | None
    search_album: str | None


def is_search(d: Any) -> TypeGuard[Search]:
    """Check if the given dict is a Search object."""
    return (
        d is not None
        and isinstance(d, dict)
        and "search_ids" in d
        and isinstance(d["search_ids"], list)
    )


def is_search_mapping(
    d: Search | Mapping[str, Search],
) -> TypeGuard[Mapping[str, Search]]:
    """Check if the given dict is a Mapping object."""
    return (
        d is not None
        and isinstance(d, dict)
        and all(isinstance(k, str) for k in d.keys())
        and all(is_search(v) for v in d.values())
    )


class AddCandidatesSession(PreviewSession):
    """
    Preview session that adds a candidate to the ones already fetched.

    Can only run on a session state of a preview session that already has
    candidates.
    """

    search: Mapping[str, Search]

    def __init__(
        self,
        state: SessionState,
        config_overlay: dict | None = None,
        search: Search | Mapping[str, Search] | None = None,
        **kwargs,
    ):
        super().__init__(state, config_overlay, **kwargs)

        if state.progress != Progress.PREVIEW_COMPLETED:
            raise ValueError("Cannot run AddCandidatesSession on non-preview state.")

        # Validate given search
        if search is None:
            self.search = {}
        elif is_search(search):
            if len(self.state.task_states) > 1:
                raise ValueError(
                    "search must be a Mapping[str, Search] if multiple tasks are given"
                )
            self.search = defaultdict(lambda: search)
        elif is_search_mapping(search):
            self.search = search
        else:
            raise ValueError("search must be a Search or Mapping[str, Search]")

        # Reset task progress only for tasks that have search values
        # other tasks are skipped
        for task in self.state.task_states:
            if task.progress >= Progress.PREVIEW_COMPLETED:
                try:
                    self.search[task.id]
                except KeyError:
                    # this task does not have a search value
                    continue
                task.set_progress(Progress.LOOKING_UP_CANDIDATES - 1)

    def lookup_candidates(self, task: importer.ImportTask):
        """Amend the found candidate to the already existing candidates (if any)."""
        # see ref in lookup_candidates in beets/importer.py

        task_state = self.state.get_task_state_for_task(task)
        if task_state is None:
            raise ValueError("No task state found for task.")
        try:
            search = self.search[task_state.id]
        except KeyError:
            search = Search(
                search_ids=[],
                search_artist=None,
                search_album=None,
            )

        log.debug(f"Using {search=} for {task_state.id=}, {task_state.paths=}")

        _, _, prop = autotag.tag_album(
            task.items,
            search_ids=search["search_ids"],
            search_album=search["search_album"],
            search_artist=search["search_artist"],
        )

        task_state.add_candidates(prop.candidates)

        # Update quality of best candidate, likely not needed for us, only beets cli.
        task.rec = max(prop.recommendation, task.rec or autotag.Recommendation.none)


from enum import Enum


class ImportChoice(Enum):
    """Enum for the import choice."""

    ASIS = 1
    BEST = 2


CandidateChoice = str | ImportChoice


class ImportSession(BaseSession):
    """
    Import session that assumes we already have a match-id.

    Should run from an already finished Preview Session, but this
    is not (yet) enforced.
    """

    match_url: str | None
    candidate_id_mapping: Mapping[str, CandidateChoice | None]
    duplicate_action: Mapping[str, DuplicateAction]

    def __init__(
        self,
        state: SessionState,
        config_overlay: dict | None = None,
        match_url: str | None = None,
        candidate_id: CandidateChoice | dict[str, CandidateChoice] = ImportChoice.BEST,
        duplicate_action: DuplicateAction | None | dict[str, DuplicateAction] = None,
    ):
        """Create new ImportSession.

        Parameters
        ----------
        match_url : optional str
            The URL of the match to import, if any. Normally this should be inferred from
            the state.

        candidate_id : optional
            Either id of candidate(s) or the import choice. This is used to determine which
            candidate to import. If a dict is given, the keys are the task ids and the
            values are the candidate ids. You can also use the import choice enum
            `ImportChoice.ASIS` or `ImportChoice.BEST` to indicate that you want to
            import the candidate as-is or the best candidate.
            FIXME: at the moment asis is broken
        duplicate_action : str
            The action to take if duplicates are found. One of "skip", "keep",
            "remove", "merge", "ask". If None, the default is read from
            the user config and applied to all tasks.
        """

        config_overlay = {} if config_overlay is None else config_overlay
        if config_overlay.get("import", {}).get("search_ids") is not None:
            raise ValueError("search_ids set in config_overlay. This is not supported.")

        super().__init__(state, config_overlay)

        if match_url is not None and state.progress > Progress.NOT_STARTED:
            raise ValueError("Cannot set match_url for pre-populated state.")

        self.match_url = match_url

        task_states = self.state.task_states
        # Create a mapping for which candidate to import for each task.
        # uses a default dict to allow for a single candidate id
        if len(task_states) > 1 and isinstance(candidate_id, str):
            raise ValueError(
                "Candidate_id must be a dict with task ids as keys if multiple tasks are given"
            )
        if isinstance(candidate_id, dict):
            self.candidate_id_mapping = defaultdict(lambda: None)
            self.candidate_id_mapping.update(candidate_id)
        else:
            self.candidate_id_mapping = defaultdict(lambda: candidate_id)

        # Create a mapping for the duplicate action
        # each task might have a different action, if none is given
        # the default action is used from the config
        if len(task_states) > 1 and isinstance(duplicate_action, str):
            raise ValueError(
                "Duplicate_action must be a dict with task ids as keys if multiple tasks are given"
            )
        default_action: DuplicateAction = self.get_config_value(
            "import.duplicate_action", str
        )
        if duplicate_action is None:
            duplicate_action = default_action
        if isinstance(duplicate_action, dict):
            self.duplicate_action = defaultdict(lambda: default_action)
            self.duplicate_action.update(duplicate_action)
        else:
            self.duplicate_action = defaultdict(lambda: duplicate_action)

    async def run_async(self) -> SessionState:
        # only allow import sessions to run on preview states (not other import states)
        if self.state.progress == Progress.IMPORT_COMPLETED:
            log.error(
                f"Cannot run {self.__class__.__name__} from states that already "
                + f"completed an import. (i.e. other imports) [{self.state.progress}]"
            )
            e = UserError("Cannot redo imports. Try undo and/or retag!")
            self.state.exc = to_serialized_exception(e)
            raise e
        elif self.state.progress > Progress.PREVIEW_COMPLETED:
            log.warning(
                f"Resetting state from {self.state.progress} to PREVIEW_COMPLETED for "
                + f"import session {self.state.id}."
            )
            for task in self.state.task_states:
                task.set_progress(Progress.PREVIEW_COMPLETED)

        return await super().run_async()

    # ------------------------------ Stages ------------------------------ #

    @property
    def stages(self):
        stages = StageOrder()
        if self.get_config_value("import.group_albums") and not self.get_config_value(
            "import.singletons"
        ):
            stages.append(group_albums(self))
        """
        # FIXME: Does not really work with multi task sessions.
        if (
            self.candidate_id_mapping is not None
            and self.candidate_id_mapping.startswith("asis")
        ):
            # this branching has to be done here, as it skips the expensive lookup and
            # user query. this is also consistent with the way beets does it.
        
            stages.append(import_asis(self))
        else:
        """
        stages.append(lookup_candidates(self))
        stages.append(identify_duplicates(self))
        stages.append(mark_tasks_preview_completed(self))
        # FIXME: user_query calls task.choose_match, which calls session.choose_match.
        # Better abstraction needed upstream.
        stages.append(user_query(self))

        # Early import stages
        plugs: list[plugins.BeetsPlugin] = plugins.find_plugins()
        for p in plugs:
            for stage in p.get_early_import_stages():
                stages.append(
                    plugin_stage(
                        self,
                        stage,
                        ProgressState(
                            Progress.EARLY_IMPORTING,
                            plugin_name=stage.__name__,
                        ),
                    ),
                    name=f"early_plugin_stage_{p.__class__.__name__}_{stage.__name__}",
                )

        # Import stages
        for p in plugs:
            for stage in p.get_import_stages():
                stages.append(
                    plugin_stage(
                        self,
                        stage,
                        ProgressState(
                            Progress.IMPORTING,
                            plugin_name=stage.__name__,
                        ),
                    ),
                    name=f"plugin_stage_{p.__class__.__name__}_{stage.__name__}",
                )

        # finally, move files
        stages.append(manipulate_files(self))

        # If everything went well, set tasks to completed
        stages.append(mark_tasks_completed(self))

        return stages

    # --------------------------- Stage Definitions -------------------------- #

    def lookup_candidates(self, task: importer.ImportTask):
        """Lookup candidates for the task."""

        if self.match_url is not None:
            task.search_ids = [self.match_url]

        super().lookup_candidates(task)

    def choose_match(self, task: importer.ImportTask):
        self.logger.setLevel(logging.DEBUG)
        self.logger.debug(f"choose_match {task}")

        task_state = self.state.get_task_state_for_task(task)
        if task_state is None:
            raise ValueError("No task state found for task.")

        # Pick the candidate to import
        candidate_id = self.candidate_id_mapping[task_state.id]
        if candidate_id is None:  # none indicates no candidate give, should error
            raise ValueError(
                f"Candidate id is None for task {task_state.id}. Please provide a candidate id!"
            )
        if isinstance(candidate_id, str):
            candidate_state = task_state.get_candidate_state_by_id(candidate_id)
            if candidate_state is None:
                raise ValueError(f"Candidate with id {candidate_id} not found.")
        elif candidate_id == ImportChoice.BEST:
            candidate_state = task_state.best_candidate_state
            if candidate_state is None:
                raise ValueError(f"No candidate found.")
        else:
            raise NotImplementedError("ImportChoice.ASIS not implemented yet.")

        # update task_state to keep track of the choice in the database
        task_state.chosen_candidate_state_id = candidate_state.id

        # Let plugins display info
        results = plugins.send("import_task_before_choice", session=self, task=task)
        actions = [action for action in results if action]

        if len(actions) > 0:
            # decide if we can just move past this and ignore the plugins
            raise UserError(
                f"Plugins returned actions, which is not supported for {self.__class__.__name__}"
            )

        return candidate_state.match

    def resolve_duplicate(
        self, task: importer.ImportTask, found_duplicates: list[BeetsAlbum]
    ):
        log.debug(
            f"Resolving duplicates for {task} with action {self.duplicate_action}"
        )

        if len(found_duplicates) == 0:
            log.debug(f"No duplicates found for")
            return

        task_state = self.state.get_task_state_for_task(task)
        if task_state is None:
            raise ValueError("No task state found for task.")
        task_duplicate_action = self.duplicate_action[task_state.id]
        match task_duplicate_action:
            case "skip":
                task.set_choice(importer.action.SKIP)
            case "keep":
                pass
            case "remove":
                task.should_remove_duplicates = True
            case "merge":
                task.should_merge_duplicates = True
            case "ask":
                # task.set_choice(importer.action.SKIP)
                raise UserError(
                    "Duplicate action 'ask', but no user choice was provided."
                )
            case _:
                raise UserError(
                    f"Unknown duplicate resolution action: {self.duplicate_action}"
                )


class BootlegImportSession(ImportSession):
    """
    Import session to import without modifying metadata.

    No preview session required.

    Essentially `beet import --group-albums -A`, ideal for bootlegs and
    just getting a folder into your library where you are sure the metadata is correct.
    """

    def __init__(
        self,
        state,
        config_overlay: dict | None = None,
        **kwargs,
    ):
        """Create new ImportAsIsSession.

        Parameters
        ----------
        state: SessionState
            Preconfigured state of the import session.
        config_overlay : dict
            Configuration to overlay on top of the default config.
            "import.group_albums", "import.autotag" and "import.search_ids" are ignored.
        **kwargs
            See `ImportSession`.
        """

        config_overlay = {} if config_overlay is None else deepcopy(config_overlay)
        import_overlay = config_overlay.get("import", {})

        if "group_albums" in import_overlay and import_overlay["group_albums"] is False:
            log.warning("Overwriting 'group_albums' in config_overlay.")
        if "autotag" in import_overlay and import_overlay["autotag"] is True:
            log.warning("Overwriting 'autotag' in config_overlay.")
        if "search_ids" in import_overlay:
            log.warning("Overwriting 'search_ids' in config_overlay.")

        import_overlay["group_albums"] = True
        import_overlay["autotag"] = False
        import_overlay["search_ids"] = []

        config_overlay["import"] = import_overlay

        super().__init__(state, config_overlay, **kwargs)


class AutoImportSession(ImportSession):
    """
    Generate a preview and import if the best match is good enough.
    Preview generation is skipped if the provided session state already has a preview.

    Wether the import is triggered depends on the specified `import_threshold`, or
    the beets-config setting `match.strong_rec_thresh`.
    The match quality is calculated via penalties, thus it ranges from 0 to 1, but a
    perfect match is at 0. The same convention is used for thresholds.

    The default threshold is 0.04, so that a "96% match or better" will be imported.
    """

    import_threshold: float

    def __init__(
        self,
        state,
        config_overlay: dict | None = None,
        import_threshold: float | None = None,
        **kwargs,
    ):
        """Create new AutoImportSession.

        Parameters
        ----------
        state: SessionState
            Preconfigured state of the import session.
        config_overlay : optional, dict
            Configuration to overlay on top of the default config.
        import_threshold: optional, float
            0 to import only perfect matches, 1 to import everything. Default is 0.04.
        **kwargs
            See `ImportSession`.
        """

        super().__init__(state, config_overlay, **kwargs)

        if import_threshold is None:
            self.get_config_value("match.strong_rec_thresh", float)
        else:
            self.import_threshold = import_threshold

    @property
    def stages(self):
        stages = super().stages
        stages.insert(after="user_query", stage=match_threshold(self))
        return stages

    def match_threshold(self, task: importer.ImportTask) -> bool:
        """Check if the match quality is good enough to import.

        Returns true if the match quality is better than threshlold.

        Note: that the return is just FYI. What stops the pipeline is that
        we set task.choice to importer.action.SKIP.
        """
        try:
            task_state = self.state.get_task_state_for_task(task)
            distance = float(task_state.best_candidate_state.distance)  # type: ignore
        except (AttributeError, TypeError):
            distance = 2.0

        if distance <= self.import_threshold:
            # beets upstream ways to handle this.
            task.set_choice(importer.action.SKIP)
            return False

        return True


@deprecated
class InteractiveImportSession(ImportSession):
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

        # FIXME: set_config_defaults()
        super().__init__(state, config_overlay)
        self.communicator = communicator

    def set_task_progress(
        self, task: importer.ImportTask, progress: ProgressState | Progress | str
    ):
        """In addition to the default, emit the current state via connector."""
        super().set_task_progress(task, progress)  # this mutates the state
        self.communicator.emit_status_sync(self.state.progress)

    # -------------------------------- Stages -------------------------------- #

    @property
    def stages(self):
        stages = super().stages
        stages.insert(offer_match(self), after="user_query")
        return stages

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
                        ProgressState(Progress.IMPORT_COMPLETED, "aborted"),
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

    async def run_async(self):
        await self.communicator.emit_current_async()
        state = await super().run_async()

        return state


class UndoSession(BaseSession):
    delete_files: bool

    def __init__(
        self,
        state: SessionState,
        config_overlay: dict | None = None,
        delete_files: bool = False,
        **kwargs,
    ):
        super().__init__(state, config_overlay, **kwargs)
        self.delete_files = delete_files

    async def run_async(self) -> SessionState:
        """Undo an import.

        A bit of a hack to reuse the BaseSession as we do
        not operate on tasks here but makes things easier in
        calling this in the invoker.

        Note: this Session should only be run in the (single-thread) import queue,
        because we want to limit beets-library and file interactions to be serial
        to avoid conflicts.
        """

        if self.state.progress != Progress.IMPORT_COMPLETED:
            log.error(
                f"Cannot undo import from state {self.state.progress}. "
                + "Only imports can be undone."
            )
            e = UserError(
                "Cannot undo if never imported! You need to import to undo first."
            )
            self.state.exc = to_serialized_exception(e)
            raise e

        for t_state in self.state.task_states:
            t_state.set_progress(Progress.DELETING)

        # Revert the movement of items that beets does during manipulate_files()
        # TODO: support Move operations (currently we only allow copy)

        # HACK: To allow an reimport after an undo, we need to use the old
        # paths of the items. This is a bit hacky, but We did not find
        # a better way to do this while maintaining the original beets logic.
        # -> the old_paths attribute of a beets_task is set during task.manipulate_files()
        # Unfortunately, here task.imported_items() does not work yet (.match not set)

        for t_state in self.state.task_states:
            chosen_candidate = t_state.chosen_candidate_state
            if chosen_candidate is None:
                raise ValueError("No chosen candidate found for task.")
            if t_state.task.old_paths is None:
                raise ValueError("No old paths found for task.")
            for idx, item in enumerate(chosen_candidate.match.mapping.keys()):  # type: ignore
                # yes, keys are the items and need to be updated!
                # mapping maps objects to objects.
                item.path = t_state.task.old_paths[idx]

        try:
            self.delete_from_beets()
        except Exception as e:
            self.state.exc = to_serialized_exception(e)
            raise e

        # Update our state and progress
        for t_state in self.state.task_states:
            t_state.set_progress(Progress.DELETION_COMPLETED)

        return self.state

    def delete_from_beets(
        self,
    ):
        """Low-level, delete the items from the beets library."""

        # We set a gui_import_id in the beets database this is equal to the session id
        # see _apply_choice in stages.py
        items = self.lib.items(f"gui_import_id:{self.state.id}")

        if len(items) == 0:
            raise ValueError("No items found that match this import session id.")

        with self.lib.transaction():
            for item in items:
                item.remove(self.delete_files)

    @property
    def stages(self):
        return StageOrder()
