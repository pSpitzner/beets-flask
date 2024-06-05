from flask import Blueprint, current_app, request
from flask_sse import sse
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
    query_key: list[str],
    attributes: dict[str, object] | Literal["all"] = "all",
    msg: str = "Data updated",
):

    payload = {
        "type" : type,
        "body": {
            "queryKey": query_key,
            "attributes": attributes,
            "message": msg,
        }
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
        return {"message": "Message sent"}
