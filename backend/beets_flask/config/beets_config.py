"""
Configuration.
We support setting config values either via your beets config file, under the `gui` section, or via environment variables in the Docker compose.

Use double underscore to separate nested values:
https://confuse.readthedocs.io/en/latest/usage.html#environment-variables

We prefix all environment variables with `IB` to avoid conflicts with other services.

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


# Config location from environment or default
BEETS_CONFIG_PATH = os.getenv(
    "BEETS_CONFIG_PATH",
    f"{os.getcwd()}/configs/interactive_beets.yaml",
)


class Singleton(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        """Singleton pattern implementation"""
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


class InteractiveBeetsConfig(BeetsConfig, metaclass=Singleton):
    """
    Singleton class to handle the beets config. This class is a subclass of the beets config and adds some interactive beets specific functionality.
    """

    def __init__(self):
        """
        Initialize the config object with the default config and some interactive beets specific tweaks.
        """
        super().__init__("beets", "beets")
        self.reset()

    def reset(self):
        """
        Recreate the config object as if the app was just started.
        """
        # vanilla beets reset
        self.clear()
        self.read()

        # add placeholders for required keys these are overwritten by the default config
        self["directory"] = "/music/imported"
        self["gui"]["inbox"]["folders"]["Placeholder"] = {
            "name": "Please check your config!",
            "path": "/music/inbox",
            "autotag": False,
        }

        # get the default config from server config
        try:
            log.debug(f"Reading default config from {BEETS_CONFIG_PATH}")
            default_source = YamlSource(BEETS_CONFIG_PATH, default=True)
            self.set(default_source)  # .set inserts with highest priority
        except ConfigReadError:
            log.warning(
                f"Could not read default config from {BEETS_CONFIG_PATH}. "
                "Please check the path or set BEETS_CONFIG_PATH in the environment."
            )

        # then apply our needed tweaks
        # enable env variables
        self.set_env(prefix="IB")


# Monkey patch the beets config
import beets

config = InteractiveBeetsConfig()
beets.config = config
