from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Mapping

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class SubscriptionSettings(Base):
    """Represents options for a push subscription.

    This class is used to store additional options for a push subscription,
    such as when to trigger this notification.
    """

    __tablename__ = "push_settings"

    is_active: Mapped[bool]

    def __init__(self, is_active: bool = True):
        super().__init__()
        self.is_active = is_active

    def update_from_dict(self, data: dict[str, Any]):
        """Update the PushSettings instance from a dictionary.

        None values are ignored.
        """
        is_active = data.get("is_active")
        self.is_active = is_active if is_active is not None else self.is_active

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SubscriptionSettings:
        """Create a PushSettings instance from a dictionary."""
        instance = cls()
        instance.update_from_dict(data)
        return instance


class PushSubscription(Base):
    """Represents a push subscription.

    Expects push subscriptions in Web Push API,
    https://developer.mozilla.org/en-US/docs/Web/API/Push_API.
    """

    __tablename__ = "push_subscription"

    # id==endpoint
    keys: Mapped[dict[str, str]]
    expiration_time: Mapped[int | None]

    # Settings on when to trigger this
    settings_id: Mapped[str] = mapped_column(ForeignKey("push_settings.id"), index=True)
    settings: Mapped[SubscriptionSettings] = relationship(
        foreign_keys=[settings_id], cascade="all"
    )

    def __init__(
        self,
        id: str,
        keys: dict[str, str] | None = None,
        expiration_time: int | None = None,
        settings: SubscriptionSettings | None = None,
    ):
        super().__init__(id=id)
        self.keys = keys or {}
        self.expiration_time = expiration_time
        self.settings = settings or SubscriptionSettings()

    @property
    def endpoint(self) -> str:
        """
        Convenience property to get the id.

        Note: Although the id is just the endpoint, when querying the db, you **must** use `PushSubscription.id == endpoint`. Sqlalchemy does not resolve properties.
        """
        return self.id

    def to_dict(self) -> Mapping:
        col_map = super().to_dict()
        return {
            **col_map,
            "settings": self.settings.to_dict(),
        }


class WebhookType(Enum):
    WEBPUSH = 0


class WebhookSubscription(Base):
    """Webhook handlers for push notifications.

    Additionally to :class:`PushSubscription`, this class can be used to handle push notifications
    to generic endpoints, such as a webhook URL.
    """

    __tablename__ = "push_webhooks"

    type: Mapped[WebhookType]
    # Required fields for push webhooks
    url: Mapped[str]
    method: Mapped[str]  # e.g., "POST", "GET"

    # Optional fields for push webhooks
    headers: Mapped[dict[str, str] | None]
    params: Mapped[dict[str, str] | None]
    body: Mapped[dict[str, Any] | None]

    # Settings on when to trigger this
    settings_id: Mapped[str] = mapped_column(ForeignKey("push_settings.id"), index=True)
    settings: Mapped[SubscriptionSettings] = relationship(
        foreign_keys=[settings_id], cascade="all"
    )

    def __init__(
        self,
        url: str,
        method: str = "POST",
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
        settings: SubscriptionSettings | None = None,
    ):
        """Initialize a PushWebHooks instance."""
        super().__init__()
        self.type = WebhookType.WEBPUSH
        self.url = url
        self.method = method
        self.headers = headers
        self.params = params
        self.body = body
        self.settings = settings or SubscriptionSettings()

    def to_dict(self) -> Mapping:
        col_map = super().to_dict()
        return {
            **col_map,
            "settings": self.settings.to_dict(),
        }
