import io
import re
import sys

from .logger import log

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
    """Object that returns None for any attribute accessed.

    You may use this. e.g. for beets.ui._load_plugin options.
    """

    def __getattr__(self, name):
        """Return None for any attribute accessed."""
        return None
