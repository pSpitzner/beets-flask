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


class BeetsFlaskConfig(EYConfExtraFields[BeetsSchema]):
    """Base config class with extra fields support."""

    def __init__(self):
        """Initialize the config object with the default values."""
        # Initialize the dataclass fields first

        super().__init__(schema=BeetsSchema, data=BeetsSchema())
        self.reload()

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

    def reload(self) -> Self:
        """Reset the config to default values.

        This loads the user config from yaml files after resetting to defaults.
        """
        super().reset()
        BeetsFlaskConfig.write_examples_as_user_defaults()
        # load user config from yaml.
        # EYConfs update method also validates against the schema
        with open(self.get_beets_config_path(), "r") as f:
            loaded = yaml.safe_load(f)
            if not isinstance(loaded, dict):
                raise ValueError("Beets config is not a valid YAML dictionary.")
            self.update(loaded)

        with open(self.get_beets_flask_config_path(), "r") as f:
            loaded = yaml.safe_load(f)
            if not isinstance(loaded, dict):
                raise ValueError("Beets flask config is not a valid YAML dictionary.")
            self.update(loaded)

        return self

    def commit_to_beets(self) -> None:
        """
        Insert the current state of self into the native beets config.

        Only call manually when needed, i.e. after modifying the config object.
        This is somewhat slow.
        """

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

    def validate(self):
        super().validate()

        # make sure to remove trailing slashes from user configured inbox paths
        # we could also fix this in the frontend, but this was easier.
        for folder in self.data.gui.inbox.folders.values():
            if folder.path.endswith("/"):
                folder.path = folder.path.rstrip("/")
                log.warning(f"Removed trailing slash from inbox path: {folder.path}")

            # Since we changed the autotag type from False to "off" with v1.2.0,
            # Let's fix old configs and warn
            if folder.autotag is False:
                folder.autotag = "off"
                log.warning(
                    f"Updated inbox autotag setting from False to 'off' for inbox: {folder.name}"
                )

    @classmethod
    def write_examples_as_user_defaults(cls):
        """Write example config files if they do not exist yet.

        Note that we also place an opinionated example for beets,
        because it does not do that itself.
        """
        # Load config from default location (set via env var)
        # if it is set otherwise use the default location
        bf_config_path = cls.get_beets_flask_config_path()

        # Check if the user config exists
        # if not, copy the example config to the user config location
        if not os.path.exists(bf_config_path):
            os.makedirs(os.path.dirname(bf_config_path), exist_ok=True)
            # Copy the default config to the user config location
            log.info(f"Beets-flask config not found at {bf_config_path}")
            log.info(f"Copying default config to {bf_config_path}")
            bf_example_path = os.path.join(
                os.path.dirname(__file__), "config_bf_example.yaml"
            )
            shutil.copy2(bf_example_path, bf_config_path)

        # Same check for beets config and copy our default
        # if it does not exist
        beets_config_path = cls.get_beets_config_path()
        if not os.path.exists(beets_config_path):
            os.makedirs(os.path.dirname(beets_config_path), exist_ok=True)
            log.info(f"Beets config not found at {beets_config_path}")
            log.info(f"Copying default config to {beets_config_path}")
            beets_example_path = os.path.join(
                os.path.dirname(__file__), "config_b_example.yaml"
            )
            shutil.copy2(beets_example_path, beets_config_path)

    # ------------------------------ Utility getters ----------------------------- #

    @property
    def beets_config(self) -> beets.IncludeLazyConfig:
        """Convenience property to get the native beets config."""
        # Aavoid calling refresh_confuse here. We often access the beets config,
        # and updating it every time makes things very slow.
        return beets.config

    @property
    def beets_version(self) -> str:
        """Get the current beets version."""
        return beets.__version__

    @property
    def beets_meta_sources(self) -> list[str]:
        """Get the list of enabled metadata source plugins."""
        from beets.metadata_plugins import find_metadata_source_plugins

        return [p.__class__.data_source for p in find_metadata_source_plugins()]

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


config: BeetsFlaskConfig | None = None


def get_config(force_refresh=False) -> BeetsFlaskConfig:
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
        config = BeetsFlaskConfig()
        return config
    if force_refresh:
        config.reset()
        config.commit_to_beets()
    return config
