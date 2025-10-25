"""
New design approach so we get typed configs:

We have our custom class, which is based on dataclass and needs to provide
schema.

It is constructed from confuse and then validated.

It also provides a `.to_beets()` method to get something we can feed back.
"""

from __future__ import annotations
from dataclasses import asdict, fields, is_dataclass
import os
from pathlib import Path
import shutil
import sys
import beets
from typing import Any, cast, get_args, get_origin

from beets import IncludeLazyConfig
from beets.plugins import _instances as plugin_instances
from beets.plugins import get_plugin_names, load_plugins
from confuse import YamlSource

from beets_flask.logger import log

from .beets_config_schema import BeetsFlaskSchema, BeetsSchema, validate

from .type_shenanigans import (
    Singleton,
    AttributeDict,
    dict_to_dataclass_generic,
    dict_to_dataclass_with_known_schema,
)


class BeetsFlaskConfig(BeetsSchema, metaclass=Singleton):
    # For backwards compatibility, we keep a confuse-based config around
    # It's just the default beets config, with our custom entries added
    _beets_config: IncludeLazyConfig

    def __init__(self, *args, **kwargs):
        """Initialize the config object with the default values.

        Loads config and some beets flask specific tweaks.
        """
        # Initialize the dataclass fields first
        super().__init__(*args, **kwargs)
        self._beets_config = IncludeLazyConfig("beets", "beets")

    def reload(self):
        self._beets_config.clear()
        self._beets_config.read()

        # Inserts user config at highest priority into confuse
        self._beets_config.set(
            YamlSource(self.get_beets_flask_config_path(), default=False)
        )

    def update_from_dict(self, data: dict[str, Any]) -> None:
        """
        Recursively set dataclass attributes from a dictionary.

        Preserves typing of our schema when possible and handles
        nested dataclasses.

        This will completely overwrite all values we hold!
        """
        dict_to_dataclass_with_known_schema(
            schema=BeetsSchema, data=data, existing_instance=self
        )

    def validate(self):
        # beets does not create a config file automatically for the user.
        # Customizations are added as extra layers on the config.
        sources = [s for s in beets.config["directory"].resolve()]
        if len(sources) == 1:
            log.debug(
                "Beets is not using a user config. Overwriting the default `directory`."
            )
            self._beets_config["directory"] = "/music/imported"

        # make sure to remove trailing slashes from user configured inbox paths
        for folder in self.gui.inbox.folders.values():
            if folder.path.endswith("/"):
                folder.path = folder.path.rstrip("/")
                log.debug(f"Removed trailing slash from inbox path: {folder.path}")

    @classmethod
    def get_beets_flask_config_path(cls) -> Path:
        """Get the path to the beets-flask config file."""
        bf_folder = os.getenv(
            "BEETSFLASKDIR", os.path.expanduser("~/.config/beets-flask")
        )
        return Path(bf_folder) / "config.yaml"

    @classmethod
    def get_beets_config_path(cls) -> Path:
        """Get the path to the beets config file."""
        beets_folder = os.getenv("BEETSDIR", os.path.expanduser("~/.config/beets"))
        return Path(beets_folder) / "config.yaml"

    @classmethod
    def write_examples(cls):
        # Load config from default location (set via env var)
        # if it is set otherwise use the default location
        bf_config_path = cls.get_beets_flask_config_path()

        # Check if the user config exists
        # if not, copy the example config to the user config location
        if not os.path.exists(bf_config_path):
            # Copy the default config to the user config location
            log.debug(f"Beets-flask config not found at {bf_config_path}")
            log.debug(f"Copying default config to {bf_config_path}")
            bf_example_path = os.path.join(
                os.path.dirname(__file__), "config_bf_example.yaml"
            )
            shutil.copy2(bf_example_path, bf_config_path)

        # Same check for beets config and copy our default
        # if it does not exist
        beets_config_path = cls.get_beets_config_path()
        if not os.path.exists(beets_config_path):
            log.debug(f"Beets config not found at {beets_config_path}")
            log.debug(f"Copying default config to {beets_config_path}")
            beets_example_path = os.path.join(
                os.path.dirname(__file__), "config_b_example.yaml"
            )
            shutil.copy2(beets_example_path, beets_config_path)
