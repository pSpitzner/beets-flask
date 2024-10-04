import os
import logging
from logging.handlers import RotatingFileHandler


def setup_logging() -> None:
    global log_file_for_web
    global log

    log_file_for_web = os.environ.get("LOG_FILE_WEB", "/repo/log/for_web.log")

    # https://docs.python.org/3/library/logging.html#logrecord-attributes
    logging.basicConfig(
        format="%(relativeCreated)d [%(levelname)-4s] %(name)s - %(message)s %(filename)s:%(lineno)d",
        level=os.getenv("LOG_LEVEL_OTHERS", logging.WARNING),
    )

    log = logging.getLogger("beets-flask")
    log.setLevel(os.getenv("LOG_LEVEL_BEETSFLASK", logging.INFO))

    log.info("Logging initialized")


log = None
log_file_for_web = None
setup_logging()
