from typing import Callable, List, NamedTuple

from beets.ui import _open_library, print_, colorize, UserError
from beets.util import displayable_path
from beets import autotag, config, plugins, importer, IncludeLazyConfig
from beets.ui.commands import (
    TerminalImportSession,
    choose_candidate,
    _summary_judgment,
    # PromptChoice,
    Counter,
    chain,
    manual_search,
    manual_id,
    abort_action,
    show_change,
    dist_string,
    summarize_items,
)

from beets.autotag import (
    AlbumMatch,
    TrackMatch,
    AlbumInfo,
    TrackInfo,
    Item,
    Recommendation,
    Proposal,
)


from beets_flask.logger import log
from beets_flask.websocket import sio
from beets_flask.config import config

from beets_flask.beets_sessions import BaseSession, set_config_defaults

namespace = "/import"


@sio.on("connect", namespace=namespace)  # type: ignore
def connect(sid, environ):
    """new client connected"""
    log.debug(f"ImportSocket new client connected {sid}")


@sio.on("disconnect", namespace=namespace)  # type: ignore
def disconnect(sid):
    """client disconnected"""
    log.debug(f"ImportSocket client disconnected {sid}")


@sio.on("*", namespace=namespace)  # type: ignore
def any_event(event, sid, data):
    log.debug(f"ImportSocket sid {sid} undhandled event {event} with data {data}")


session = None


@sio.on("start_import_session", namespace=namespace)  # type: ignore
def start_import_session(sid, data):
    """
    Start a new interactive import session. We shall only have one running at a time.
    TODO: what about the import worker? wait for completion? Block other imports while we are running?
    """
    album_folder = data["album_folder"]
    global session
    assert session is None
    session = InteractiveImportSession(album_folder)
    sio.start_background_task(session.event_loop)


@sio.on("choice", namespace=namespace)  # type: ignore
def choice(sid, data):
    """
    User has made a choice. Pass it to the session.
    """
    global session
    if not session is None:
        session.choice = data["choice"]


class PromptChoice(NamedTuple):
    short: str
    long: str
    callback: (
        None | Callable[[BaseSession, importer.ImportTask], importer.action | None]
    )


