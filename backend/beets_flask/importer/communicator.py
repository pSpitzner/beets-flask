from __future__ import annotations

import asyncio
import functools
import time
from abc import ABC, abstractmethod
from typing import (
    Any,
    Callable,
    Coroutine,
    Generic,
    List,
    Literal,
    TypedDict,
    TypeVar,
    Union,
    cast,
)

from socketio import AsyncServer

from beets_flask.logger import log

from .states import CandidateState, ImportStatusMessage, SessionState, TaskState


def default_events(state: Union[SessionState, TaskState, CandidateState]):
    """Assign the default emit events for commonly used states."""
    event = None
    if isinstance(state, SessionState):
        event = "import_state"
    elif isinstance(state, TaskState):
        event = "selection_state"
    elif isinstance(state, CandidateState):
        event = "candidate_state"
    else:
        raise ValueError(f"Unknown status type: {state}")
    return event


class ImportCommunicator(ABC):
    # Ref to the current import state
    state: SessionState

    def __init__(self, state: SessionState):
        self.state = state

    async def emit_current_async(self):
        """Emit the current top-level state associated with the import session."""
        await self.emit_state_async(self.state)

    def emit_current_sync(self):
        asyncio.run(self.emit_current_async())
        # return with_loop(asyncio.to_thread(self.emit_current_async))

    async def emit_state_async(
        self, state: Union[SessionState, TaskState, CandidateState, None], **kwargs
    ) -> None:
        """Emit a (sub-) state of an import session.

        This can be a full import state, a selection state, or a candidate state.
        """
        if state is None:
            log.debug(f"did not emit state: None")
            return

        await self._emit(
            EmitRequest(
                event=default_events(state),
                data=state.serialize(),
            ),
            **kwargs,
        )
        log.debug(f"emitted state {state}")

    def emit_state_sync(
        self, state: Union[SessionState, TaskState, CandidateState, None], **kwargs
    ):
        # import threading

        # sio = self.sio
        # log.debug(
        #     f"\nCommunicator set state sync:\n\t{state.status=}\n\t{threading.get_ident()=}\n\t{sio=}\n\t{sio.manager.rooms['/import']=}"
        # )

        asyncio.run(self.emit_state_async(state, **kwargs))

    async def emit_status_async(self, status: ImportStatusMessage, **kwargs):
        """Emit a status message."""
        log.error("Not getting log statements from async funcs?")
        await self._emit(
            EmitRequest(event="status", data=status.as_dict()),
            **kwargs,
        )

    def emit_status_sync(self, status: ImportStatusMessage, **kwargs):
        asyncio.run(self.emit_status_async(status, **kwargs))

    async def emit_custom_async(self, event: str, data: Any, **kwargs):
        """Emit a custom event.

        For the WebsocketCommunicator, this is equivalent to
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
        await self._emit(EmitRequest(event=event, data=data), **kwargs)

    def emit_custom_sync(self, event: str, data: Any, **kwargs):
        asyncio.run(self.emit_custom_async(event, data, **kwargs))

    async def received_request(
        self, req: Union[ChoiceReceive, CompleteReceive, CandidateSearchReceive]
    ):
        """Process incoming requests related to the import session.

        If an unknown event type is received, it logs an error and returns without further action.

        """
        log.debug(f"received_request {req=}")
        ret_val: dict[str, Any] = {}
        match req["event"]:
            case "candidate_choice":
                req = cast(ChoiceReceive, req)  # only needed for mypy type checking
                selection_id = req["selection_id"]
                candidate_id = req["candidate_id"]
                duplicate_action = req["duplicate_action"]

                sel_state = self.state.get_task_state_by_id(selection_id)
                if sel_state is None:
                    raise ValueError("No selection state found for task.")
                sel_state.current_candidate_id = candidate_id
                sel_state.duplicate_action = duplicate_action
                log.debug(f"Communicator received choice {sel_state=}")

            case "selection_complete":
                req = cast(CompleteReceive, req)
                # Validate the request
                selection_ids = req["selection_ids"]
                are_completed = req["are_completed"]
                assert len(selection_ids) == len(
                    are_completed
                ), "Selections and completion status must have the same length"

                # Update the state
                for id, completed in zip(selection_ids, are_completed):
                    sel_state = self.state.get_task_state_by_id(id)
                    if sel_state is None:
                        raise ValueError("No selection state found for task.")
                    sel_state.completed = completed
                    log.debug(f"Communicator received sel complete {sel_state=}")

            case "candidate_search":
                req = cast(CandidateSearchReceive, req)
                selection_id = req["selection_id"]
                search_id = req["search_id"]
                artist = req["artist"]
                album = req["album"]

                assert (
                    search_id is not None or artist is not None
                ), "Either Search ID or Artist + Album need to be given"
                sel_state = self.state.get_task_state_by_id(selection_id)
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
        await self._emit(req=req)
        return ret_val

    @abstractmethod
    async def _emit(
        self,
        req: Union[ChoiceReceive, CompleteReceive, CandidateSearchReceive, EmitRequest],
        **kwargs,
    ) -> None:
        """Emit the current state of the import session."""
        raise NotImplementedError("Implement in subclass")


class WebsocketCommunicator(ImportCommunicator):
    """Communicator for the websocket.

    Forwards imports via websockets from the frontend to our
    backend import logic.
    """

    sio: AsyncServer

    def __init__(
        self, state: SessionState, sio: AsyncServer, namespace: str = "/import"
    ):
        self.sio = sio
        self.namespace = namespace
        super().__init__(state)

    async def _emit(self, req, **kwargs) -> None:
        log.debug(f"emitting {req['event']=} {kwargs=}")
        await self.sio.emit(req["event"], req, namespace=self.namespace, **kwargs)


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
