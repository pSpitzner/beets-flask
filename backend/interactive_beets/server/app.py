import os
from pprint import pformat

from quart import Quart
from quart_cors import cors

from interactive_beets.database import setup_database
from interactive_beets.logger import log


def create_app(mode="dev_local"):
    """
    Creates and configures the Quart application.

    This function initializes the Quart app with necessary configurations,
    sets up database connections, registers blueprints, and initializes
    various services such as websockets, terminal management, disk inboxes,
    and tag deletion. It also ensures that exceptions are propagated correctly
    and configures CORS for development purposes.

    Parameters:
        mode (str): The mode in which the app is running. Defaults to "dev".

    Returns:
        Quart: The configured Quart application instance.
    """
    app = Quart(__name__, instance_relative_config=True)

    # Read mode from environment variable
    # TODO: we could switch that to the direct config call
    mode = os.environ.get("IBEETS_MODE", mode)

    switch = {
        "dev_local": "interactive_beets.config.DevelopmentLocal",
        "dev_docker": "interactive_beets.config.DevelopmentDocker",
        "test": "interactive_beets.config.Testing",
        "prod": "interactive_beets.config.Production",
    }

    if mode not in switch:
        raise ValueError(f"Invalid mode: {mode}")

    app.config.from_object(switch[mode])

    # CORS needed for Dev so vite can talk to the backend
    if app.config["DEBUG"]:
        cors(app)

    # database init
    setup_database(app)

    from .routes import backend_bp

    app.register_blueprint(backend_bp)

    # Print out the config
    config = {key: value for key, value in app.config.items()}
    log.debug(f"App created with config: \n {pformat(config)}")

    return app
