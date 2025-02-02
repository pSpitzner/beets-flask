"""Status update blueprint.

Use this blueprint to send status updates to the client.
We used to use SeverSideEvents but moved to websocket.

see also /websocket/status
"""

import asyncio
from typing import Coroutine, Literal

import requests
from quart import Blueprint, current_app, request

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

    def handle_response():
        try:
            log.debug(f"Trying to publish (async): {payload}")
            response = requests.post(
                "http://localhost:5001/api_v1/status/publish", json=payload
            )
            if response.status_code == 200:
                log.debug("Client view updated (async)")
            else:
                log.error(f"Failed to update client view: {response.json()}")
        except requests.exceptions.ConnectionError:
            log.error("Failed to update client view: Connection refused")

    # we could simply use async requests, but this is a paradigm
    # that we also need in the interactive import session until
    # we rewrite the beets pipeline for async/await
    # thus keeping this for reference
    with_loop(asyncio.to_thread(handle_response))


@sse_bp.route("/publish", methods=["POST"])
async def publish():
    async with current_app.app_context():
        data = await request.get_json()
        type: Literal["tag", "inbox"] = data.get("type")
        body: dict = data.get("body")
        log.debug(f"Sending status update: {type=} {body=}")
        await sio.emit(type, body, namespace="/status")

        return {"message": "Message sent"}, 200


def with_loop(co: Coroutine):
    loop = asyncio.get_event_loop()
    task = loop.create_task(co)
    if not loop.is_running():
        loop.run_until_complete(task)
