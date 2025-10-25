"""
Typing Helpers.

They allow us to model the dualistic view: the native beets config via confuse
(based on dictionaries) and our typed beets flask config based on dataclasses.

We give dataclasses the ability to be typed via schemas, while also holding
dynamic attributes. With dynamic attributes we mean key/value pairs stored as
attributes of an instance, that are not part of a predefined schema.

This allows us to add unknown keys to our schema-based dataclasses (in json this
corresponds to additional properties). Importantly, using this we get:
- dot-notation access with type-hints for _known_ keys
- dot-notation access for _unknown_ keys, but with type errors

"""

from dataclasses import dataclass, fields, is_dataclass
import re
from typing import Any, Dict, Type, TypeVar, get_args, get_origin

from eyconf.type_utils import get_type_hints_resolve_namespace

T = TypeVar("T")


def enhanced_repr(obj: Any) -> str:
    """Create an enhanced __repr__ for dataclass instances with dynamic attributes.

    Shows schema fields normally and dynamic attributes with a * prefix.

    Parameters
    ----------
    obj: A dataclass instance (potentially with dynamic attributes)

    Returns
    -------
    A string representation showing both schema and dynamic attributes
    """
    # Get schema fields
    schema_attrs = {}
    if is_dataclass(obj):
        for field in fields(obj):
            schema_attrs[field.name] = getattr(obj, field.name)

    # Get dynamic attributes
    dynamic_attrs = {}
    schema_field_names = set(schema_attrs.keys())
    for attr_name in dir(obj):
        if (
            not attr_name.startswith("_")
            and attr_name not in schema_field_names
            and not callable(getattr(obj, attr_name))
        ):
            dynamic_attrs[attr_name] = getattr(obj, attr_name)

    # Format representation with * prefix for dynamic attributes
    attr_parts = []
    for k, v in schema_attrs.items():
        attr_parts.append(f"{k}={repr(v)}")

    for k, v in dynamic_attrs.items():
        attr_parts.append(f"*{k}={repr(v)}")

    attrs_str = ", ".join(attr_parts)
    res = f"{type(obj).__name__}({attrs_str})"

    # Pretty print with proper indentation
    return __format_with_indentation(res)


class Singleton(type):
    _instances: dict = {}

    def __call__(cls, *args, **kwargs):
        """Singleton pattern implementation."""
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


def mixed_dataclass(cls: Type[T]) -> Type[T]:
    """Decorator to create a dataclass with enhanced __repr__ with dynamic attributes.

    This replaces the need for separate @dataclass and @mixed_dataclass_repr decorators.

    Usage:
        @mixed_dataclass
        class MyConfig:
            schema_field: str = "default"
    """
    # First apply the dataclass decorator
    dataclass_cls = dataclass(cls)

    # Then add the enhanced repr using the standalone function
    def __repr__(self) -> str:
        return enhanced_repr(self)

    # Add convenience method for converting to dict
    def to_dict(self) -> dict:
        return mixed_dataclass_to_dict(self)

    setattr(dataclass_cls, "__repr__", __repr__)
    setattr(dataclass_cls, "to_dict", to_dict)
    # We get type errors for .to_dict() though. I guess that's why there is
    # dataclasses asdict() which is called from the outside.
    # Also good bug turned feature: using our constructor, we get a type error on
    # the default asdict() method - which is nice, since one likely wants to use
    # our version?
    return dataclass_cls


@mixed_dataclass
class AttributeDict:
    """A generic dataclass for holding dynamic attributes."""


def dict_to_dataclass_generic(data: Dict[str, Any]) -> AttributeDict:
    """Convert a dictionary to a dynamic dataclass-like object without schema validation.

    Access keys via . notation.
    """
    if not isinstance(data, dict):
        return data

    obj = AttributeDict()
    for key, value in data.items():
        if isinstance(value, dict):
            setattr(obj, key, dict_to_dataclass_generic(value))
        else:
            setattr(obj, key, value)

    return obj


