"""Notifications related routes.

Notification allow to receive updates about changes in the backend.
For instance new tags generated or new imported albums
"""

import base64
import json
from typing import NamedTuple

import ecdsa
from quart import Blueprint

from beets_flask.config.beets_config import get_bf_config_dir

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
