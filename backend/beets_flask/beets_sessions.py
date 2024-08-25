import os
import logging
import sys
import io

from pprint import pprint
from copy import copy
from collections import namedtuple

from beets_flask.disk import is_album_folder

from . import utility as ut
from .logger import log

from beets import plugins, importer, IncludeLazyConfig
from beets.ui import _open_library, print_, colorize, UserError
from beets.ui.commands import show_change, dist_string, summarize_items
from beets.util import displayable_path
from beets.autotag import Recommendation, AlbumMatch, TrackMatch, Distance

from beets_flask.config import config


# config overwrites that are required for generating the right previews
def set_config_defaults():
    config.reset()
    config["import"]["detail"] = True
    config["import"]["resume"] = False
    config["import"]["incremental"] = False
    config["ui"]["terminal_width"] = 150
    config["ui"]["color"] = True
    # config parsing of plugins is done by the plugins, force re-init without cache.
    plugins._instances = {}
    plugins.load_plugins(config["plugins"].as_str_seq())
    # loaded_plugins = ", ".join([p.name for p in plugins.find_plugins()])
    # log.debug(f"resetting config to defaults. {loaded_plugins=}")


set_config_defaults()


class BaseSession(importer.ImportSession):
    """
    Base class for our GUI-based ImportSessions.
    Operates on single Albums / files.

    # Args
    paths: list[str] -- list of album folders to import
    config_overlay: str or dict -- path to a config file to overlay on top of the default config.
        Note that if `dict`, the lazyconfig notation e.g. `{import.default_action: skip}` wont work reliably. Better nest the dicts: `{import: {default_action: skip}}`
    """

    # some attributes we need to create a beetsTag instance for our database
    status: str = "ok"
    match_url: str | None
    match_album: str | None
    match_artist: str | None
    match_dist: float | None
    match_num_tracks: int = 0
    candidate_urls: list[str]
    candidate_dists: list[float]
    preview: str | None
    path: str

    def __init__(self, path: str, config_overlay: str | dict | None = None):
        if isinstance(config_overlay, str):
            config.set_file(config_overlay)
        elif isinstance(config_overlay, dict):
            config.set_args(config_overlay)
        # super.run() sets self.config to dict(config['import'])

        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter(f"%(levelname)s: {self.__class__.__name__}: %(message)s")
        )
        handler.setLevel("DEBUG")

        if not os.path.exists(path):
            raise FileNotFoundError(f"Path {path} does not exist.")
        if os.path.isdir(path) and not is_album_folder(path):
            raise ValueError(f"Path {path} is not an album folder.")
        self.path = path

        super().__init__(
            lib=_open_library(config),
            loghandler=handler,
            paths=[path],
            query=None,
        )

    def resolve_duplicate(self, task: importer.ImportTask, found_duplicates):
        """
        This session should not reach this stage.
        """
        self.logger.debug(f"skipping resolve_duplicates {task}")
        task.set_choice(importer.action.SKIP)

    def choose_item(self, task: importer.ImportTask):
        """
        This session should not reach this stage.
        """
        self.logger.debug(f"skipping choose_item {task}")
        return importer.action.SKIP

    def should_resume(self, path):
        """
        This session should not reach this stage.
        """
        self.logger.debug(f"skipping should_resume {path}")
        return False

    @property
    def track_paths_before_import(self, from_disk=False) -> list[str]:
        """
        Returns the paths to all media files that would be imported.
        Relies on `self.path` pointing to an album or single track.
        """
        # im not sure if beets rescans the directory on task creation / run.
        if os.path.isfile(self.path):
            return [self.path]

        paths = []
        items = []
        for p, i in importer.albums_in_dir(self.path):
            paths.append(p)
            items.extend(i)
        return [i.decode("utf-8") for i in items]

    def run_and_capture_output(self) -> tuple[str, str]:
        """
        Run the import session and capture the output.
        Sets self.preivew to output and error messages occuring during run.

        Returns:
            tuple[str, str]: out, err
        """
        self.logger.debug(f"{self.paths}")
        out, err, _ = ut.capture_stdout_stderr(self.run)
        self.preview = out + "\n\n" + err if err else out
        return out, err


