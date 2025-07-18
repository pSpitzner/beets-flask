"""Notifications api.

Notification allow to receive updates about changes in the backend.
For instance new tags generated or new imported albums.

Currently we support web push notifications and arbitrary webhooks.
"""

from __future__ import annotations

import base64
import json
import select
from typing import Literal, NamedTuple, TypedDict

import ecdsa
from pywebpush import WebPushException, webpush
from quart import Blueprint, Quart, request

from beets_flask.config.beets_config import get_bf_config_dir
from beets_flask.database import db_session_factory
from beets_flask.database.models import PushSubscription
from beets_flask.logger import log
from beets_flask.server.routes.exception import InvalidUsageException
from beets_flask.server.routes.inbox import get_inbox_for_path

from .db_models.push import SubscriptionBlueprint, WebHookBlueprint

notification_bp = Blueprint("notifications", __name__, url_prefix="/notifications")

# -------------------------------- Vapid keys -------------------------------- #
# Vapid keys are used for web push notifications to authenticate the sender.
# TODO: Add a way to add a sub information to the VAPID keys, e.g. an email address.
# Maybe config?


@notification_bp.route("/vapid_key", methods=["GET"])
def get_vapid_key():
    """Get the public VAPID key for web push notifications."""
    keypair = get_vapid_keypair()

    return (
        {"key": keypair.public},
        200,
        {"Content-Type": "application/json"},
    )


class VapidKeyPair(NamedTuple):
    private: str
    public: str


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


# --------------------------------- Register --------------------------------- #


def register_notifications(app: Blueprint | Quart):
    """Register the push models with the app."""

    notification_bp.register_blueprint(WebHookBlueprint().blueprint)
    notification_bp.register_blueprint(SubscriptionBlueprint().blueprint)
    app.register_blueprint(notification_bp)
