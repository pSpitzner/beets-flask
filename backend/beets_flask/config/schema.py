"""We maintain the configuration schema for beets-flask here.

This also includes schemas for beets sections that we need to access in
beets-flask.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Literal


@dataclass
class BeetsSchema:
    gui: BeetsFlaskSchema = field(default_factory=lambda: BeetsFlaskSchema())
    directory: str = field(default="/music/imported")

    # used in frontend
    ignore: list[str] = field(default_factory=lambda: [])
    plugins: list[str] = field(default_factory=lambda: [])

    # this is a problem
    # import: ImportSection
    match: MatchSection = field(default_factory=lambda: MatchSection())


# ---------------------------------------------------------------------------- #
#                                     Beets                                    #
# ---------------------------------------------------------------------------- #


@dataclass
class MatchSection:
    strong_rec_thresh: float = field(default=0.04)
    medium_rec_thresh: float = field(default=0.10)
    album_disambig_fields: list[str] = field(
        default_factory=lambda: ["year", "albumtype"]
    )
    singleton_disambig_fields: list[str] = field(
        default_factory=lambda: ["artist", "year"]
    )


# ---------------------------------------------------------------------------- #
#                                  Beets Flask                                 #
# ---------------------------------------------------------------------------- #


@dataclass
class BeetsFlaskSchema:
    """Beets-flask specific configuration schema."""

    inbox: InboxSection = field(default_factory=lambda: InboxSection())
    library: LibrarySection = field(default_factory=lambda: LibrarySection())
    terminal: TerminalSection = field(default_factory=lambda: TerminalSection())
    num_preview_workers: int = field(default=4)


# ----------------------------------- Inbox ---------------------------------- #


@dataclass
class InboxSection:
    ignore: list[str] | Literal["_use_beets_ignore"] = "_use_beets_ignore"
    # File patterns to ignore when scanning the inbox folders.
    # Useful to exclude temporary files from being shown in the inbox.
    # To show all files (independent of which files beets will copy) set to []
    debounce_before_autotag: int = 30
    folders: Dict[str, InboxFolder] = field(
        default_factory=lambda: {
            "placeholder": InboxFolder(
                name="Please check your config!",
                path="/music/inbox",
                autotag=False,
            )
        }
    )


@dataclass
class InboxFolder:
    name: str
    path: str
    auto_threshold: float | None = None
    autotag: Literal["auto", "preview", "bootleg", False] = False
    # the `no` -> False option will need tweaking


# ---------------------------------- Library --------------------------------- #


@dataclass
class LibrarySection:
    readonly: bool = False
    artist_separators: list[str] = field(default_factory=lambda: [",", ";", "&"])


# --------------------------------- Terminal --------------------------------- #


@dataclass
class TerminalSection:
    start_path: str = "/repo"
