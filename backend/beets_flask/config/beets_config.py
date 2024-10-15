"""Overload for beets configuration.

We support setting config values either via your beets config file, under the `gui` section, or via environment variables in the Docker compose.

Use double underscore to separate nested values:
https://confuse.readthedocs.io/en/latest/usage.html#environment-variables

We prefix all environment variables with `IB` to avoid conflicts with other services.

To set a custom file path to a yaml that gets inserted into (and overwrites) the
beets config, set the `IB_GUI__CONFIGPATH` environment variable.

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

from beets import IncludeLazyConfig as BeetsConfig
from confuse import ConfigReadError, YamlSource

from beets_flask.logger import log


class Singleton(type):
    _instances = {}

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

        # these are defaults!
        ib_defaults_path = os.path.join(
            os.path.dirname(__file__), "config_default.yaml"
        )
        log.debug(f"Reading IB config defaults from {ib_defaults_path}")

        default_source = YamlSource(ib_defaults_path, default=True)
        self.add(default_source)  # .add inserts with lowest priority

        # then apply our needed tweaks
        # enable env variables
        self.set_env(prefix="IB")

        ib_custom_path = self["gui"]["configpath"].as_path()
        if ib_defaults_path is not None:
            # set inserts at highest priority
            log.debug(f"Reading IB custom config from {ib_custom_path}")
            self.set(YamlSource(ib_custom_path, default=False))

        # TODO: check if beets created the config if it does not exist
        # and what the default directory is. -> should be consistent with out container

        # add placeholders for required keys if they are not configured,
        # so the docker container starts and can show some help.
        if not os.path.exists("/home/beetle/.config/beets/config.yaml"):
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


# Monkey patch the beets config
import beets

config = InteractiveBeetsConfig()
beets.config = config
