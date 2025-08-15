"""Overload for beets configuration.

We support setting config values either via your beets config file, under the `gui` section, or via environment variables in the Docker compose.

Use double underscore to separate nested values:
https://confuse.readthedocs.io/en/latest/usage.html#environment-variables

We prefix all environment variables with `IB` to avoid conflicts with other services.

To set a custom file path to a yaml that gets inserted into (and overwrites) the
beets config, set the `IB_GUI_CONFIGPATH` environment variable.
Note that this does not remove list keys from the lower priority default config
(e.g. if you configure different inbox folders in your beets config, and the ib config,
all of them will be added).

# Example:

```bash
export IB_GUI__TAGS=first
```

```python
from beets_flask.beets_config.config import config
print(config["gui"]["tags"].get(default="default_value"))
```
"""

import os
from typing import cast

from beets import IncludeLazyConfig as BeetsConfig
from beets.plugins import load_plugins
from confuse import YamlSource

from beets_flask.logger import log


def _copy_file(src, dest):
    with open(src, "r") as src_file, open(dest, "w") as dest_file:
        dest_file.write(src_file.read())


class Singleton(type):
    _instances: dict = {}

    def __call__(cls, *args, **kwargs):
        """Singleton pattern implementation."""
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


class InteractiveBeetsConfig(BeetsConfig, metaclass=Singleton):
    """Singleton class to handle the beets config.

    This class is a subclass of the beets config and adds some
    interactive beets specific functionality.
    """

    def __init__(self):
        """Initialize the config object with the default values.

        Loads config and some interactive beets specific tweaks.
        """
        super().__init__("beets", "beets")
        self.reset()

    def reset(self):
        """Recreate the config object.

        As if the app was just started.
        """
        # vanilla beets reset
        log.debug(f"Reading beets config from default location")
        self.clear()
        self.read()

        # read the default config just in case the user config is missing
        # or malformed
        ib_defaults_path = os.path.join(
            os.path.dirname(__file__), "config_bf_default.yaml"
        )
        log.debug(f"Reading IB config defaults from {ib_defaults_path}")
        default_source = YamlSource(ib_defaults_path, default=True)
        self.add(default_source)  # .add inserts with lowest priority

        # then apply our needed tweaks
        # enable env variables
        self.set_env(prefix="IB")

        # Load config from default location (set via env var)
        # if it is set otherwise use the default location
        ib_folder = os.getenv("BEETSFLASKDIR")
        if ib_folder is None:
            ib_folder = os.path.expanduser("~/.config/beets-flask")
        ib_config_path = os.path.join(ib_folder, "config.yaml")

        # Check if the user config exists
        # if not, copy the example config to the user config location
        if not os.path.exists(ib_config_path):
            # Copy the default config to the user config location
            log.debug(f"Beets-flask config not found at {ib_config_path}")
            log.debug(f"Copying default config to {ib_config_path}")
            os.makedirs(ib_folder, exist_ok=True)
            ib_example_path = os.path.join(
                os.path.dirname(__file__), "config_bf_example.yaml"
            )
            _copy_file(ib_example_path, ib_config_path)

        # Same check for beets config and copy our default
        # if it does not exist
        # TODO: maybe there is a beets function to get the path
        beets_folder = os.getenv("BEETSDIR")
        if beets_folder is None:
            beets_folder = os.path.expanduser("~/.config/beets")
        beets_config_path = os.path.join(beets_folder, "config.yaml")
        if not os.path.exists(beets_config_path):
            log.debug(f"Beets config not found at {beets_config_path}")
            log.debug(f"Copying default config to {beets_config_path}")
            beets_example_path = os.path.join(
                os.path.dirname(__file__), "config_b_example.yaml"
            )
            _copy_file(beets_example_path, beets_config_path)

        # Inserts user config at highest priority
        log.debug(f"Reading beets-flask config from {ib_config_path}")
        self.set(YamlSource(ib_config_path, default=False))

        # add placeholders for required keys if they are not configured,
        # so the docker container starts and can show some help.

        # beets does not create a config file automatically for the user. Customizations are added as extra layers on the config.
        sources = [s for s in beets.config["directory"].resolve()]
        if len(sources) == 1:
            log.debug(
                "Beets is not using a user config. Overwriting the default `directory`."
            )
            self["directory"] = "/music/imported"

        # TODO: would be nice to have this in the default config,
        # and simply remove it here if other inbox folders have been configured.
        # but: I do not know how to remove (some) elements from a confuse config.
        if len(self["gui"]["inbox"]["folders"].keys()) == 0:
            self["gui"]["inbox"]["folders"]["Placeholder"] = {
                "name": "Please check your config!",
                "path": "/music/inbox",
                "autotag": False,
            }

    @property
    def ignore_globs(self) -> list[str]:
        """
        Get the list of ignore globs from the config.

        If user does not set this in their beets flask config, we use whats in beets.
        (We do this via a placeholder string "_use_beets_ignore")
        If the user sets an empty list [], that means no files are ignored.

        """
        gui_globs: list[str] | str = get_config()["gui"]["inbox"]["ignore"].get()  # type: ignore
        if gui_globs is None or gui_globs == "_use_beets_ignore":
            gui_globs: list[str] = self["ignore"].as_str_seq()  # type: ignore
        elif isinstance(gui_globs, str):
            gui_globs = [gui_globs]
        elif isinstance(gui_globs, list):
            gui_globs = gui_globs
        return cast(list[str], gui_globs)


# Monkey patch the beets config
import beets

config: InteractiveBeetsConfig | None = None


def refresh_config():
    """Refresh the config object.

    This is useful if you want to reload the config after it has been changed.
    """
    global config

    config = InteractiveBeetsConfig()

    # Hack: We have to manually load the plugins as this
    # is normally done by beets
    plugin_list = config["plugins"].as_str_seq()
    load_plugins(plugin_list)
    log.debug(f"Loading plugins: {plugin_list}")

    beets.config = config
    return config


def get_config(force_refresh=False) -> InteractiveBeetsConfig:
    """Get the config object.

    This is useful if you want to access the config from another module.

    The result of this function is still the global object that you can mutate!

    Parameters
    ----------
    force_refresh : bool
        Force a refresh of the config object.
        This is useful if you want to be sure that the config is up to date,
        should normally only be called if the config was changed in another process.
    """
    global config

    if config is None or force_refresh:
        return refresh_config()
    return config


__all__ = ["refresh_config", "get_config"]

# raise NotImplementedError("This module should not be imported.")
