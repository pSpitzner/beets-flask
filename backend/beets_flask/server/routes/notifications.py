"""Notifications api.

Notification allow to receive updates about changes in the backend.
For instance new tags generated or new imported albums.

Currently we support web push notifications and arbitrary webhooks.
"""

from __future__ import annotations

import base64
import json
import time
from typing import (
    Literal,
    NamedTuple,
    NotRequired,
    TypedDict,
    Union,
    cast,
)
from urllib.parse import urlparse

import aiohttp
import ecdsa
from pywebpush import Vapid, WebPusher, WebPushException
from quart import Blueprint, Quart, request

from beets_flask.config.beets_config import get_bf_config_dir
from beets_flask.database import db_session_factory
from beets_flask.database.models import (
    PushSubscription,
    SubscriptionSettings,
    WebhookSubscription,
)
from beets_flask.database.models.notifications import WebhookType
from beets_flask.logger import log
from beets_flask.server.routes.exception import InvalidUsageException

from .db_models.notifications import PushBlueprint, WebHookBlueprint

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


@notification_bp.route("/send_all", methods=["POST"])
async def send_all_notifications():
    """Send a test notification to all subscriptions."""
    params = await request.get_json()
    if not params:
        return {"status": "error", "error": "No parameters provided"}, 400
    with db_session_factory() as db_session:
        subscriptions = (
            db_session.query(PushSubscription).all()
            + db_session.query(WebhookSubscription).all()
        )

        async with aiohttp.ClientSession() as session:
            for subscription in subscriptions:
                try:
                    await send_notification(params, subscription, session)
                except Exception as e:
                    log.exception(
                        f"Failed to send test notification to {subscription.id}", e
                    )

    return {"status": "ok"}, 200


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

    webhook_bp = WebHookBlueprint()
    webhook_bp.blueprint.route("/test", methods=["POST"])(test_webhook)

    push_bp = PushBlueprint()
    push_bp.blueprint.route("/test", methods=["POST"])(test_push)

    notification_bp.register_blueprint(webhook_bp.blueprint)
    notification_bp.register_blueprint(push_bp.blueprint)
    app.register_blueprint(notification_bp)


# ------------------------- Tests subscription -------------------------------- #


async def test_webhook():
    """Send a test notification a given webhook."""
    params = await request.get_json()
    id, url, method, headers, params, body, settings = (
        WebHookBlueprint.parse_webhook_params(params)
    )

    test_subscriber = WebhookSubscription(
        url=url,
        method=method,
        headers=headers,
        params=params,
        body=body,
        settings=SubscriptionSettings.from_dict(settings or {}),
    )

    try:
        await send_test_notification(test_subscriber)
        log.info(f"Test notification sent to {url}")
    except Exception as e:
        log.exception(f"Failed to send test notification to {url}", e)
        log.info(f"Failed to send test notification to {url}")
        return (
            {
                "status": "error",
                "error": str(e),
            },
            200,
        )

    return {"status": "ok"}, 200


async def test_push():
    """Send a test notification to a given push subscription."""
    params = await request.get_json()
    endpoint, expiration_time, keys, settings = PushBlueprint.parse_subscription_params(
        params
    )

    test_subscriber = PushSubscription(
        id=endpoint,
        keys=keys,
        expiration_time=expiration_time,
        settings=SubscriptionSettings.from_dict(settings or {}),
    )

    try:
        await send_test_notification(test_subscriber)
        log.info(f"Test notification sent to {endpoint}")
    except ConnectionError as e:
        log.exception(f"Failed to send test notification to {endpoint}", e)
        log.info(f"Failed to send test notification to {endpoint}")
        raise InvalidUsageException(
            f"Failed to send test notification to {endpoint}: {e}",
            status_code=500,
        )

    return {"status": "ok"}, 200