class InteractiveImportSession(BaseSession):

    # user choices arrive async via websocket. we use this variable to pass them into the sessions event loop.
    choice: str | None = None

    def __init__(self, path: str, config_overlay: str | dict | None = None):
        set_config_defaults()
        super(InteractiveImportSession, self).__init__(path, config_overlay)

    def choose_match(self, task: importer.ImportTask):
        """Given an initial autotagging of items, go through an interactive
        dance with the user to ask for a choice of metadata. Returns an
        AlbumMatch object, ASIS, or SKIP.
        """
        # Show what we're tagging.
        self.emit_text("Tagging...")

        path_str0 = displayable_path(task.paths, "\n")
        path_str = colorize("import_path", path_str0)
        items_str0 = "({} items)".format(len(task.items))
        items_str = colorize("import_path_items", items_str0)
        self.emit_text(" ".join([path_str, items_str]))

        # Let plugins display info or prompt the user before we go through the
        # process of selecting candidate.
        results = plugins.send("import_task_before_choice", session=self, task=task)
        actions = [action for action in results if action]

        if len(actions) == 1:
            return actions[0]
        elif len(actions) > 1:
            raise plugins.PluginConflictException(
                "Only one handler for `import_task_before_choice` may return "
                "an action."
            )

        # Skip summary judgement. We always want interaction.
        # action = _summary_judgment(task.rec)

        # Loop until we have a choice.
        while True:
            # Ask for a choice from the user. The result of
            # `choose_candidate` may be an `importer.action`, an
            # `AlbumMatch` object for a specific selection, or a
            # `PromptChoice`.
            choices = self.get_choices(task)
            choice = self.choose_candidate(
                candidates = task.candidates,
                singleton = False,
                rec = task.rec,
                cur_artist = task.cur_artist,
                cur_album = task.cur_album,
                itemcount=len(task.items),
                choices=choices,
            )

            # Basic choices that require no more action here.
            if choice in (importer.action.SKIP, importer.action.ASIS):
                # Pass selection to main control flow.
                return choice

            # Plugin-provided choices. We invoke the associated callback
            # function.
            elif choice in choices:
                post_choice = choice.callback(self, task)
                if isinstance(post_choice, importer.action):
                    return post_choice
                elif isinstance(post_choice, autotag.Proposal):
                    # Use the new candidates and continue around the loop.
                    task.candidates = post_choice.candidates
                    task.rec = post_choice.recommendation

            # Otherwise, we have a specific match selection.
            else:
                # We have a candidate! Finish tagging. Here, choice is an
                # AlbumMatch object.
                assert isinstance(choice, autotag.AlbumMatch)
                return choice

    def get_choices(self, task):
        """
        Get the list of prompt choices that should be presented to the
        user. This consists of both built-in choices and ones provided by
        plugins.

        The `before_choose_candidate` event is sent to the plugins, with
        session and task as its parameters. Plugins are responsible for
        checking the right conditions and returning a list of `PromptChoice`s,
        which is flattened and checked for conflicts.

        If two or more choices have the same short letter, a warning is
        emitted and all but one choices are discarded, giving preference
        to the default importer choices.

        Returns a list of `PromptChoice`s.
        """
        # Standard, built-in choices.
        choices = [
            PromptChoice("s", "Skip", lambda s, t: importer.action.SKIP),
            PromptChoice("u", "Use as-is", lambda s, t: importer.action.ASIS),
        ]
        if task.is_album:
            choices += [
                PromptChoice("t", "as Tracks", lambda s, t: importer.action.TRACKS),
                PromptChoice("g", "Group albums", lambda s, t: importer.action.ALBUMS),
            ]
        choices += [
            # PromptChoice("e", "Enter search", manual_search),
            # PromptChoice("i", "enter Id", manual_id),
            PromptChoice("b", "aBort", abort_action),
        ]

        # Send the before_choose_candidate event and flatten list.
        extra_choices = list(
            chain(*plugins.send("before_choose_candidate", session=self, task=task))
        )

        # Add a "dummy" choice for the other baked-in option, for
        # duplicate checking.
        all_choices = (
            [
                PromptChoice("a", "Apply", None),
            ]
            + choices
            + extra_choices
        )

        # Check for conflicts.
        short_letters = [c.short for c in all_choices]
        if len(short_letters) != len(set(short_letters)):
            # Duplicate short letter has been found.
            duplicates = [i for i, count in Counter(short_letters).items() if count > 1]
            for short in duplicates:
                # Keep the first of the choices, removing the rest.
                dup_choices = [c for c in all_choices if c.short == short]
                for c in dup_choices[1:]:
                    log.warning(
                        f"Prompt choice '{c.long}' removed due to conflict "
                        f"with '{dup_choices[0].long}' (short letter: '{c.short}')"
                    )
                    extra_choices.remove(c)

        return choices + extra_choices

    def choose_candidate(
        self,
        candidates: List[autotag.AlbumMatch | autotag.TrackMatch],
        singleton: bool,
        rec: autotag.Recommendation | None,
        cur_artist: str | None = None,
        cur_album: str | None = None,
        item: autotag.Item | None = None,
        itemcount: int | None = None,
        choices: List[PromptChoice] = [],
    ):
        """
        Given a sorted list of candidates, ask the user for a selection
        of which candidate to use. Applies to both full albums and
        singletons  (tracks). Candidates are either AlbumMatch or TrackMatch
        objects depending on `singleton`. for albums, `cur_artist`,
        `cur_album`, and `itemcount` must be provided. For singletons,
        `item` must be provided.

        `choices` is a list of `PromptChoice`s to be used in each prompt.

        Returns one of the following:
        * the result of the choice, which may be SKIP or ASIS
        * a candidate (an AlbumMatch/TrackMatch object)
        * a chosen `PromptChoice` from `choices`
        """
        # Sanity check.
        if singleton:
            assert item is not None
        else:
            assert cur_artist is not None
            assert cur_album is not None



    def emit_text(self, text: str, choices: List[PromptChoice] = []):
        sio.emit("text", {"text": text}, namespace=namespace)


    def event_loop(self):
        """
        Main event loop for the interactive import session.
        """
        global session
        while True:
            if not session is self:
                log.error("Session mismatch")
                return
