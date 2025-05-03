import traceback
from functools import wraps
from typing import Awaitable, Callable, NotRequired, ParamSpec, TypedDict, TypeVar

from beets_flask.logger import log


class SerializedException(TypedDict):
    """Serialized exception format.

    This is used to serialize exceptions to a common format.
    The format is as follows:
    {
        "type": "Exception type",
        "message": "Error message",
        "description": "Error description (optional)"
    }
    """

    type: str
    message: str
    description: NotRequired[str | None]
    trace: NotRequired[str | None]


class ApiException(Exception):
    """Base class for all API errors."""

    status_code: int = 500

    def __init__(self, *args, status_code: int | None = None):
        super().__init__(*args)
        if status_code is not None:
            self.status_code = status_code


class InvalidUsageException(ApiException):
    """Invalid usage of the API.

    This is used to indicate that the API was used incorrectly.
    """

    status_code: int = 400


class NotFoundException(ApiException):
    """Resource not found.

    This is used to indicate that the requested resource was not found.
    """

    status_code: int = 404


class IntegrityException(ApiException):
    """Integrity error.

    This is used to indicate that the requested resource was not found.
    """

    status_code: int = 409


class UserException(Exception):
    """Base class for errors caused by user input or config."""

    status_code: int = 422

    def __init__(self, *args, status_code: int | None = None):
        super().__init__(*args)
        if status_code is not None:
            self.status_code = status_code


class DuplicateException(UserException):
    """Duplicate error.

    Raised when we have trouble resolving duplicates in the beets library. Users should check their config and api usage.
    """

    status_code: int = 422


def to_serialized_exception(
    exception: Exception,
) -> SerializedException:
    """Convert an exception to a serialized format.

    Parameters
    ----------
    exception : Exception | None
        The exception to serialize.

    Returns
    -------
    SerializedException
        The serialized exception.
    """

    if exception is None:
        return None

    tb: str | None = None

    if exception.__traceback__ is not None:
        tb = "".join(traceback.format_tb(exception.__traceback__))

    return SerializedException(
        type=exception.__class__.__name__,
        message=str(exception),
        description=exception.__doc__,
        trace=tb,
    )


P = ParamSpec("P")  # Parameters
R = TypeVar("R")  # Return


def exception_as_return_value(
    f: Callable[P, Awaitable[R]],
) -> Callable[P, Awaitable[R | SerializedException]]:
    """Decorator to catch exceptions and return them as a values.

    This is used to catch exceptions in the redis worker and return them
    as a values we can use in the frontend. Sadly standard exeption handling
    in rq is lacking!
    """

    @wraps(f)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R | SerializedException:
        try:
            ret = await f(*args, **kwargs)
        except Exception as e:
            log.exception(e)
            # Some exceptions are not serializable, so we need to convert them to a
            # serialized format. E.g. OSErrors
            return to_serialized_exception(e)

        return ret

    return wrapper


__all__ = [
    "SerializedException",
    "ApiException",
    "InvalidUsageException",
    "NotFoundException",
    "IntegrityException",
    "to_serialized_exception",
]
