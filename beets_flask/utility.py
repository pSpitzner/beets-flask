import os
import re
import sys
import io
import logging
from functools import wraps
from flask import Flask
from flask_rq2 import RQ
from rq import Worker
from flask_sse import sse
from logging.handlers import RotatingFileHandler
from flask_sqlalchemy import SQLAlchemy
from math import floor

# ------------------------------------------------------------------------------------ #
#                                    init flask app                                    #
# ------------------------------------------------------------------------------------ #


def create_app():
    app = Flask("beets-flask", template_folder="templates", static_folder="static")

    # sqlite
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        "sqlite://///home/beetle/beets-flask-sqlite.db?timeout=5"
    )
    db = SQLAlchemy()
    db.init_app(app)
    # db.create_all() has to be called after models are known.

    # redis, workers
    rq = RQ()
    rq.init_app(app)

    # we want to update the download table only when needed.
    # redis connection also needed for sse
    app.config["REDIS_URL"] = "redis://localhost"
    app.register_blueprint(sse, url_prefix="/stream")

    return app, db, rq


def with_app_context(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        with app.app_context():
            return f(*args, **kwargs)

    return wrapper


@with_app_context
def update_client_view(type: str, msg: str = "Data updated"):
    sse.publish({"message": msg}, type=type)


def get_running_jobs():
    running_jobs = []
    workers = Worker.all()
    for worker in workers:
        job = worker.get_current_job()
        if job:
            running_jobs.append(job)
    return running_jobs


# ------------------------------------------------------------------------------------ #
#                                        Logging                                       #
# ------------------------------------------------------------------------------------ #


def init_logging():

    global log_file_for_web
    log_file_for_web = os.environ.get("LOG_FILE_WEB", "./log/for_web.log")

    logging.basicConfig(
        format="%(levelname)-8s %(name)s %(funcName)s : %(message)s"
    )
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
    class ClientUpdateHandler(logging.Handler):
        def emit(self, record):
            update_client_view("logs", ansi_to_html(self.format(record)))

    ch = ClientUpdateHandler()
    ch.setFormatter(logging.Formatter("%(message)s"))
    ch.setLevel(os.getenv("LOG_LEVEL_WEB", logging.DEBUG))
    log.addHandler(ch)

    # for the server we use streaming handler
    sh = logging.StreamHandler()
    sh.setFormatter(logging.Formatter("%(levelname)-8s %(name)s %(funcName)s : %(message)s"))
    sh.setLevel(os.getenv("LOG_LEVEL_SERVER", logging.DEBUG))
    log.addHandler(sh)

    log.debug("Logging initialized")

    return log


def capture_stdout_stderr(func, *args, **kwargs):
    """
    beets.ui uses a custom `print_` function to display most console output in a nicely formatted way. This is the easiest way to capture that output.

    Args:
        func (callable): function to call
        *args: positional arguments to pass to `func`
        **kwargs: keyword arguments to pass to `func`

    Returns:
        tuple: (str, str, any) -- stdout, stderr, return value of `func`
    """
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    buf_stdout = io.StringIO()
    buf_stderr = io.StringIO()
    sys.stdout = buf_stdout
    sys.stderr = buf_stderr
    try:
        res = func(*args, **kwargs)
    except Exception as ep:
        log.error(ep, exc_info=True)
        res = None
    sys.stdout.flush()
    sys.stderr.flush()
    sys.stdout = original_stdout
    sys.stderr = original_stderr
    return buf_stdout.getvalue(), buf_stderr.getvalue(), res


# ------------------------------------------------------------------------------------ #
#                                      Formatting                                      #
# ------------------------------------------------------------------------------------ #


def strip_ansi(text: str):
    return re.sub(r"\x1b[^m]*m", "", text)


def heading(heading: str):
    return f"\n+{'-' * 90}+\n| {heading}\n+{'-' * 90}+\n"


def ansi_to_html(text: str):

    if not text:
        return text

    ansi_codes = {
        "\x1b[39;49;00m": "</span>",
        "\x1b[0m": "</span>",
        "\x1b[1m": '<span class="fw-bolder">',
        "\x1b[2m": '<span class="fw-lighter fg-gray">',
        "\x1b[01m": '<span class="fw-bolder">',
        "\x1b[3m": '<span class="fst-italic">',
        "\x1b[4m": '<span class="text-decoration-underline">',
        "\x1b[31m": '<span class="fg-red">',
        "\x1b[31;01m": '<span class="fg-red fw-bolder">',
        "\x1b[32m": '<span class="fg-green">',
        "\x1b[32;01m": '<span class="fg-green fw-bolder">',
        "\x1b[33m": '<span class="fg-yellow">',
        "\x1b[33;01m": '<span class="fg-yellow fw-bolder">',
        "\x1b[34m": '<span class="fg-blue">',
        "\x1b[34;01m": '<span class="fg-blue fw-bolder">',
        "\x1b[35m": '<span class="fg-magenta">',
        "\x1b[35;01m": '<span class="fg-magenta fw-bolder">',
        "\x1b[36m": '<span class="fg-cyan">',
        "\x1b[36;01m": '<span class="fg-cyan fw-bolder">',
        # 37 should be white, but we use white as the default color.
        # "\x1b[37m": '<span style="color: white">',
        "\x1b[37m": '<span class="fg-yellow">',
        "\x1b[39m": '<span style="color: inherit">',
        "\x1b[49m": '<span style="background-color: inherit">',
        "\x1b[00m": '<span style="font-weight: normal; font-style: normal; text-decoration: none">',
        # preserve leading white spaces
        "^ +": lambda match: "&nbsp;" * len(match.group(0)),
        "\n": "<br>",
        "\t": "  ",
        # we want to pass this as a html attribute, e.g. title='{this}'. replace single quotes.
        "'": "&#39;",
    }

    # Create a regular expression that matches any of the keys in ansi_codes
    regex = re.compile("|".join(map(re.escape, ansi_codes.keys())))

    open_spans = 0

    def replacer(match):
        nonlocal open_spans
        replacement = ansi_codes[match.group(0)]
        if replacement.startswith("<span"):
            open_spans += 1
        elif replacement == "</span>":
            replacement = "</span>" * open_spans
            open_spans = 0
        return replacement

    text = text.lstrip(" \n")
    text = text.rstrip("\n ")
    text = regex.sub(replacer, text)
    # make links clickable
    text = re.sub(r"(https?://[^\s]+)(?=<br>|$)", r'<a href="\1">\1</a>', text)
    # preserve leading white spaces
    # leading_spaces = re.compile("^ +", re.MULTILINE)
    # text = leading_spaces.sub(lambda match: "&nbsp;" * len(match.group(0)), text)

    return text


def selector_safe(s: str):
    replacements = {
        " ": "_",
        "/": "-slash-",
        "\\": "-backslash-",
        "(": "-openparen-",
        ")": "-closeparen-",
        "[": "-opensquare-",
        "]": "-closesquare-",
        ",": "-comma-",
    }
    regex = re.compile("(%s)" % "|".join(map(re.escape, replacements.keys())))

    return regex.sub(lambda mo: replacements[mo.string[mo.start() : mo.end()]], s)


def html_for_distance(dist):
    from beets import config

    prefix = "<span class='similarity-badge"
    suffix = "</span>"
    if dist is None:
        return f"{prefix} fg-border-clr'>tbd{suffix}"

    sim = f"{floor((1 - dist) * 100):.0f}%"
    if dist <= config["match"]["strong_rec_thresh"].as_number():
        return f"{prefix} fg-green'>{sim}{suffix}"
    elif dist <= config["match"]["medium_rec_thresh"].as_number():
        return f"{prefix} fg-yellow'>{sim}{suffix}"
    else:
        return f"{prefix} fg-red'>{sim}{suffix}"


# ------------------------------------------------------------------------------------ #
#                                         Misc                                         #
# ------------------------------------------------------------------------------------ #

# audio formats supported by beets
# https://github.com/beetbox/beets/discussions/3964
audio_extensions = (
    ".mp3",
    ".aac",
    ".alac",
    ".ogg",
    ".opus",
    ".flac",
    ".ape",
    ".wv",
    ".mpc",
    ".asf",
    ".aiff",
    ".dsf",
)


class DummyObject:
    """
    If you need an object that has every attribute defined but set to None, use this. e.g. for beets.ui._load_plugin options.
    """

    def __getattr__(self, name):
        return None


# ------------------------------------------------------------------------------------ #
#                                         init                                         #
# ------------------------------------------------------------------------------------ #

app, db, rq = create_app()
log_file_for_web = None
log = init_logging()
