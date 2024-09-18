"""
we need some of our settings in the frontend. proposed solution:
fetch settings once from the backend on first page-load.
"""

from flask import Blueprint, request, jsonify
from beets_flask.config import config
from beets_flask.logger import log

config_bp = Blueprint("config", __name__, url_prefix="/config")


@config_bp.route("/all", methods=["GET"])
def get_all():
    """
    Get nested dict representing the full (but redacted) beets config.
    """
    return jsonify(_serializable(config.flatten(redact=True)))


@config_bp.route("/", methods=["GET"])
def get_basic():
    """
    Get the config settings needed for the gui.
    """

    log.debug(config["gui"]["inbox"]["folders"].as_pairs())

    return jsonify(
        {
            "gui": _serializable(config["gui"].flatten(redact=True)),
            "import": {
                k: config["import"][k].get()
                for k in [
                    "duplicate_action",
                ]
            },
            "match": {
                k: config["match"][k].get()
                for k in [
                    "strong_rec_thresh",
                    "medium_rec_thresh",
                ]
            }
            | {
                k: config["match"][k].as_str_seq()
                for k in [
                    "album_disambig_fields",
                    "singleton_disambig_fields",
                ]
            },
        }
    )


def _serializable(input):
    """
    Recursively convert bytes to str in a nested dictionary.
    """
    if isinstance(input, bytes):
        return input.decode("utf-8")
    elif isinstance(input, dict):
        return {k: _serializable(v) for k, v in input.items()}
    elif isinstance(input, list):
        return [_serializable(element) for element in input]
    return input
