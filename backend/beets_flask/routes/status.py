"""Status update blueprint.

Use this blueprint to send status updates to the client.
We used to use SeverSideEvents but moved to websocket.

see also /websocket/status
"""

from typing import Literal

import requests
from flask import Blueprint, current_app, request

from beets_flask.logger import log
from beets_flask.websocket import sio

sse_bp = Blueprint("status", __name__, url_prefix="/status")


def update_client_view(
    type: Literal["tag", "inbox"],
    attributes: dict[str, object] | Literal["all"] = "all",
    message: str = "Data updated",
    tagId: str | None = None,
    tagPath: str | None = None,
):
    payload = {
        "type": type,
        "body": {
            "tagId": tagId,
            "tagPath": tagPath,
            "attributes": attributes,
            "message": message,
        },
    }

    try:
        response = requests.post(
            "http://localhost:5001/api_v1/status/publish", json=payload
        )
        if response.status_code != 200:
            log.debug(f"Failed to update client view: {response.json()}")
    except requests.exceptions.ConnectionError:
        log.debug("Failed to update client view: Connection refused")


@sse_bp.route("/publish", methods=["POST"])
def publish():
    with current_app.app_context():
        data = request.get_json()
        type: Literal["tag", "inbox"] = data.get("type")
        body: dict = data.get("body")
        log.debug(f"Sending status update: {type=} {body=}")
        sio.emit(type, body, namespace="/status")

        return {"message": "Message sent"}, 200
