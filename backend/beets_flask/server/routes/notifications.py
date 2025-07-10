"""Notifications related routes.

Notification allow to receive updates about changes in the backend.
For instance new tags generated or new imported albums
"""

import base64
import json
from typing import NamedTuple, TypedDict

import ecdsa
from quart import Blueprint, request

from beets_flask.config.beets_config import get_bf_config_dir
from beets_flask.database import db_session_factory
from beets_flask.database.models import PushSubscription
from beets_flask.server.routes.exception import InvalidUsageException
from beets_flask.server.utility import pop_query_param

notification_bp = Blueprint("notifications", __name__, url_prefix="/notifications")


@notification_bp.route("/vapid_key", methods=["GET"])
def get_vapid_key():
    """Get the public VAPID key for web push notifications."""
    keypair = get_vapid_keypair()

    return (
        {"key": keypair.public},
        200,
        {"Content-Type": "application/json"},
    )


def get_vapid_keypair():
    """Get the VAPID keys for web push notifications."""
    file = get_bf_config_dir() / "vapid_keys.json"
    if not file.exists():
        # If the file does not exist, generate a new keypair
        keys = _generate_vapid_keypair()
        with open(file, "w") as f:
            f.write(
                json.dumps(
                    {
                        "private_key": keys.private,
                        "public_key": keys.public,
                    }
                )
            )
        return keys
    with open(file, "r") as f:
        data = json.load(f)
        return VapidKeyPair(
            private=data["private_key"],
            public=data["public_key"],
        )


class VapidKeyPair(NamedTuple):
    private: str
    public: str


def _generate_vapid_keypair():
    # See https://datatracker.ietf.org/doc/rfc8292/
    pk = ecdsa.SigningKey.generate(curve=ecdsa.NIST256p)
    vk = pk.get_verifying_key()

    return VapidKeyPair(
        private=base64.urlsafe_b64encode(pk.to_string()).strip(b"=").decode("utf-8"),
        public=base64.urlsafe_b64encode(b"\x04" + vk.to_string())  # type: ignore
        .strip(b"=")
        .decode("utf-8"),
    )


@notification_bp.route("/subscribe", methods=["POST"])
async def subscribe():
    """Subscribe to push notifications."""
    # The request should contain the subscription object
    params = await request.get_json()

    # Standard PushSubscription fields
    endpoint = pop_query_param(params, "endpoint", str, default=None)
    expiration_time = pop_query_param(params, "expirationTime", int, default=None)
    keys = pop_query_param(params, "keys", dict, default=None)

    if not endpoint or not keys:
        raise InvalidUsageException(
            "Missing 'endpoint' parameter in subscription",
            status_code=400,
        )

    # Extra options for the subscription (i.e. which notifications to receive)
    options = pop_query_param(params, "options", dict, default=None)

    if len(params) > 0:
        raise InvalidUsageException(
            "Invalid parameters provided for subscription",
            status_code=400,
        )

    # Check if the endpoint already exists in the database
    # if yes update, if no insert new
    with db_session_factory() as db_session:
        instance = PushSubscription.get_by(
            PushSubscription.id == endpoint, session=db_session
        )
        if instance:
            # Update existing subscription
            instance.keys = keys
            instance.expiration_time = expiration_time
            # TODO update options if needed
            db_session.commit()
        else:
            # Create new subscription
            instance = PushSubscription(
                id=endpoint,
                keys=keys,
                expiration_time=expiration_time,
            )
            db_session.add(instance)
            db_session.commit()

            print(f"Received subscription: {instance}")

    return "Subscription added successfully", 200


@notification_bp.route("/unsubscribe", methods=["POST"])
async def unsubscribe():
    """Unsubscribe from push notifications."""
    params = await request.get_json()

    endpoint = pop_query_param(params, "endpoint", str, default=None)

    if not endpoint:
        raise InvalidUsageException(
            "Missing 'endpoint' parameter in subscription",
            status_code=400,
        )

    with db_session_factory() as db_session:
        instance = PushSubscription.get_by(
            PushSubscription.id == endpoint, session=db_session
        )
        if not instance:
            return "No subscription found for the given endpoint", 200

        db_session.delete(instance)
        db_session.commit()

    return "Unsubscribed successfully", 200
