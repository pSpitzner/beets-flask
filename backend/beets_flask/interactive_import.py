from copy import deepcopy
from dataclasses import dataclass, asdict
import time
from typing import Callable, List, NamedTuple, Union, Any
from types import GeneratorType
from uuid import uuid4 as uuid

from beets import ui, autotag, config, plugins, importer, IncludeLazyConfig
from beets.ui import _open_library, print_, colorize, UserError
from beets.util import displayable_path
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
    # AlbumMatch,
    # TrackMatch,
    AlbumInfo,
    TrackInfo,
    Item,
    Recommendation,
    Proposal,
    Distance,
)

import eventlet

from beets.util.pipeline import Pipeline
from beets.importer import ImportAbort


from beets_flask.logger import log
from beets_flask.websocket import sio
from beets_flask.config import config

from beets_flask.beets_sessions import BaseSession, set_config_defaults

log.debug("ImportSocket module loaded")

namespace = "/import"


def register_import_socket():
    # we need this to at least allow loading the module at the right time
    pass


@sio.on("connect", namespace=namespace)  # type: ignore
def connect(sid, environ):
    """new client connected"""
    log.debug(f"ImportSocket new client connected {sid}")
    start_import_session(
        sid, {"album_folder": "/music/inbox.nosync/1992/Chant [SINGLE]"}
    )
    # we cannot block here, or the client will not finish connecting.
    # if session is not None:
    # session.reemit_last()


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
    # if session is None:
    session = InteractiveImportSession(album_folder)
    sio.start_background_task(session.run)


@sio.on("choice", namespace=namespace)  # type: ignore
def choice(sid, data):
    """
    User has made a choice. Pass it to the session.
    """
    log.debug(f"recevied user choice {data}")
    global session
    if not session is None:
        session.user_prompt_choice = data.get("prompt_choice", None)
        session.user_candidate_choice = data.get("candidate_choice", None)


@sio.on("receipt", namespace=namespace)  # type: ignore
def receipt(sid, data):
    """
    We re-emit until we receive confirmation.
    """
    message_id = data.get("id", None)
    if (
        session is not None
        and message_id is not None
        and message_id not in session.confirmed_history
    ):
        session.confirmed_history.append(message_id)


# type beets classes
@dataclass
class AlbumMatch(NamedTuple):
    distance: Distance
    info: AlbumInfo
    extra_items: list[Item]
    extra_tracks: list[TrackInfo]
    mapping: dict[Item, TrackInfo] | None = None


@dataclass
class TrackMatch(NamedTuple):
    distance: Distance
    info: TrackInfo


@dataclass
class PromptChoice:
    short: str
    long: str
    callback: (
        None | Callable[[BaseSession, importer.ImportTask], importer.action | None]
    )

    def serialize(self):
        return {
            "short": self.short,
            "long": self.long,
            "callback": self.callback.__name__ if self.callback else "None",
        }


@dataclass
class CandidateChoice:
    id: int
    match: Union[AlbumMatch, TrackMatch]
    type: str = "unset"

    def __post_init__(self):
        self.type = "album" if hasattr(self.match, "extra_tracks") else "track"

    def serialize(self):
        # currently we try to send everything we have and patch whats needed.
        # TODO: only send what frontend needs.

        self.match.info.decode()
        # beets' AlbumInfo & TrackInfo is a custom implementation of AttributeDict,
        # which has some generators breaking serialization (which i cannot find)
        # I found no way to get around them, except recreating the dict.
        info = _enforce_dict(self.match.info)
        # we need to add the `name` field, because in frontend, we reuse the typings
        # from the library, where we added a `name` field to artist, albums and items.
        info["name"] = self.match.info.album

        info["tracks"] = []
        for track in self.match.info.tracks or []:
            track.decode()
            t = _enforce_dict(track)
            t["name"] = track.title
            info["tracks"].append(t)

        match = dict()
        match["info"] = info
        match["distance"] = self.match.distance.distance

        if self.type == "album":
            match["extra_items"] = []  # self.match.extra_items
            match["extra_tracks"] = []  # self.match.extra_tracks

            for item in self.match.extra_items or []:  # type: ignore
                match["extra_items"].append(item.__repr__())

            for track in self.match.extra_tracks or []:  # type: ignore
                track.decode()
                t = _enforce_dict(track)
                t["name"] = track.title
                match["extra_tracks"].append(t)

        res = dict()
        res["id"] = self.id
        res["type"] = self.type
        res["match"] = match

        return res


