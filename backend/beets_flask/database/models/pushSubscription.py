from sqlalchemy.orm import Mapped

from .base import Base


class PushSubscription(Base):
    __tablename__ = "push_subscription"

    # id==endpoint
    keys: Mapped[dict[str, str]]
    expiration_time: Mapped[int | None]

    def __init__(
        self,
        id: str,
        keys: dict[str, str] | None = None,
        expiration_time: int | None = None,
    ):
        """
        Initialize a PushSubscription instance.

        :param id: The unique identifier for the subscription, typically the endpoint.
        :param kwargs: Additional keyword arguments for keys and expiration_time.
        """
        super().__init__(id=id)
        self.keys = keys or {}
        self.expiration_time = expiration_time

    @property
    def endpoint(self) -> str:
        """
        Convenience property to get the id.

        Note: Although the id is just the endpoint, when querying the db, you **must** use `FolderInDb.id == endpoint`. Sqlalchemy does not resolve properties.
        """
        return self.id
