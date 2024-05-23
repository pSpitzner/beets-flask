import os
import logging
from logging.handlers import RotatingFileHandler


def setup_logging() -> None:
    global log_file_for_web
    global log

    log_file_for_web = os.environ.get("LOG_FILE_WEB", "./log/for_web.log")

    logging.basicConfig(format="%(levelname)-8s %(name)s %(funcName)s : %(message)s")
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    # grab everything, handlers below have their own levels
    log = logging.getLogger("beets-flask")
    log.setLevel(logging.DEBUG)

    # keep a log file that the web interface can load
    fh = RotatingFileHandler(
        log_file_for_web,
        maxBytes=int(0.3 * 1024 * 1024),
        backupCount=3,
    )
    fh.setFormatter(logging.Formatter("%(message)s"))
    fh.setLevel(os.getenv("LOG_LEVEL_WEB", logging.DEBUG))
    log.addHandler(fh)

    # we also want to update the client-side view everytime we log sth.
    """
    class ClientUpdateHandler(logging.Handler):
        def emit(self, record):
            update_client_view("logs", ansi_to_html(self.format(record)))

    ch = ClientUpdateHandler()
    ch.setFormatter(logging.Formatter("%(message)s"))
    ch.setLevel(os.getenv("LOG_LEVEL_WEB", logging.DEBUG))
    log.addHandler(ch)
    """

    # for the server we use streaming handler
    sh = logging.StreamHandler()
    sh.setFormatter(
        logging.Formatter("%(levelname)-8s %(name)s %(funcName)s : %(message)s")
    )
    sh.setLevel(os.getenv("LOG_LEVEL_SERVER", logging.DEBUG))
    log.addHandler(sh)

    log.debug("Logging initialized")


log = None
log_file_for_web = None
setup_logging()
