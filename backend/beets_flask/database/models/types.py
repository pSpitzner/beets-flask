import json
from typing import Any

from sqlalchemy import types


class DictType(types.TypeDecorator):
    """Stores a dict[str, Any] as a JSON-encoded string in the database.

    Allows for flexible storage of dictionaries with string keys and values of
    any (serializable) type.
    """

    impl = types.Text
    cache_ok = True

    allowed_types = (int, str)
    allowed_keys_types: tuple[type, ...] = (str,)
    allowed_values_types: tuple[type | Any, ...] = (Any,)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, dict) or not all(
            isinstance(k, self.allowed_types) and isinstance(v, self.allowed_types)
            for k, v in value.items()
        ):
            raise ValueError("Value must be a dict[int|str, int|str].")
        if not isinstance(value, dict):
            raise ValueError("Value must be a dict")

        # Any type needs some special handling
        allowed_types_v: tuple[type, ...] = tuple(
            filter(lambda x: x is not Any, self.allowed_types_values)
        )

        if not len(allowed_types_v) == 0:
            if not all(isinstance(v, allowed_types_v) for v in value.values()):
                raise ValueError(
                    f"Value must be a dict with values of type {allowed_types_v}."
                )

        if not all(isinstance(k, self.allowed_keys_types) for k in value.keys()):
            raise ValueError(f"Keys must be of type {self.allowed_keys_types}.")

        return json.dumps({str(k): v for k, v in value.items()})

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return json.loads(value)

    def copy(self, **kw):
        return self.__class__(self.impl.length)  # type: ignore


class IntDictType(DictType):
    """Stores a dict[int, int] as a JSON-encoded string in the database."""

    allowed_types = (int,)
    allowed_keys_types = (int,)
    allowed_values_types = (str,)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return {int(k): int(v) for k, v in json.loads(value).items()}


class StrDictType(DictType):
    """Stores a dict[str, str] as a JSON-encoded string in the database."""

    allowed_keys_types = (str,)
    allowed_values_types = (str,)
