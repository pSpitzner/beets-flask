"""How errors are propagated to the user.

This module contains the error handling logic for the Quart application.
It provides a way to handle errors in a consistent way and return JSON
responses to the user.

Every error is returned as JSON in the following format:
{
    "error": "Error type",
    "message": "Error message (optional)",
    "description": "Error description (optional)"
    "trace": "Error trace (optional)"
}

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


# ------------------------------ Library errors ------------------------------ #


class NotFoundError(Exception):
    """Exception raised for 404 errors.

    For instance if an item is not
    found in the database.
    """

    status_code = 404

    def __init__(self, message, status_code=None, payload=None):
        super().__init__()
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv["error"] = "Not found"
        rv["message"] = self.message
        return rv


@error_bp.app_errorhandler(NotFoundError)
async def handle_not_found(error: NotFoundError):
    return (
        jsonify({"error": "Not found", "message": error.message}),
        error.status_code,
    )


class IntegrityError(Exception):
    """Exception raised for 409 errors.

    For instance if an item is not
    found on disk but is in the database.
    """

    status_code = 409

    def __init__(self, message, status_code=None, payload=None):
        super().__init__()
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv["error"] = "Integrity error"
        rv["message"] = self.message
        return rv


@error_bp.app_errorhandler(IntegrityError)
async def handle_integrity_error(error: IntegrityError):
    return (
        jsonify({"error": "Integrity error", "message": error.message}),
        error.status_code,
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


@error_bp.route("/error/notFound", methods=["GET"])
async def not_found():
    raise NotFoundError("Item not found")


@error_bp.route("/error/integrityError", methods=["GET"])
async def integrity_error():
    raise IntegrityError("Integrity error")
