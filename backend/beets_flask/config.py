"""
Configuration.
We support setting config values either via your beets config file, under the `gui`
section, or via environment variables in the Docker compose.

Use double underscore to separate nested values:
https://confuse.readthedocs.io/en/latest/usage.html#environment-variables

# Example:

```bash
export BF_GUI__TAGS=first
```

```python
from beets_flask.config import config
print(config["gui"]["tags"].get(default="default_value"))
```
"""

import confuse
import os
import beets

from beets_flask.logger import log

log.debug("Applying config")


class CustomizedConfig(beets.IncludeLazyConfig):

    def __init__(self):
        # there is only one use-case: creating the beets config and adding our defaults.
        super().__init__("beets", "beets")
        self.reset()

    def reset(self):
        """
        Recreate the config object as if the app was just started.
        """
        # vanilla reset
        self.clear()
        self.read()

        # insert out defaults on top of beets
        try:
            # docker container
            default_source = confuse.YamlSource(
                "/repo/configs/default.yaml", default=True
            )
        except confuse.ConfigReadError:
            # running as module. but we should place the default config where confuse looks for it.
            default_source = confuse.YamlSource("./configs/default.yaml", default=True)
        self.add(default_source)  # .add inserts with lowest priority

        # then apply our needed tweaks
        # enable env variables
        self.set_env(prefix="BF")

        # add placeholders for required keys if they are not configured,
        # so the docker container starts and can show some help.
        if not os.path.exists("/home/beetle/.config/beets/config.yaml"):
            self["directory"] = "/music/imported"

        if len(self["gui"]["inbox"]["folders"].keys()) == 0:
            self["gui"]["inbox"]["folders"]["Placeholder"] = {
                "name": "Please check your config!",
                "path": "/music/inbox",
                "autotag": False,
            }


config = CustomizedConfig()
beets.config = config
