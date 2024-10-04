from __future__ import annotations
import time
from typing import Any, Generic, List, Literal, TypeVar, TypedDict, Union
from abc import ABC, abstractmethod

from beets_flask.logger import log

from .states import ImportState, SelectionState, CandidateState, ImportStatus


def default_events(state: Union[ImportState, SelectionState, CandidateState]):
    """
    assign the default emit events for commonly used states
    """
    event = None
    if isinstance(state, ImportState):
        event = "import_state"
    elif isinstance(state, SelectionState):
        event = "selection_state"
    elif isinstance(state, CandidateState):
        event = "candidate_state"
    else:
        raise ValueError(f"Unknown status type: {state}")
    return event


class ImportCommunicator(ABC):

    # Ref to the current import state
    state: ImportState

    def __init__(self, state: ImportState):
        self.state = state
        self.emit_current()

    def emit_current(self):
        """
        Emits the current top-level state associated with the import session.
        """
        self.emit_state(self.state)

    def emit_state(
        self, state: Union[ImportState, SelectionState, CandidateState, None], **kwargs
    ) -> None:
        """
        Emits a (sub-) state of an import session.
        This can be a full import state, a selection state, or a candidate state.
        """

        if state is None:
            return

        self._emit(
            EmitRequest(
                event=default_events(state),
                data=state.serialize(),
            ),
            **kwargs,
        )

    def emit_status(self, status: ImportStatus, **kwargs):
        """Emits a status message."""

        self._emit(
            EmitRequest(event="status", data=status.as_dict()),
            **kwargs,
        )

    def emit_custom(self, event: str, data: Any, **kwargs):
        """
        Emits a custom event. For the WebsocketCommunicator, this is equivalent to
        `sio.emit(event, {"event" : event, "data": data}, namespace='xyz')`
        using the communicator's namespace.

        Example
        -------
        ```
        status = "initializing"
        communicator.emit_custom("import_state_status", status)
        # will send {"event": "import_state_status", "data": "initializing"}
        # consistent with the default emit format for StateUpdates
        ```

        """
        self._emit(EmitRequest(event=event, data=data), **kwargs)

    def received_request(
        self, req: Union[ChoiceReceive, CompleteReceive, CandidateSearchReceive]
    ):
        """
        Processes incoming requests related to the import session.

        If an unknown event type is received, it logs an error and returns without further action.

        """
        log.debug(f"received_request {req=}")
        ret_val = {}
        match req["event"]:
            case "candidate_choice":
                selection_id = req["selection_id"]
                candidate_id = req["candidate_id"]
                duplicate_action = req["duplicate_action"]

                sel_state = self.state.get_selection_state_by_id(selection_id)
                if sel_state is None:
                    raise ValueError("No selection state found for task.")
                sel_state.current_candidate_id = candidate_id
                sel_state.duplicate_action = duplicate_action

            case "selection_complete":
                # Validate the request
                selection_ids = req["selection_ids"]
                are_completed = req["are_completed"]
                assert len(selection_ids) == len(
                    are_completed
                ), "Selections and completion status must have the same length"

                # Update the state
                for id, completed in zip(selection_ids, are_completed):
                    sel_state = self.state.get_selection_state_by_id(id)
                    if sel_state is None:
                        raise ValueError("No selection state found for task.")
                    sel_state.completed = completed

            case "candidate_search":
                selection_id = req["selection_id"]
                search_id = req["search_id"]
                artist = req["artist"]
                album = req["album"]

                assert (
                    search_id is not None or artist is not None
                ), "Either Search ID or Artist + Album need to be given"
                sel_state = self.state.get_selection_state_by_id(selection_id)
                if sel_state is None:
                    raise ValueError("No selection state found for task.")
                n_candidates_pre_search = len(sel_state.candidates)

                # This triggers the search and updates the state
                sel_state.current_search_id = search_id
                sel_state.current_search_artist = artist
                sel_state.current_search_album = album

                # State gets set to None when the search is done
                # Would be nice to await here... well
                while (
                    sel_state.current_search_id is not None
                    or sel_state.current_search_artist is not None
                    or sel_state.current_search_album is not None
                ):
                    time.sleep(1)

                n_candidates_post_search = len(sel_state.candidates)
                if n_candidates_pre_search != n_candidates_post_search:
                    ret_val["event"] = "candidate_search"
                    ret_val["data"] = {
                        "success": True,
                        "selection_id": sel_state.id,
                        "message": f"Found {n_candidates_post_search - n_candidates_pre_search} new candidates",
                        "state": sel_state.serialize(),
                    }
                else:
                    ret_val["event"] = "candidate_search"
                    ret_val["data"] = {
                        "success": False,
                        "selection_id": sel_state.id,
                        "message": "No new candidates found",
                    }

            case _:
                log.error(f"Unknown event: {req['event']}")
                return

        # Emit to all (potential) clients
        self._emit(req=req)
        return ret_val

    @abstractmethod
    def _emit(
        self,
        req: Union[ChoiceReceive, CompleteReceive, CandidateSearchReceive, EmitRequest],
        **kwargs,
    ) -> None:
        """
        Emits the current state of the import session.
        """
        raise NotImplementedError("Implement in subclass")


# ------------------------------------------------------------------------------------ #
#                                 Communicator requests                                #
# ------------------------------------------------------------------------------------ #


class ChoiceReceive(TypedDict):
    event: Literal["candidate_choice"]
    selection_id: str
    candidate_id: str
    duplicate_action: Literal["skip", "keep", "remove", "merge", None]


class CompleteReceive(TypedDict):
    event: Literal["selection_complete"]
    selection_ids: List[str]
    are_completed: List[bool]


class CandidateSearchReceive(TypedDict):
    event: Literal["candidate_search"]
    selection_id: str
    search_id: str | None
    artist: str | None
    album: str | None


T = TypeVar("T")


# class EmitRequest[T](TypedDict): # py 3.12
class EmitRequest(TypedDict, Generic[T]):  # py 3.9
    event: str
    data: T