async def send_test_notification(subscription: PushSubscription | WebhookSubscription):
    notification: PushNotification = PushNotification(
        title="Test Notification",
        options=PushNotificationOptions(
            body="This is a test notification. If you see this, the subscription is working.",
            renotify=True,
            requireInteraction=True,
            tag="test-notification",
            actions=[
                PushAction(
                    action="default",
                    title="View home",
                ),
                PushAction(
                    action="open-inbox",
                    title="Open Inbox",
                ),
            ],
        ),
    )

    async with aiohttp.ClientSession() as session:
        await send_notification(
            notification=notification, subscription=subscription, session=session
        )


# ---------------------------- Send notifications ---------------------------- #


async def send_notification(
    notification: PushNotification,
    subscription: PushSubscription | WebhookSubscription,
    session: aiohttp.ClientSession,
):
    try:
        await _send(
            notification=notification,
            subscription=subscription,
            session=session,
        )
        t = "push" if isinstance(subscription, PushSubscription) else "webhook"
        url = (
            subscription.id
            if isinstance(subscription, PushSubscription)
            else subscription.url
        )
        log.debug(
            f"Notification sent to {url} ({t})",
        )
    except aiohttp.ClientConnectorError as e:
        # Connection error, e.g. the server is down or the URL is invalid
        original_exception = e.os_error if e.os_error else e
        url = (
            subscription.url
            if isinstance(subscription, WebhookSubscription)
            else subscription.id
        )
        user_friendly_error = f"Unable to connect to {url}. Please check the URL and your network connection."
        log.exception(f"Connection error", original_exception)
        raise Exception(
            user_friendly_error,
        ) from e
    except WebPushException as e:
        if e.response is not None and e.response.status_code == 410:
            # Subscription is no longer valid, remove it
            with db_session_factory() as db_session:
                instance = PushSubscription.get_by(
                    PushSubscription.id == subscription.id,
                    session=db_session,
                )
                if instance:
                    db_session.delete(instance)
                    db_session.commit()
        else:
            log.exception(f"Failed to send notification to {subscription.id}", e)


async def _send(
    notification: PushNotification,
    subscription: PushSubscription | WebhookSubscription,
    session: aiohttp.ClientSession,
):
    """Helper to send a notification to a subscription.

    This function handles both push subscriptions and webhook subscriptions.
    """
    if isinstance(subscription, PushSubscription):
        response = await webpush_async(
            subscription_info={
                "endpoint": subscription.id,
                "keys": {k: v for k, v in subscription.keys.items()},
            },
            data=json.dumps(notification),
            vapid_private_key=get_vapid_keypair().private,
            vapid_claims={"sub": "mailto:test@test.de"},
        )
    elif (
        isinstance(subscription, WebhookSubscription)
        and subscription.type == WebhookType.WEBPUSH
    ):
        url = subscription.url
        if not url.startswith(("http://", "https://")):
            url = f"http://{url}"

        response = await session.request(
            method=subscription.method,
            url=url,
            headers=subscription.headers,
            params=subscription.params,
            json=notification,
        )
    else:
        # if we ever add other types, they should be handled here
        raise InvalidUsageException(
            f"Unsupported subscription type: {type(subscription)} for {subscription.type}",
            status_code=400,
        )

    response.raise_for_status()


# ---------------------------- Notification types ---------------------------- #


class PushNotification(TypedDict):
    """Notification for push subscriptions.

    Format is very similar to the Web Push API.
    See https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
    """

    title: str
    options: NotRequired[PushNotificationOptions]


class PushNotificationOptions(TypedDict):
    """Options for the push notification.

    As always the web sucks! Many of these options
    are not supported by all browsers, especially
    safari. As always fuck you apple!
    """

    actions: NotRequired[list[PushAction]]
    # list of actions for the notification

    badge: NotRequired[str]
    # URL to the badge icon

    body: NotRequired[str]
    # body text of the notification

    data: NotRequired[TaggedData]
    # Data is used for additional features in beets-flask,

    icon: NotRequired[str]
    # URL to the icon for the notification

    image: NotRequired[str]
    # URL to an image for the notification

    renotify: NotRequired[bool]
    # whether to renotify the user if the notification is already visible

    requireInteraction: NotRequired[bool]
    # whether the notification should require user interaction

    tag: NotRequired[str]
    # tag for the notification, used to replace existing notifications with the same tag

    vibrate: NotRequired[list[int]]
    # vibration pattern for the notification


