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

        # do we still want the IB_GUI_CONFIGPATH var? e.g. for tests?
        # SM: I would still prefer to load the file from '/config/gui.yaml' in the container
        ib_config_path = os.getenv("IB_GUI_CONFIGPATH")
        ib_folder = os.getenv("BEETSFLASKDIR")
        if ib_config_path is None and ib_folder is not None:
            ib_config_path = os.path.join(ib_folder, "config.yaml")

        if os.path.exists(ib_config_path):
            # set inserts at highest priority
            log.debug(f"Reading IB custom config from {ib_config_path}")
            self.set(YamlSource(ib_config_path, default=False))
        else:
            log.debug("No dedicated gui config found")

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


# Monkey patch the beets config
import beets

config = InteractiveBeetsConfig()
beets.config = config
