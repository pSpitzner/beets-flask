import traceback
from typing import NotRequired, TypedDict


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


def to_serialized_exception(
    exception: Exception,
) -> SerializedException:
    """Convert an exception to a serialized format.

    Parameters
    ----------
    exception : Exception
        The exception to serialize.
    description : str | None, optional
        A description of the error, by default None

    Returns
    -------
    SerializedException
        The serialized exception.
    """

    tb: str | None = None

    if exception.__traceback__ is not None:
        tb = "".join(traceback.format_tb(exception.__traceback__))

    return SerializedException(
        type=exception.__class__.__name__,
        message=str(exception),
        description=exception.__doc__,
        trace=tb,
    )


__all__ = [
    "SerializedException",
    "ApiException",
    "InvalidUsageException",
    "NotFoundException",
    "IntegrityException",
    "to_serialized_exception",
]
