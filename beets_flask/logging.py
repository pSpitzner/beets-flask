from __future__ import annotations

"""
Logging

We use two loggers. ther server one `srv_log` and the `web_log`.
The letter goes to file and is exposed via api endpoint
"""

import os
from functools import wraps
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask


def setup_logging(app: Flask):
    app.logger.setLevel(os.environ.get("LOG_LEVEL_SERVER", logging.WARNING))

    # silence some of the output
    for l in ["werkzeug", "rq.worker"]:
        logging.getLogger(l).setLevel(os.environ.get("LOG_LEVEL_SERVER", "WARNING"))
