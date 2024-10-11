import io
import re
import sys
from functools import wraps
from math import floor

from flask import current_app
from flask_sse import sse
from rq import Worker

from .logger import log

# ------------------------------------------------------------------------------------ #
#                                    init flask app                                    #
# ------------------------------------------------------------------------------------ #


def with_app_context(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        with current_app.app_context():
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


def capture_stdout_stderr(func, *args, **kwargs):
    """
    beets.ui uses a custom `print_` function to display most console output in a nicely formatted way. This is the easiest way to capture that output.

    Args:
        func (callable): function to call
        *args: positional arguments to pass to `func`
        **kwargs: keyword arguments to pass to `func`

    Returns
    -------
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
AUDIO_EXTENSIONS = (
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
