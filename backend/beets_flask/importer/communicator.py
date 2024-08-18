from __future__ import annotations
from typing import Any, Generic, List, Literal, TypeVar, TypedDict, Union
from abc import ABC, abstractmethod

from beets_flask.logger import log

from .states import ImportState, SelectionState, CandidateState


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
        self, state: Union[ImportState, SelectionState, CandidateState, None]
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
            )
        )

    def emit_custom(self, event: str, data: Any):
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
        self._emit(EmitRequest(event=event, data=data))

    def received_request(self, req: Union[ChoiceReceive, CompleteReceive]):
        """
        Processes incoming requests related to the import session.

        If an unknown event type is received, it logs an error and returns without further action.

        """
        log.debug(f"received_request {req=}")
        match req["event"]:
            case "candidate_choice":
                selection_id = req["selection_id"]
                candidate_idx = req["candidate_idx"]

                selection_state = self.state.get_selection_state_by_id(selection_id)
                if selection_state is None:
                    raise ValueError("No selection state found for task.")
                selection_state.current_candidate_idx = candidate_idx
                log.debug("selection_state.current_candidate_idx = %s", candidate_idx)
            case "selection_complete":

                # Validate the request
                selection_ids = req["selection_ids"]
                are_completed = req["are_completed"]
                assert len(selection_ids) == len(
                    are_completed
                ), "Selections and completion status must have the same length"

                # Update the state
                for id, completed in zip(selection_ids, are_completed):
                    selection_state = self.state.get_selection_state_by_id(id)
                    if selection_state is None:
                        raise ValueError("No selection state found for task.")
                    selection_state.completed = completed
            case _:
                log.error(f"Unknown event: {req['event']}")
                return

        # Emit to all (potential) clients
        self._emit(req)

    @abstractmethod
    def _emit(self, req: Union[ChoiceReceive, CompleteReceive, EmitRequest]) -> None:
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
    candidate_idx: int


class CompleteReceive(TypedDict):
    event: Literal["selection_complete"]
    selection_ids: List[str]
    are_completed: List[bool]


T = TypeVar("T")


# class EmitRequest[T](TypedDict): # py 3.12
class EmitRequest(TypedDict, Generic[T]):  # py 3.9
    event: str
    data: T
