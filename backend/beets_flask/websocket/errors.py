"""Similar to the routes/errors.py file, this file contains error handling logic for the websocket routes.

We parse all exceptions to a common format and return them to the client for handling.
"""

from __future__ import annotations

import re
from typing import (
    Awaitable,
    Callable,
    Coroutine,
    NotRequired,
    ParamSpec,
    TypedDict,
    TypeVar,
)

from beets_flask import log

from . import sio

Params = ParamSpec("Params")
ReturnType = TypeVar("ReturnType")


def sio_catch_expection(func):
    async def wrapper(*args, **kwargs):
        try:
            result = await func(*args, **kwargs)
            return result
        except Exception as e:
            log.error(f"Unhandled websocket error: {e}")
            return _error_parser(e)

    return wrapper


def _error_parser(e: Exception) -> WebSocketErrorDict:
    # We may add some expection handling here if
    # we want to handle some exceptions differently
    log.error(f"Unhandled websocket error: {e}")
    d = WebSocketErrorDict(
        error=e.__class__.__name__,
        message=str(e),
    )
    return d


class WebSocketErrorDict(TypedDict):
    error: str
    message: str
    description: NotRequired[str]


# Test namespace for error testing
# FIXME Only include in testing environment
@sio.on("test_generic_exc", namespace="/test")
@sio_catch_expection
def test_generic_exc(sid):
    raise Exception("Exception message")


__all__ = ["sio_catch_expection", "WebSocketErrorDict"]
