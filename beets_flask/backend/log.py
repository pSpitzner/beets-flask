from flask import Blueprint
from flask_sse import sse

log_bp = Blueprint("log", __name__, url_prefix="/log")


# Register the sse blueprint
log_bp.register_blueprint(sse, url_prefix="/stream")


def update_log(type: str, msg: str = "Data updated"):
    """
    Update the log sse event handler with the given type and message.

    Parameters:
    - type (str): The type of log entry.
    - msg (str): The message to be logged. Default is "Data updated".

    TODO: This probably needs the app context to work properly.

    Returns:
    None
    """
    sse.publish({"message": msg}, type=type)
