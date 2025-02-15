from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from functools import total_ordering

from beets_flask.logger import log


@total_ordering
class Progress(Enum):
    """The progress of the current session in chronological order.

    Allows to resume a import at any time using our state dataclasses. We might
    also want to add the plugin stages or refine this.

    @PS: I like it this far, you have ideas for more progress. I think this should be on
    task level.
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
