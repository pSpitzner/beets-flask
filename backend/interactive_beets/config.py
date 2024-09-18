# ---------------------------------------------------------------------------- #
#                                 ServerConfig                                 #
# ---------------------------------------------------------------------------- #
import pathlib

from .logger import log


class ServerConfig:
    DEBUG = False
    TESTING = False

    # If the database should be reset on start
    # Useful for development
    RESET_DB_ON_START = False

    # If errors should be thrown or
    # caught and logged
    # Enable for production!
    PROPAGATE_EXCEPTIONS = False

    # Database URI
    DATABASE_URI = "sqlite:///beets-flask-sqlite.db"

    # Not sure if this is even used!
    SECRET_KEY = "secret"

    def as_dict(self) -> dict:
        return {
            "DEBUG": ServerConfig.DEBUG,
            "TESTING": ServerConfig.TESTING,
            "RESET_DB_ON_START": ServerConfig.RESET_DB_ON_START,
            "PROPAGATE_EXCEPTIONS": ServerConfig.PROPAGATE_EXCEPTIONS,
            "DATABASE_URI": ServerConfig.DATABASE_URI,
            "SECRET_KEY": ServerConfig.SECRET_KEY,
        }


class Testing(ServerConfig):
    TESTING = True
    # temporary in-memory database
    DATABASE_URI = "sqlite://"


class DevelopmentLocal(ServerConfig):
    RESET_DB_ON_START = True
    DEBUG = True
    DATABASE_URI = "sqlite:///beets-flask-sqlite.db"


class DevelopmentDocker(ServerConfig):
    DATABASE_URI = "sqlite://///home/beetle/beets-flask-sqlite.db?timeout=5"
    DEBUG = True


class DeploymentDocker(DevelopmentDocker):
    DEBUG = False
    TESTING = False
    PROPAGATE_EXCEPTIONS = True


# ---------------------------------------------------------------------------- #
#                                 BeetsConfig                                  #
# ---------------------------------------------------------------------------- #
import os

from beets import IncludeLazyConfig as BeetsConfig
from confuse import ConfigReadError, YamlSource

from interactive_beets.utility import Singleton

# Config location
BEETS_CONFIG_PATH = os.getenv(
    "BEETS_CONFIG_PATH",
    pathlib.Path(__file__).parent.parent.parent / "configs" / "default.yaml",
)


class InteractiveBeetsConfig(BeetsConfig, metaclass=Singleton):

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
