from __future__ import annotations
from typing import Union
from abc import ABC, abstractmethod

from beets_flask.logger import log

from .types import (
    ImportStateUpdate,
    StateUpdate,
    SelectionStateUpdate,
    CandidateStateUpdate,
    ChoiceRequest,
    CompleteRequest,
)

from .states import ImportState, SelectionState, CandidateState


class ImportCommunicator(ABC):

    # Ref to the current import state
    state: ImportState

    def __init__(self, state: ImportState):
        self.state = state
        self._emit(
            ImportStateUpdate(
                event="import_state",
                selection_states=[
                    selection_state.serialize()
                    for selection_state in state.selection_states
                ],
            )
        )

    def emit_state(
        self, state: Union[ImportState, SelectionState, CandidateState, None]
    ) -> None:
        """
        Emits the current state of the import session. This can be a full import state, a selection state, or a candidate state.
        """

        if state is None:
            return

        elif isinstance(state, ImportState):
            self._emit(
                ImportStateUpdate(
                    event="import_state",
                    selection_states=[
                        selection_state.serialize()
                        for selection_state in state.selection_states
                    ],
                )
            )
        elif isinstance(state, SelectionState):
            self._emit(
                SelectionStateUpdate(
                    event="selection_state", selection_state=state.serialize()
                )
            )
        elif isinstance(state, CandidateState):
            self._emit(
                CandidateStateUpdate(
                    event="candidate_state", candidate_state=state.serialize()
                )
            )
        else:
            raise ValueError(f"Unknown status type: {state}")

    def emit_all(self):
        """
        Emits the current state of the import session.
        """
        self._emit(
            ImportStateUpdate(
                event="import_state",
                selection_states=[
                    selection_state.serialize()
                    for selection_state in self.state.selection_states
                ],
            )
        )

    def received_request(self, req: Union[ChoiceRequest, CompleteRequest]):
        """
        Processes incoming requests related to the import session.

        If an unknown event type is received, it logs an error and returns without further action.

        """
        log.debug(f"received_request {req=}")
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
    def _emit(self, req: Union[ChoiceRequest, CompleteRequest, StateUpdate]) -> None:
        """
        Emits the current state of the import session.
        """
        pass