def dict_to_dataclass_with_known_schema(
    schema: Type[T], data: Dict[str, Any], existing_instance=None
) -> T:
    """Convert a dictionary to a dataclass using a known schema, falling back to generic for unknown keys.

    If `existing_instance` is provided, it will be modified in place.
    """
    if not isinstance(data, dict):
        return data

    # Get field types for the dataclass
    field_types = get_type_hints_resolve_namespace(
        schema,
        include_extras=True,
    )

    # Process known fields
    kwargs = {}
    for field_name in field_types:
        if field_name in data:
            field_type = field_types[field_name]

            if is_dataclass(field_type):
                # If updating existing instance, check if field already exists
                if existing_instance is not None and hasattr(
                    existing_instance, field_name
                ):
                    existing_field_value = getattr(existing_instance, field_name)

                    kwargs[field_name] = dict_to_dataclass_with_known_schema(
                        field_type, data[field_name], existing_field_value
                    )
                else:
                    kwargs[field_name] = dict_to_dataclass_with_known_schema(
                        field_type, data[field_name], None
                    )

            # Handle Dict[str, SomeDataclass] types
            elif get_origin(field_type) is dict and len(get_args(field_type)) == 2:
                key_type, value_type = get_args(field_type)
                if is_dataclass(value_type):
                    # Convert each value in the dictionary
                    converted_dict = {}
                    for key, value in data[field_name].items():
                        converted_dict[key] = dict_to_dataclass_with_known_schema(
                            value_type, value, None
                        )
                    kwargs[field_name] = converted_dict
                else:
                    kwargs[field_name] = data[field_name]
            else:
                kwargs[field_name] = data[field_name]

    # Create or update the dataclass instance
    if existing_instance is None:
        instance = schema(**kwargs)
    else:
        for field_name, value in kwargs.items():
            setattr(existing_instance, field_name, value)
        instance = existing_instance

    # Add any unknown fields as dynamic attributes using the generic function
    for key, value in data.items():
        if key not in field_types:
            setattr(instance, key, dict_to_dataclass_generic(value))

    return instance


def mixed_dataclass_to_dict(obj: Any) -> Any:
    """Convert a dataclass with mixed-in dynamic attributes into a dictionary.

    Recursively handles both schema fields and dynamic attributes from AttributeDict.
    Works with nested dataclasses and AttributeDict objects.
    """
    if isinstance(obj, AttributeDict):
        # For AttributeDict, convert all attributes to dict
        result = {}
        for key, value in obj.__dict__.items():
            if not key.startswith("_"):
                result[key] = mixed_dataclass_to_dict(value)
        return result

    elif is_dataclass(obj):
        # For dataclasses, get both schema fields and any dynamic attributes
        result = {}

        # Get schema fields first
        for field in fields(obj):
            value = getattr(obj, field.name)
            result[field.name] = mixed_dataclass_to_dict(value)

        # Get any dynamic attributes (not in schema)
        schema_field_names = {field.name for field in fields(obj)}
        for attr_name in dir(obj):
            if (
                not attr_name.startswith("_")
                and attr_name not in schema_field_names
                and not callable(getattr(obj, attr_name))
            ):
                value = getattr(obj, attr_name)
                result[attr_name] = mixed_dataclass_to_dict(value)

        return result

    elif isinstance(obj, (list, tuple)):
        # Handle sequences
        return [mixed_dataclass_to_dict(item) for item in obj]

    elif isinstance(obj, dict):
        # Handle regular dictionaries
        return {k: mixed_dataclass_to_dict(v) for k, v in obj.items()}

    else:
        # Return primitive values as-is
        return obj


def __format_with_indentation(text: str) -> str:
    """Format text with proper indentation for nested structures."""

    # use re.split to separte by ({,}) which are not inside '' pairs
    split = re.split(r"([{,}()\]\[])(?=(?:[^']*'[^']*')*[^']*$)", text)
    split = [s.strip() for s in split if s.strip()]

    indent = 0
    res = []

    for i, el in enumerate(split):
        if el in "[({":
            # Add the opening bracket/paren
            # res.append("    " * indent + el)
            indent += 1
            res.append(el)
            # Add newline after opening bracket/paren
            res.append("\n")
        elif el in ")}]":
            # Decrease indentation before closing bracket/paren
            res.append("\n")
            indent = max(0, indent - 1)
            res.append("    " * indent + el)
        elif el == ",":
            # Add comma and newline
            res.append(el)
            res.append("\n")
        else:
            # Regular content, add with current indentation
            if el:  # Only add non-empty elements
                res.append("    " * indent + el)

    return "".join(res).strip()
