import logging
import logging.config
import os

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": True,
    "formatters": {
        "standard": {
            # https://docs.python.org/3/library/logging.html#logrecord-attributes
            "format": "[%(levelname)-5s] %(name)s: %(message)s"
        },
        "debug": {
            "format": "%(relativeCreated)-8d [%(levelname)-5s] %(name)s %(filename)-8s:%(lineno)d: %(message)s"
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "standard",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "debug",
            "filename": os.environ.get("LOG_FILE_WEB", "/repo/log/for_web.log"),
            "maxBytes": 1048576,  #
            "backupCount": 3,
        },
    },
    "loggers": {
        "": {  # root logger
            "handlers": ["console", "file"],
            "level": os.getenv("LOG_LEVEL_OTHERS", logging.WARNING),
            "propagate": False,
        },
        "beets-flask": {
            "handlers": ["console", "file"],
            "level": os.getenv("LOG_LEVEL_BEETSFLASK", logging.DEBUG),
            "propagate": False,
        },
    },
}

logging.config.dictConfig(LOGGING_CONFIG)


log = logging.getLogger("beets-flask")

# Redis workers will have a different logger
rq_name = os.getenv("RQ_JOB_ID", None)
if rq_name:
    log = log.getChild(rq_name[0:4])
    log.setLevel(os.getenv("LOG_LEVEL_BEETSFLASK_REDIS", logging.DEBUG))

log.debug("Logging configured!")