class PreviewSession(BaseSession):
    """
    Mocks an Import to gather the info displayed to the user - close to what the CLI would display.
    Only fetches matches and potential library duplicates, if we were to import this.

    We hijack choose_match() to capture the output.

    # Args
    paths: list[str] -- list of album folders to import
    config_overlay: str -- path to a config file to overlay on top of the default config

    # Example
    ```python
    session = PreviewImportSession([path_to_test_album])
    out, err = session.run_and_capture_output()
    print(out)
    print(err)
    ```
    """

    def __init__(self, path: str, config_overlay: str | dict | None = None):
        set_config_defaults()
        super(PreviewSession, self).__init__(path, config_overlay)

    def choose_match(self, task: importer.ImportTask):
        """
        Called after inital tagging candidates were found. We only use this to
        generate the preview, and return importer.action.SKIP to skip further stages.
        """
        self.logger.debug(f"choose_match {task}")

        # this just mimics the output that TerminalImportSession generates
        path_str0 = displayable_path(task.paths, "\n")
        path_str = colorize("import_path", path_str0)
        items_str0 = "({} items)".format(len(task.items))
        items_str = colorize("import_path_items", items_str0)
        print_(" ".join([path_str, items_str]))
        try:
            match: AlbumMatch | TrackMatch = task.candidates[0]
            show_change(task.cur_artist, task.cur_album, match)
        except IndexError:
            print_("No matches found.")
            self.status = "failed"
            return importer.action.SKIP

        # Let plugins display info. should check if this might block
        results = plugins.send("import_task_before_choice", session=self, task=task)

        self.match_url = getattr(match.info, "data_url", None)
        self.match_dist = float(match.distance)
        self.match_num_tracks = (
            len(match.info.tracks) if hasattr(match.info, "tracks") else 0
        )
        self.match_artist = getattr(match.info, "artist", None)
        self.match_album = getattr(match.info, "album", None)

        self.candidate_urls = []
        self.candidate_dists = []
        num_candidates = len(task.candidates)
        for cdx in range(num_candidates):
            try:
                c = task.candidates[cdx]
                self.candidate_urls.append(c.info.data_url)
                self.candidate_dists.append(float(c.distance))
            except:
                # we rather keep no candidates than an invalid one, for when this becomes ui-selectable.
                self.candidate_urls = []
                self.candidate_dists = []

        # because we skip every following stage, make a duplicate check here, so we can generate the info for the user.
        # task.choice_flag is needed for Assertion in find_duplicates.
        task.choice_flag = importer.action.ASIS
        duplicates = task.find_duplicates(self.lib)
        if duplicates:
            print_(
                f'\nThis {"album" if task.is_album else "item"} is already in the library!'
            )
            self.status = "duplicate"
        for duplicate in duplicates:
            old_dir = colorize("import_path", duplicate.item_dir().decode("utf-8"))
            print_(
                f"{old_dir}\n  "
                + summarize_items(
                    (list(duplicate.items()) if task.is_album else [duplicate]),
                    not task.is_album,
                )
            )

        return importer.action.SKIP


