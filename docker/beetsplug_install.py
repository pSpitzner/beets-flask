from dataclasses import dataclass
import os
from pathlib import Path
import yaml

import logging

log = logging.getLogger("Auto beetsplugin installer")


beets_dir = os.environ.get("BEETSDIR")
beets_flask_dir = os.environ.get("BEETSFLASKDIR")


@dataclass
class Dependency:
    name: str
    version: str
    url: str
    beets_extra: bool = False


# TODO
plugins_to_dependencies = dict()


def get_plugins_from_yaml(file: Path) -> list:
    if not Path(file).exists():
        return []
    with open(file, "r") as f:
        plugins = yaml.safe_load(f).get("plugins", [])
    return plugins


if __name__ == "__main__":
    if beets_dir is None:
        log.warning("BEETSDIR not set! Skipping auto plugin installation...")
        exit(1)

    config_path = Path(beets_dir) / "config.yaml"
    plugins = get_plugins_from_yaml(config_path)

    for plugin in plugins:
        dep = plugins_to_dependencies.get(plugin)
        if dep is not None:
            # TODO
            # Check if is installed
            # Install
            pass
        else:
            log.debug(f"Dependency for {plugin} not required! Skipping...")