class PushAction(TypedDict):
    """Action for the push notification.

    We support some custom actions for the notifications,
    such as viewing an album or opening a folder or the inbox.
    See worker.ts for the list of supported actions.
    """

    action: str
    title: str

    icon: NotRequired[str]
    # URL to the icon for the action


# Extra data send with the notification.


class TaggedData(TypedDict):
    """Notification for tagged albums with a type."""

    type: Literal["tagged"]
    path: str  # path to the folder with the tagged album/item
    hash: str  # hash of the album/item, used to identify it

    nCandidates: int  # number of candidates found
    bestCandidate: Candidate


class Candidate(TypedDict):
    """Candidate for a tagged album."""

    title: str
    artist: str | None
    match: float  # match percentage (1.0 = 100%)
    source: str | None  # source of the candidate, e.g. "discogs", "musicbrainz"


# ------------------------------- Util function ------------------------------ #


async def webpush_async(
    subscription_info: dict[
        str,
        Union[Union[str, bytes], dict[str, Union[str, bytes]]],
    ],
    data: Union[None, str] = None,
    vapid_private_key: str | None = None,
    vapid_claims: Union[None, dict[str, Union[str, int]]] = None,
    content_encoding: str = "aes128gcm",
    timeout: Union[None, float] = None,
    ttl: int = 0,
    headers: Union[None, dict[str, Union[str, int, float]]] = None,
    aiohttp_session: Union[None, aiohttp.client.ClientSession] = None,
) -> aiohttp.ClientResponse:
    """Async version of webpush.

    encodes and sends `data` to the endpoint
    contained in `subscription_info` using optional VAPID auth headers.

    :param subscription_info: Provided by the client call
    :param data: Serialized data to send
    :param vapid_private_key: Vapid instance or path to vapid private key PEM or encoded str
    :param vapid_claims: Dictionary of claims ('sub' required)
    :param content_encoding: Optional content type string
    :param timeout: POST requests timeout
    :param ttl: Time To Live
    :param headers: Dictionary of extra HTTP headers to include
    :param aiohttp_session: Optional aiohttp ClientSession for connection pooling
    """
    if headers is None:
        headers = dict()
    else:
        # Ensure we don't leak VAPID headers by mutating the passed in dict.
        headers = headers.copy()

    vapid_headers = None
    if vapid_claims:
        if not vapid_claims.get("aud"):
            url = urlparse(cast(str, subscription_info.get("endpoint")))
            aud = "{}://{}".format(url.scheme, url.netloc)
            vapid_claims["aud"] = aud

        # Set expiration if not provided or expired
        if not vapid_claims.get("exp") or int(vapid_claims.get("exp") or 0) < int(
            time.time()
        ):
            vapid_claims["exp"] = int(time.time()) + (12 * 60 * 60)

        if not vapid_private_key:
            raise WebPushException("VAPID dict missing 'private_key'")

        vv = Vapid.from_string(private_key=vapid_private_key)
        vapid_headers = vv.sign(vapid_claims)
        headers.update(vapid_headers)

    response = await WebPusher(
        subscription_info,
        aiohttp_session=aiohttp_session,
    ).send_async(
        data,
        headers,
        ttl=ttl,
        content_encoding=content_encoding,
        timeout=timeout,
    )

    if isinstance(response, aiohttp.ClientResponse) and response.status > 202:
        response_text = await response.text()
        raise WebPushException(
            message="Push failed: {} {}\nResponse body:{}".format(
                response.status, response.reason, response_text
            ),
            response=response,
        )

    return cast(aiohttp.ClientResponse, response)
