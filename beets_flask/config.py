"""
Configuration.
Currently we only support setting config values via environment variables in the Docker compose.

Use double underscore to separate nested values:
https://confuse.readthedocs.io/en/latest/usage.html#environment-variables

# Example:

```bash
export BF_FOO__BAR=first
```

```python
from beets_flask.config import config
print(config["foo"]["bar"].get(default="default_value"))
```
"""

from beets_flask.utility import log

import confuse
config = confuse.Configuration('beets-flask')
config.set_file("/repo/configs/beets_flask_default.yaml")
config.set_env(prefix='BF')


# TODO: lets also add the native beets config for easier access
# PS 24-06-10: did not figure out how to add/merge two loaded configurations.
# Potentially better idea: make our config part of the beets config.