class MatchedImportSession(BaseSession):
    """
    Import session that assumes we already have a match-id.
    """

    duplicate_action: str
    import_task: importer.ImportTask | None = None

    def __init__(
        self,
        path: str,
        match_url: str,
        config_overlay: str | dict | None = None,
        tag_id: str | None = None,
    ):
        # make sure to start with clean slate
        set_config_defaults()
        config["import"]["search_ids"].set([match_url])

        if tag_id is not None:
            config["import"]["set_fields"]["gui_import_id"] = tag_id

        # this also merged config_overlay into the global config
        super(MatchedImportSession, self).__init__(path, config_overlay)

        # inconvenient: beets does not invoke a sessions resolve_duplicates() method if config["import"]["duplicate_action"] is set meaningfully (anything except 'ask'?).
        # Because we want to use this method, we cannot use the general lazyconfig overlay approach, and have to handle parsing duplicate actions ourselves. (and modify the global config)
        self.duplicate_action = str(config["import"]["duplicate_action"].as_str())
        config["import"]["duplicate_action"].set("ask")

    def choose_match(self, task: importer.ImportTask):
        self.logger.debug(f"choose_match {task}")

        # no idea how to keep track of the task otherwise.
        # we need it to get some info outside the session, like track_paths.
        # the pipeline stages take a task argument that i never find passed!
        self.import_task = task

        # this just mimics the output that TerminalImportSession generates
        path_str0 = displayable_path(task.paths, "\n")
        path_str = colorize("import_path", path_str0)
        items_str0 = "({} items)".format(len(task.items))
        items_str = colorize("import_path_items", items_str0)
        print_(" ".join([path_str, items_str]))
        try:
            match: AlbumMatch | TrackMatch = task.candidates[0]
            show_change(task.cur_artist, task.cur_album, match)
        except IndexError:
            print_("No matches found. Is the provided search URL correct?")
            self.status = "failed"
            return importer.action.SKIP

        # Let plugins display info
        results = plugins.send("import_task_before_choice", session=self, task=task)
        actions = [action for action in results if action]

        self.match_url = getattr(match.info, "data_url", None)
        self.match_dist = float(match.distance)
        self.match_num_tracks = (
            len(match.info.tracks) if hasattr(match.info, "tracks") else 0
        )
        self.match_artist = getattr(match.info, "artist", None)
        self.match_album = getattr(match.info, "album", None)

        self.candidate_urls = [self.match_url] if self.match_url else []
        self.candidate_dists = [self.match_dist] if self.match_dist else []

        if len(actions) > 0:
            # decide if we can just move past this and ignore the plugins
            raise UserError(
                f"Plugins returned actions, which is not supported for {self.__class__.__name__}"
            )

        return match

    def resolve_duplicate(self, task: importer.ImportTask, found_duplicates):
        """
        What do to with duplicates?
        We again recreate the output of a TerminalImportSession,
        but act according to the duplicate action specified in the
        config or config_overlay.
        """
        print_(
            f'\nThis {"album" if task.is_album else "item"} is already in the library!'
        )
        for duplicate in found_duplicates:
            old_dir = colorize("import_path", duplicate.item_dir().decode("utf-8"))
            print_(
                f"Old: {old_dir}\n     "
                + summarize_items(
                    (list(duplicate.items()) if task.is_album else [duplicate]),
                    not task.is_album,
                )
            )
            if self.config["duplicate_verbose_prompt"]:
                if task.is_album:
                    for dup in duplicate.items():
                        print(f"  {dup}")
                else:
                    print(f"  {duplicate}")

        print_(
            "New: "
            + summarize_items(
                task.imported_items(),
                not task.is_album,
            )
        )
        if self.config["duplicate_verbose_prompt"]:
            for item in task.imported_items():
                print(f"  {item}")

        match self.duplicate_action:
            case "skip":
                print_(
                    colorize(
                        "text_error",
                        "Dropping new items (configured `duplicate_action: skip`)",
                    )
                )
                self.status = "failed"
                task.set_choice(importer.action.SKIP)
            case "keep":
                print_(colorize("text_success", "Keeping both, old and new items"))
                pass
            case "remove":
                print_(colorize("text_success", "Removing old items"))
                task.should_remove_duplicates = True
            case "merge":
                print_(colorize("text_success", "Merging old and new items"))
                task.should_merge_duplicates = True
            case "ask":
                print_(
                    colorize(
                        "text_error",
                        "Configured `duplicate_action: ask` not supported: Dropping new items",
                    )
                )
                self.status = "failed"
                task.set_choice(importer.action.SKIP)
            case _:
                print_(
                    colorize(
                        "text_error",
                        f"Configured `duplicate_action: {self.config['duplicate_action']}` not supported: Dropping new items",
                    )
                )
                self.status = "failed"
                task.set_choice(importer.action.SKIP)

    @property
    def track_paths_after_import(self) -> list[str]:
        """
        Returns the paths of the tracks after a successful import.
        """
        try:
            return [
                item.path.decode("utf-8") for item in self.import_task.imported_items()  # type: ignore
            ]
        except:
            return []


def cli_command(beets_args: list[str], key: str = "s") -> tuple[str, str]:
    """
    Simulate a cli interaction.
    Runs `beets.ui._raw_main` while catching output.

    Args:
        beets_args: list[str]: arguments to pass to beets. Example
            ["import", "/music/inbox/album_folder", "-t", "--search-id='https://musicbrainz.org/release/...'"]
        key: str: the key to simulate pressing when the suer would be prompted by beets cli.

    Returns:
        out, err: tuple: stdout and stderr
    """

    import beets.ui

    log.debug(f"Running beets with args: {beets_args}")

    # grab output, we want to keep this around
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    buf_stdout = io.StringIO()
    buf_stderr = io.StringIO()
    sys.stdout = buf_stdout
    sys.stderr = buf_stderr
    # to be caputred, we also want severe beets log messages to appear in stderr
    log_handler = logging.StreamHandler(buf_stderr)
    log_handler.setLevel(logging.WARNING)
    log_handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    logging.getLogger("beets").addHandler(log_handler)

    err = ""
    try:
        # monkey patch so we simulate always pressing the requested key, e.g. 's' for skip
        beets.ui.input_options = lambda *args, **kwargs: key
        beets.ui._raw_main([*beets_args])
    except Exception as e:
        log.error(f"{type(e)}: {str(e)}")
        err += f"{type(e)}: {str(e)}"

    sys.stdout.flush()
    sys.stderr.flush()
    sys.stdout = original_stdout
    sys.stderr = original_stderr
    logging.getLogger("beets").removeHandler(log_handler)

    err += buf_stderr.getvalue()
    if err:
        log.debug(f"beets errors: {err}")

    out = buf_stdout.getvalue()
    log.debug(out)

    return out, err
