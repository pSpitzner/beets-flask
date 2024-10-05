""" Server configuration for flask app

We have different configurations classes for 
different environments further you may create
a custom configuration class for your own needs.

The configuration classes are parse in the `create_app`
function in the `__init__.py` file.
"""


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
    DATABASE_URI = "sqlite:///:memory:?cache=shared"
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
