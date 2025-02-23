from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from functools import total_ordering

from beets_flask.logger import log


@total_ordering
class Progress(Enum):
    """The progress of tasks in chronological order.

    The order roughly matches the stages you might expect.

    Allows to resume a import at any time using our state dataclasses. We might
    also want to add the plugin stages or refine this.
    """

    NOT_STARTED = 0
    READING_FILES = 1
    GROUPING_ALBUMS = 2
    LOOKING_UP_CANDIDATES = 3
    IDENTIFYING_DUPLICATES = 4
    OFFERING_MATCHES = 5
    WAITING_FOR_USER_SELECTION = 6
    EARLY_IMPORTING = 7
    IMPORTING = 8
    MANIPULATING_FILES = 9
    COMPLETED = 10

    def __lt__(self, other: Progress) -> bool:
        return self.value < other.value


@total_ordering
@dataclass(slots=True)
class ProgressState:
    """Simple dataclass to hold a status message and a status code."""

    progress: Progress = Progress.NOT_STARTED

    # Optional message to display to the user
    message: str | None = None

    # Plugin specific
    plugin_name: str | None = None

    def as_dict(self) -> dict:
        return {
            "progess": self.progress.name,
            "message": self.message,
            "plugin_name": self.plugin_name,
        }

    def __lt__(self, other: ProgressState | Progress) -> bool:
        if isinstance(other, Progress):
            other = ProgressState(other)
        return self.progress < other.progress

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Progress):
            return self.progress == other
        if not isinstance(other, ProgressState):
            return False
        return self.progress == other.progress


class SessionStatus(Enum):
    """The status of a session.

    For now reflects the old tag status (lower-cased strings).

    I like the simplification this allows in the front-end, where we use three or so icons
    - pending
    - running (something)
    - done as
        - tagged (i.e. previewed, requiring action)
        - imported
        - duplicate (requiring action... potentially,
          but now clue what we do if defaul action is override)
        - failed

    Let's rethink how we do this mapping since we now have the more detailed task progress.

    """

    NOT_STARTED = 0
    PENDING = 1
    TAGGING = 2
    TAGGED = 3
    IMPORTING = 4
    IMPORTED = 5
    FAILED = 6
    UNMATCHED = 7
    DUPLICATE = 8

    def __str__(self) -> str:
        return self.name.lower()


class SessionKind(Enum):
    """The kind of session.

    For now reflects the old tag kind (lower-cased strings).
    """

    PREVIEW = 0
    IMPORT = 1
    IMPORT_AS_IS = 2
    AUTO = 3

    def __str__(self) -> str:
        return self.name.lower()
