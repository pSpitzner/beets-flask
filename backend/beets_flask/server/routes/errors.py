"""How errors are propagated to the user.

This module contains the error handling logic for the Quart application. It provides a way to handle errors in a consistent way and return JSON responses to the user.
"""

import json
import traceback
from typing import Any, Callable

from confuse import ConfigError
from quart import Blueprint, jsonify
from werkzeug.exceptions import HTTPException

from beets_flask import log

error_bp = Blueprint("error", __name__)


class InvalidUsage(Exception):
    status_code = 400

    def __init__(self, message, status_code=None, payload=None):
        super().__init__()
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv["error"] = "Bad request"
        rv["message"] = self.message
        return rv


@error_bp.app_errorhandler(NotImplementedError)
async def handle_not_implemented(error):
    return jsonify({"error": "Not implemented"}), 501


@error_bp.app_errorhandler(InvalidUsage)
async def handle_crawler_exception(error: InvalidUsage):
    return (
        jsonify({"error": "Bad request", "message": error.message}),
        error.status_code,
    )


@error_bp.app_errorhandler(ConfigError)
async def handle_config_exception(error: ConfigError):
    log.warning(f"Configuration Error: {error}")
    return (
        jsonify(
            {
                "error": "Bad request",
                "message": "Configuration Error",
                "description": error.__doc__,
            }
        ),
        400,
    )


@error_bp.app_errorhandler(FileNotFoundError)
async def handle_file_not_found(error):
    return jsonify({"error": "File not found", "message": str(error)}), 404


@error_bp.app_errorhandler(HTTPException)
async def handle_exception(e: HTTPException):
    """Return JSON instead of HTML for HTTP errors."""
    # start with the correct headers and status code from the error
    return (
        jsonify(
            {
                "code": e.code or 500,
                "name": e.name,
                "description": e.description,
            }
        ),
        e.code or 500,
    )


@error_bp.app_errorhandler(Exception)
async def handle_generic_error(error):
    log.error(f"Internal server error: {error}")
    trace = traceback.format_exc()
    log.error(trace)
    return (
        jsonify(
            {
                "error": "Internal server error",
                "message": str(error),
                "trace": traceback.format_exc(),
            }
        ),
        500,
    )


# ---------------------------------------------------------------------------- #
#                      Test the error handling endpoints                       #
# ---------------------------------------------------------------------------- #


@error_bp.route("/error/invalidUsage", methods=["GET"])
async def error():
    raise InvalidUsage("This is a bad request")


@error_bp.route("/error/notImplemented", methods=["GET"])
async def not_implemented():
    raise NotImplementedError("This is not implemented")


@error_bp.route("/error/configError", methods=["GET"])
async def config_error():
    raise ConfigError("This is a config error")


@error_bp.route("/error/fileNotFound", methods=["GET"])
async def file_not_found():
    raise FileNotFoundError("This is a file not found error")


@error_bp.route("/error/genericError", methods=["GET"])
async def generic_error():
    raise Exception("This is a generic error")


# PS: I think this is an okay olace for this, as it ensures
# param parsing with error handler.
def get_query_param(
    params: dict,
    key: str,
    convert_func: Callable,
    default: Any = None,
    error_message: str | None = None,
):
    """Safely retrieves and converts a query parameter from the request args.

    Parameters
    ----------
    params : dict
        The request args.
    key : str
        The key of the parameter to retrieve.
    default : any, optional
        The default value if the parameter is not found, defaults to None.
    convert_func : callable, optional
        A function to convert the parameter value, defaults to None. Common example, just use the type: `str`, `int` etc.
    error_message : str, optional
        The error message to raise if the conversion fails, defaults to None.
    """
    value = params.get(key, default)

    try:
        value = convert_func(value)
    except (ValueError, TypeError):
        if error_message is None:
            error_message = f"Invalid parameter'{key}'"
        raise InvalidUsage(error_message)

    return value
