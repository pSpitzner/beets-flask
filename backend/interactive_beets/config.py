class Config:
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
            "DEBUG": Config.DEBUG,
            "TESTING": Config.TESTING,
            "PROPAGATE_EXCEPTIONS": Config.PROPAGATE_EXCEPTIONS,
            "DATABASE_URI": Config.DATABASE_URI,
            "SECRET_KEY": Config.SECRET_KEY,
        }


class Testing(Config):
    TESTING = True
    DATABASE_URI = "sqlite:///:memory:?cache=shared"


class DevelopmentLocal(Config):
    RESET_DB_ON_START = True
    DEBUG = True
    DATABASE_URI = "sqlite:///beets-flask-sqlite.db"


class DevelopmentDocker(Config):
    DATABASE_URI = "sqlite://///home/beetle/beets-flask-sqlite.db?timeout=5"
    DEBUG = True


class DeploymentDocker(DevelopmentDocker):
    DEBUG = False
    TESTING = False
    PROPAGATE_EXCEPTIONS = True
