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

    # Besides the beets-flask specific config, we want to ensure type safety
    # for those fields of the native beets config that we use ourself.
    directory: str = field(default="/music/imported")
    ignore: list[str] = field(default_factory=lambda: [])
    plugins: list[str] = field(default_factory=lambda: [])

    # We would like to provide a schema for the `import` section,
    # but `import` is a reserved keyword in Python. We might add a workaround in eyconf.
    # import: ImportSection
    match: MatchSectionSchema = field(default_factory=lambda: MatchSectionSchema())


# ---------------------------------------------------------------------------- #
#                                     Beets                                    #
# ---------------------------------------------------------------------------- #


@dataclass
class MatchSectionSchema:
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

    inbox: InboxSectionSchema = field(default_factory=lambda: InboxSectionSchema())
    library: LibrarySectionSchema = field(
        default_factory=lambda: LibrarySectionSchema()
    )
    terminal: TerminalSectionSchema = field(
        default_factory=lambda: TerminalSectionSchema()
    )
    num_preview_workers: int = field(default=4)


# ----------------------------------- Inbox ---------------------------------- #


@dataclass
class InboxSectionSchema:
    ignore: list[str] | Literal["_use_beets_ignore"] = "_use_beets_ignore"
    # File patterns to ignore when scanning the inbox folders.
    # Useful to exclude temporary files from being shown in the inbox.
    # To show all files (independent of which files beets will copy) set to []
    debounce_before_autotag: int = 30
    folders: Dict[str, InboxFolderSchema] = field(
        default_factory=lambda: {
            "placeholder": InboxFolderSchema(
                name="Please check your config!",
                path="/music/inbox",
                autotag="off",
            )
        }
    )


@dataclass
class InboxFolderSchema:
    name: str
    path: str
    auto_threshold: float | None = None
    autotag: Literal["auto", "preview", "bootleg", "off", False] = "off"
    # Let's keep the boolean option until v2.0.0 for backward compatibility. But consistent types are better.


# ---------------------------------- Library --------------------------------- #


@dataclass
class LibrarySectionSchema:
    readonly: bool = False
    artist_separators: list[str] = field(default_factory=lambda: [",", ";", "&"])


# --------------------------------- Terminal --------------------------------- #


@dataclass
class TerminalSectionSchema:
    start_path: str = "/repo"