def _enforce_dict(d):
    return {k: v for k, v in d.items()}


@dataclass
class ConfirmableMessage:
    event: str
    id: str
    data: Any


class InteractiveImportSession(BaseSession):

    # attributes to receive user input
    user_prompt_choice: str | None = (
        None  # 1-char string, representing prompt short choice
    )
    user_candidate_choice: int | None = None  # index of candidate choice
    user_text_input: str | None = None  # if we have a text input, store it here

    # current session state
    task: importer.ImportTask | None = None
    prompt_choices: List[PromptChoice] = []
    candidate_choices: List[CandidateChoice] = []
    pipeline: Pipeline | None = None
    emit_history: List[ConfirmableMessage] = []
    confirmed_history: List[str] = []

    def __init__(self, path: str, config_overlay: str | dict | None = None):
        set_config_defaults()
        super(InteractiveImportSession, self).__init__(path, config_overlay)

    def choose_match(self, task: importer.ImportTask):
        """
        Given an initial autotagging of items, go through an interactive
        dance with the user to ask for a choice of metadata. Returns an
        AlbumMatch object, ASIS, or SKIP.
        """
        # Show what we're tagging.
        self.emit_text("Choose match...")

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
            log.debug("Choosing candidate")

            self.prompt_choices = self._get_choices(task)
            choice = self._choose_candidate(task)

            log.debug("Choosing candidate done")

            # Basic choices that require no more action here.
            if choice in (importer.action.SKIP, importer.action.ASIS):
                # Pass selection to main control flow.
                return choice

            elif isinstance(choice, autotag.AlbumMatch):
                return choice

            # Plugin-provided choices. We invoke the associated callback
            # function.
            assert choice in self.prompt_choices

            post_choice = choice.callback(self, task)  # type: ignore
            if isinstance(post_choice, importer.action):
                return post_choice
            elif isinstance(post_choice, autotag.Proposal):
                # Use the new candidates and continue around the loop.
                task.candidates = post_choice.candidates
                task.rec = post_choice.recommendation

    def _choose_candidate(
        self,
        task: importer.ImportTask,
    ) -> importer.action | AlbumMatch | PromptChoice:
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

        #     candidates=task.candidates,
        #     singleton=False,
        #     rec=task.rec,
        #     cur_artist=task.cur_artist,
        #     cur_album=task.cur_album,
        #     itemcount=len(task.items),
        #     choices=choices,

        choice_actions = {c.short: c for c in self.prompt_choices}

        if not task.candidates or len(task.candidates) == 0:
            msg = f"No matching release found for {len(task.items)} tracks."
            self.logger.debug(msg)
            self.emit_text(msg)

            self.emit_prompt_choices()
            sel = None
            while sel is None:
                time.sleep(0.5)
                sel = self.user_prompt_choice
            if sel in choice_actions:
                return choice_actions[sel]
            else:
                raise ValueError("Invalid user choice. This should not happen.")

        match: AlbumMatch = task.candidates[0]

        while True:

            log.debug("candidates loop")

            self.emit_prompt_choices()
            self.emit_candidate_choices(task.candidates)

            # not sure yet how we do this here.
            # rework: always require a num choice and a proceed_with_num_choice prompt_choice
            sel = None
            num = None
            while sel is None:
                time.sleep(0.5)
                sel = self.user_prompt_choice
                num = self.user_candidate_choice
                # we can only proceed after selecting a candidate
                if sel == "a" and num is None:
                    sel = None

            assert num is not None
            match: AlbumMatch = task.candidates[num]

            # 1. show change
            self.emit_text("Change...")
            # 2. confirmation change-display, new choices

            sel = None
            while sel is None:
                sel = self.user_prompt_choice

            if sel == "a":
                return match  # type: ignore
            elif sel in choice_actions:
                return choice_actions[sel]

    def _get_choices(self, task):
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
                # PromptChoice("t", "as Tracks", lambda s, t: importer.action.TRACKS),
                # PromptChoice("g", "Group albums", lambda s, t: importer.action.ALBUMS),
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

        log.debug(f"choices {[c.long for c in choices + extra_choices]}")

        # manually cast, as beets does not give us PrompChoice instances, but namedutples
        return [
            PromptChoice(c.short, c.long, c.callback) for c in
            choices + extra_choices
        ]

    def emit(self, event: str, data: Any):

        msg = ConfirmableMessage(event, str(uuid()), data)
        self.emit_history.append(msg)
        while msg.id not in self.confirmed_history:
            if client_connected():
                # log.debug(f"emitting {msg.event} {msg.data}")
                sio.emit(msg.event, asdict(msg), namespace=namespace)
            time.sleep(1)

    def reemit_last(self):

        if len(self.emit_history) == 0:
            return

        if len(self.confirmed_history) == len(self.emit_history):
            self.confirmed_history.pop()

        msg = self.emit_history[-1]
        while msg.id not in self.confirmed_history:
            if client_connected():
                # log.debug(f"re-emitting {msg.event} {msg.data}")
                sio.emit(msg.event, asdict(msg), namespace=namespace)
            time.sleep(1)

    def emit_candidate_choices(self, candidates: List[AlbumMatch | TrackMatch]):
        """
        Emit the list of candidates to the user.

        # Parameters:
        candidates: list of (distance, TrackInfo) pairs.
        """
        self.candidate_choices = [
            CandidateChoice(i, c) for i, c in enumerate(candidates)
        ]
        log.debug(
            f"emitting candidates {[c.match.info.album for c in self.candidate_choices]}"
        )
        self.emit(
            "candidates",
            [c.serialize() for c in self.candidate_choices],
        )

    def emit_text(self, text: str):
        log.debug(f"emitting text {text}")
        self.emit("text", text)

    def emit_prompt_choices(self, choices: List[PromptChoice] | None = None):
        if choices is not None:
            self.prompt_choices = choices
        log.debug(f"emitting prompt choices {[c.long for c in self.prompt_choices]}")
        self.emit(
            "prompt",
            [c.serialize() for c in self.prompt_choices],
        )

    def run(self):
        """Run the import task. Customized version of ImportSession.run"""
        self.logger.info(f"import started {time.asctime()}")
        self.set_config(config["import"])

        stages = [importer.read_tasks(self)]

        if self.config["group_albums"] and not self.config["singletons"]:
            stages += [importer.group_albums(self)]

        if self.config["autotag"]:
            stages += [importer.lookup_candidates(self), importer.user_query(self)]  # type: ignore
        else:
            stages += [importer.import_asis(self)]  # type: ignore

        # Plugin stages.
        for stage_func in plugins.early_import_stages():
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore
        for stage_func in plugins.import_stages():
            stages.append(importer.plugin_stage(self, stage_func))  # type: ignore

        stages += [importer.manipulate_files(self)]  # type: ignore

        self.pipeline = Pipeline(stages)

        # Run the pipeline.
        plugins.send("import_begin", session=self)
        try:
            self.pipeline.run_sequential()
        except ImportAbort:
            self.logger.debug(f"Interactive import session aborted by user")


def client_connected():
    rooms = sio.manager.rooms.get(namespace)
    return rooms is not None and len(rooms) > 0
