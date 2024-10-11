"""Status update blueprint.

Use this blueprint to send status updates to the client.
We used to use SeverSideEvents but moved to websocket.

TODO: We should move this to the websocket folder and rename!
"""

from typing import Literal

import requests
from flask import Blueprint, current_app, request

from beets_flask.logger import log
from beets_flask.websocket import sio

sse_bp = Blueprint("sse", __name__, url_prefix="/sse")


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

    response = requests.post("http://localhost:5001/api_v1/sse/publish", json=payload)
    if response.status_code != 200:
        log.debug(f"Failed to update client view: {response.json()}")


@sse_bp.route("/publish", methods=["POST"])
def publish():
    with current_app.app_context():
        data = request.get_json()
        type: Literal["tag", "inbox"] = data.get("type")
        body: dict = data.get("body")
        log.debug(f"Sending status update: {type=} {body=}")
        sio.emit(type, body, namespace="/status")

        return {"message": "Message sent"}, 200


@sio.on("connect", namespace="/status")  # type: ignore
def connect(sid, environ):
    """Handle new client connected."""
    log.debug(f"StatusSocket new client connected {sid}")


@sio.on("disconnect", namespace="/status")  # type: ignore
def disconnect(sid):
    """Handle client disconnect."""
    log.debug(f"StatusSocket client disconnected {sid}")


@sio.on("*", namespace="/status")  # type: ignore
def any_event(event, sid, data):
    log.debug(f"StatusSocket sid {sid} undhandled event {event} with data {data}")
