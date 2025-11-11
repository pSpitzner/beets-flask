"""Config endpoints for the frontend.

we need some of our settings in the frontend. proposed solution:
fetch settings once from the backend on first page-load.
"""

from beets import __version__ as beets_version
from quart import Blueprint, jsonify

from beets_flask.config import get_config

config_bp = Blueprint("config", __name__, url_prefix="/config")


@config_bp.route("/all", methods=["GET"])
async def get_all():
    """Get nested dict representing the full (but redacted) beets config."""
    config = get_config()
    return jsonify(_serializable(config.flatten(redact=True)))


@config_bp.route("/", methods=["GET"])
async def get_basic():
    """Get the config settings needed for the gui."""
    config = get_config()
    plugins = config["plugins"].as_str_seq()
    from beets.metadata_plugins import find_metadata_source_plugins

    data_sources: list[str] = [
        p.__class__.data_source for p in find_metadata_source_plugins()
    ]

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
            "plugins": config["plugins"].as_str_seq(),
            "data_sources": data_sources,
            "beets_version": beets_version,
        }
    )


@config_bp.route("/yaml/beets", methods=["GET"])
async def get_raw_beets():
    """Get the raw config yaml file."""
    config = get_config()
    path = config.get_beets_config_path()
    with open(path) as f:
        content = f.read()
    return jsonify({"path": path, "content": content})


@config_bp.route("/yaml", methods=["GET"])
async def get_raw():
    """Get the raw config yaml file for beets-flask."""
    config = get_config()
    path = config.get_beets_flask_config_path()
    with open(path) as f:
        content = f.read()
    return jsonify({"path": path, "content": content})


@config_bp.route("/refresh", methods=["POST"])
async def refresh():
    """Refresh the config object.

    Mainly for debug purposes as it only refresh the config for
    the main thread.

    ```
    curl -X POST http://localhost:5001/api_v1/config/refresh
    ```
    """
    from beets_flask.config.beets_config import refresh_config

    refresh_config()
    return jsonify({"status": "ok"})


def _serializable(input):
    """
    Convert bytes to str in a nested dictionary.

    Recursion is used to handle nested dictionaries.
    """
    if isinstance(input, bytes):
        return input.decode("utf-8")
    elif isinstance(input, dict):
        return {k: _serializable(v) for k, v in input.items()}
    elif isinstance(input, list):
        return [_serializable(element) for element in input]
    return input
