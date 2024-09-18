import json
import traceback
from confuse import ConfigError
from quart import Blueprint, Response, jsonify

from werkzeug.exceptions import HTTPException

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


@error_bp.app_errorhandler(InvalidUsage)
async def handle_crawler_exception(error: InvalidUsage):
    return (
        jsonify({"error": "Bad request", "message": error.message}),
        error.status_code,
    )


@error_bp.app_errorhandler(NotImplementedError)
async def handle_not_implemented(error):
    return jsonify({"error": "Not implemented"}), 501


@error_bp.app_errorhandler(ConfigError)
async def handle_config_exception(error: ConfigError):
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
async def handle_file_not_found(error: FileNotFoundError):
    return jsonify({"error": "File not found", "message": str(error)}), 404


@error_bp.app_errorhandler(HTTPException)
async def handle_exception(error: HTTPException):
    """Return JSON instead of HTML for HTTP errors."""
    # start with the correct headers and status code from the error
    res = Response(
        json.dumps(
            {
                "code": error.code,
                "name": error.name,
                "description": error.description,
            }
        )
    )
    res.content_type = "application/json"
    res.status_code = error.code or 500

    return res


@error_bp.app_errorhandler(Exception)
async def handle_generic_error(error):
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
#                            Test the error handling                           #
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
