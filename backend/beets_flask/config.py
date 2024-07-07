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
from beets_flask.utility import log
from beets import config

config.set_env(prefix="BF")

try:
    # docker container
    default_source = confuse.YamlSource("/repo/configs/default.yaml", default=True)
except confuse.ConfigReadError:
    # running as module. but we should place the default config where confuse looks for it.
    default_source = confuse.YamlSource("./configs/default.yaml", default=True)
config.add(default_source)  # .add inserts with lowest priority
