from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Literal

from eyconf import validation

from beets_flask.logger import log

from .type_shenanigans import mixed_dataclass


@mixed_dataclass
class BeetsSchema:
    gui: BeetsFlaskSchema = field(default_factory=lambda: BeetsFlaskSchema())


@mixed_dataclass
class BeetsFlaskSchema:
    inbox: InboxSection = field(default_factory=lambda: InboxSection())
    library: LibrarySection = field(default_factory=lambda: LibrarySection())
    terminal: TerminalSection = field(default_factory=lambda: TerminalSection())
    num_preview_workers: int = 4


@mixed_dataclass
class InboxSection:
    ignore: list[str] | Literal["_use_beets_ignore"] = "_use_beets_ignore"
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


@mixed_dataclass
class InboxFolder:
    name: str
    path: str
    auto_threshold: float | None = None
    autotag: Literal["auto", "preview", "bootleg", False] = False
    # the `no` -> False option will need tweaking


@mixed_dataclass
class LibrarySection:
    readonly: bool = False
    artist_separators: list[str] = field(default_factory=lambda: [",", ";", "&"])


@mixed_dataclass
class TerminalSection:
    start_path: str = "/repo"


def validate(config: dict) -> None:
    """
    Validate flattened beets flask config against expected format.

    Currently only flags missing keys. Extra keys are not checked yet.

    Example
    -------
    ```python
    from beets_flask.config.beets_config_schema import validate
    from beets_flask.config import get_config

    config = get_config().flatten()
    validate(config["gui"])
    ```

    """

    if "gui" in config:
        # we only want to validate the gui part, i.e. beets_flask specific settings
        config = config["gui"]

    schema_dict = validation.to_json_schema(BeetsFlaskSchema, allow_additional=False)
    validation.validate(config, schema_dict)

    # I think we should do all validation here, like this:
    # (rewrite currently still happening in beets_config.py)
    for folder in config["inbox"]["folders"].values():
        if folder["path"].endswith("/"):
            log.warning(
                f"Inbox path '{folder['path']}' should not end with a trailing slash!"
            )


# flow
# 1. define dataclasses as schema here, including beets stuff we need
# 2. create confuse config, set our as lowest prio
# 3. load beets config int confuse
# 4. validate confuse config against our schema here, and create custom instance,
# 5. ... which we use everywhere py2ts!
