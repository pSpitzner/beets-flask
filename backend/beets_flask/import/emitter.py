from __future__ import annotations
from typing import TYPE_CHECKING, Union, Optional, TypedDict, Literal, List
from abc import ABC, abstractmethod

from beets_flask.logger import log

if TYPE_CHECKING:
    from .states import ImportState, SelectionState, CandidateState
    from socketio import Server


class ChoiceRequest(TypedDict):
    event: Literal["choice"]
    selection_id: str
    candidate_idx: int


class CompleteRequest(TypedDict):
    event: Literal["complete"]
    selection_ids: List[str]
    are_completed: List[bool]


class StatusUpdate(TypedDict):
    event: Literal["status"]
    status: str


class ImportCommunicator(ABC):

    # Ref to the current import state
    state: ImportState

    def __init__(self, state: ImportState):
        self.state = state
        self._emit(StatusUpdate(event="status", status="initialized"))

    def emit_status(
        self, status: Union[ImportState, SelectionState, CandidateState, None]
    ) -> None:
        if status is None:
            return

        # TODO
        self._emit("status", status.serialize())

    def recieved_request(self, req: Union[ChoiceRequest, CompleteRequest]):
        match req["event"]:
            case "choice":
                selection_id = req["selection_id"]
                candidate_idx = req["candidate_idx"]

                selection_state = self.state.get_selection_state_by_id(selection_id)
                if selection_state is None:
                    raise ValueError("No selection state found for task.")
                selection_state.current_candidate_idx = candidate_idx
            case "complete":

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
    def _emit(self, req: Union[ChoiceRequest, CompleteRequest, StatusUpdate]) -> None:
        """
        Emits the current state of the import session.
        """
        pass


class WebsocketEmitter(ImportCommunicator):
    sio: Server

    def __init__(self, state: ImportState, sio: Server):
        self.sio = sio
        super().__init__(state)

    def _emit(self, req) -> None:
        self.sio.emit(req["event"], req)
