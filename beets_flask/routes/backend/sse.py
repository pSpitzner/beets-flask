from flask import Blueprint, Response, current_app, request, jsonify
from flask_sse import sse
from flask_cors import cross_origin
from typing import Literal
import json
import requests
from beets_flask.utility import log

sse_bp = Blueprint("sse", __name__, url_prefix="/sse")


sse_bp.register_blueprint(sse, url_prefix="/stream")

# print full details of the blueprint
log.debug(f"{sse_bp.subdomain=}")


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

    log.debug(f"update_client_view: {payload}")
    response = requests.post("http://localhost:5001/api_v1/sse/publish", json=payload)
    if response.status_code != 200:
        log.debug(f"Failed to update client view: {response.json()}")


@sse_bp.route("/publish", methods=["POST"])
def publish():
    with current_app.app_context():
        data = request.get_json()
        type: Literal["tag", "inbox"] = data.get("type")
        body: str = data.get("body")
        sse.publish(json.dumps(body), type=type)
        return {"message": "Message sent"}, 200
