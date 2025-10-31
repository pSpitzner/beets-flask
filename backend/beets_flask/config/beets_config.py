from __future__ import annotations

import os
import shutil
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Self

import beets
import yaml
from beets.plugins import _instances as plugin_instances
from beets.plugins import get_plugin_names, load_plugins
from eyconf import EYConfExtraFields
from typing_extensions import Literal

from beets_flask.logger import log

from .schema import BeetsSchema


class InteractiveBeetsConfig(EYConfExtraFields[BeetsSchema]):
    """Base config class with extra fields support."""

    def __init__(self):
        """Initialize the config object with the default values."""
        # Initialize the dataclass fields first

        super().__init__(schema=BeetsSchema, data=BeetsSchema())
        self.reset()

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

    def refresh(self) -> Self:
        """Refresh the config from the user config files."""
        self.reset()
        return self

    def reset(self):
        """Reset the config to default values.

        This loads the user config from yaml files after resetting to defaults.
        """
        super().reset()
        InteractiveBeetsConfig.write_examples_as_user_defaults()
        # load user config from yaml.
        # EYConfs update method also validates against the schema
        with open(self.get_beets_config_path(), "r") as f:
            self.update(yaml.safe_load(f))

        with open(self.get_beets_flask_config_path(), "r") as f:
            self.update(data=yaml.safe_load(f))

    def refresh_confuse(self) -> None:
        """Dump the current state of self into beets."""

        beets.config.clear()
        beets.config.read()

        # Put our defaults that come from schema at lowest priority
        beets.config.add(asdict(BeetsSchema()))

        # Inserts user config into confuse
        beets.config.set(self.to_dict(True))

        # Hack: We have to manually load the plugins as this
        # is normally done by beets. Clear the list to force
        # actual reload.
        plugin_instances.clear()
        load_plugins()
        log.debug(f"Loading plugins: {get_plugin_names()}")

        # Beets config "Singleton" is not a real singleton, there might be copies
        # in different submodules - we need to update all of them.
        # TODO: I think we can remove this
        for module_name, mod in list(sys.modules.items()):
            if mod is None:
                continue

            if not (
                module_name.startswith("beets")  # includes beets and beetsplug
            ):
                continue

            for attr_name in dir(mod):
                try:
                    if getattr(mod, attr_name) is beets.config:
                        setattr(mod, attr_name, beets.config)
                        log.debug(f"Updated config in {module_name}.{attr_name}")
                except Exception as e:
                    log.debug(f"Could not check {module_name}.{attr_name}", exc_info=e)
                    continue

    def to_confuse(self) -> beets.IncludeLazyConfig:
        """Dump the current state of self into beets config."""
        self.refresh_confuse()
        return beets.config

    def validate(self):
        # beets does not create a config file automatically for the user.
        # Customizations are added as extra layers on the config.
        super().validate()

        # make sure to remove trailing slashes from user configured inbox paths
        # we could also fix this in the frontend, but this was easier.
        for folder in self.data.gui.inbox.folders.values():
            if folder.path.endswith("/"):
                folder.path = folder.path.rstrip("/")
                log.debug(f"Removed trailing slash from inbox path: {folder.path}")

    @classmethod
    def write_examples_as_user_defaults(cls):
        """Write example config files if they do not exist yet."""
        # Load config from default location (set via env var)
        # if it is set otherwise use the default location
        bf_config_path = cls.get_beets_flask_config_path()

        # Check if the user config exists
        # if not, copy the example config to the user config location
        if not os.path.exists(bf_config_path):
            os.makedirs(os.path.dirname(bf_config_path), exist_ok=True)
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
            os.makedirs(os.path.dirname(beets_config_path), exist_ok=True)
            log.debug(f"Beets config not found at {beets_config_path}")
            log.debug(f"Copying default config to {beets_config_path}")
            beets_example_path = os.path.join(
                os.path.dirname(__file__), "config_b_example.yaml"
            )
            shutil.copy2(beets_example_path, beets_config_path)

    # ------------------------------ Utility getters ----------------------------- #

    @property
    def ignore_globs(self) -> list[str]:
        """
        Get the list of ignore globs from the config.

        If user does not set this in their beets flask config, we use whats in beets.
        (We do this via a placeholder string "_use_beets_ignore")
        If the user sets an empty list [], that means no files are ignored.
        """
        gui_globs: list[str] | Literal["_use_beets_ignore"] = self.data.gui.inbox.ignore
        if gui_globs is None or gui_globs == "_use_beets_ignore":
            gui_globs = self.data.ignore
        return gui_globs


config: InteractiveBeetsConfig | None = None


def get_config(force_refresh=False) -> InteractiveBeetsConfig:
    """Get the config object.

    This is useful if you want to access the config from another module.

    The result of this function is still the global object that you can mutate!

    Parameters
    ----------
    force_refresh : bool
        Force a refresh of the config object, including the global beets config.

    """
    global config

    if config is None:
        config = InteractiveBeetsConfig()
        return config
    if force_refresh:
        config.reset()
        config.refresh_confuse()
    return config
