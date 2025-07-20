from typing import Any

from quart import request

from beets_flask.database import db_session_factory
from beets_flask.database.models import (
    SubscriptionSettings,
    PushSubscription,
    WebhookSubscription,
)
from beets_flask.server.routes.exception import InvalidUsageException
from beets_flask.server.utility import pop_query_param

from .base import ModelAPIBlueprint


class WebHookBlueprint(ModelAPIBlueprint[WebhookSubscription]):
    def __init__(self):
        super().__init__(WebhookSubscription, url_prefix="/webhook")

    def _register_routes(self):
        """Register the routes for the blueprint."""
        super()._register_routes()
        self.blueprint.route("/", methods=["POST"])(self.upsert)

    async def upsert(self):
        """Upsert a push webhook."""
        params = await request.get_json()
        id, url, method, headers, params, body, settings = self._parse_webhook_params(
            params
        )

        if not url:
            raise InvalidUsageException(
                "Missing 'url' parameter in webhook subscription",
                status_code=400,
            )
        if not method:
            raise InvalidUsageException(
                "Missing 'method' parameter in webhook subscription",
                status_code=400,
            )

        # Upsert webhook
        with db_session_factory() as db_session:
            if id:
                # update
                if web_hook := WebhookSubscription.get_by(
                    WebhookSubscription.id == id, session=db_session
                ):
                    web_hook.url = url
                    web_hook.method = method
                    web_hook.headers = headers
                    web_hook.params = params
                    web_hook.body = body
                    if settings:
                        web_hook.settings.update_from_dict(settings)
                    db_session.commit()
                    return web_hook.to_dict(), 200
                else:
                    raise InvalidUsageException(
                        f"Webhook with id '{id}' does not exist",
                        status_code=404,
                    )
            # insert
            web_hook = WebhookSubscription(
                url=url,
                method=method,
                headers=headers,
                params=params,
                body=body,
                settings=SubscriptionSettings.from_dict(settings or {}),
            )
            db_session.add(web_hook)
            db_session.commit()

            return web_hook.to_dict(), 201

    def _parse_webhook_params(self, params: Any):
        """Parse the parameters for the webhook subscription."""
        if not isinstance(params, dict):
            raise InvalidUsageException(
                "Invalid parameters provided for webhook subscription",
                status_code=400,
            )

        # Standard PushSubscription fields
        id = pop_query_param(params, "id", str, default=None)
        url = pop_query_param(params, "url", str, default=None)
        method = pop_query_param(params, "method", str, default=None)

        # Optional fields for webhook
        headers = pop_query_param(params, "headers", dict, default=None)
        params = pop_query_param(params, "params", dict, default=None)
        body = pop_query_param(params, "body", dict, default=None)

        # Settings for the webhook
        settings = pop_query_param(params, "settings", dict, default=None)

        return (
            id,
            url,
            method,
            headers,
            params,
            body,
            settings,
        )


class SubscriptionBlueprint(ModelAPIBlueprint[PushSubscription]):
    def __init__(self):
        super().__init__(PushSubscription, url_prefix="/subscription")

    def _register_routes(self):
        """Register the routes for the blueprint."""
        super()._register_routes()
        self.blueprint.route("/", methods=["POST"])(self.upsert)

    async def upsert(self):
        """Upsert a push subscription."""
        params = await request.get_json()
        endpoint, expiration_time, keys, settings = self._parse_subscription_params(
            params
        )

        if not endpoint or not keys:
            raise InvalidUsageException(
                "Missing 'endpoint' or 'keys' parameter in subscription",
                status_code=400,
            )

        # Upsert subscription (id == endpoint)
        with db_session_factory() as db_session:
            if subscription := PushSubscription.get_by(
                PushSubscription.id == endpoint, session=db_session
            ):
                # update
                subscription.keys = keys
                subscription.expiration_time = expiration_time
                if settings:
                    subscription.settings.update_from_dict(settings)
                db_session.commit()
                return subscription.to_dict(), 200

            # insert
            subscription = PushSubscription(
                id=endpoint,
                keys=keys,
                expiration_time=expiration_time,
                settings=SubscriptionSettings.from_dict(settings or {}),
            )
            db_session.add(subscription)
            db_session.commit()
            return subscription.to_dict(), 201

    def _parse_subscription_params(self, params: Any):
        """Parse the parameters for the push API."""
        if not isinstance(params, dict):
            raise InvalidUsageException(
                "Invalid parameters provided for subscription",
                status_code=400,
            )

        # Standard PushSubscription fields
        endpoint = pop_query_param(params, "endpoint", str, default=None)
        expiration_time = pop_query_param(params, "expirationTime", int, default=None)
        keys = pop_query_param(params, "keys", dict, default=None)

        # Extra options for the subscription (i.e. which notifications to receive)
        settings = pop_query_param(params, "settings", dict, default=None)

        if len(params) > 0:
            raise InvalidUsageException(
                "Invalid parameters provided for subscription",
                status_code=400,
            )

        return (
            endpoint,
            expiration_time,
            keys,
            settings,
        )
