import os
from abc import ABC
from pathlib import Path
from unittest import mock

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from beets_flask.database.models.states import SessionStateInDb
from beets_flask.importer.progress import FolderStatus, Progress
from beets_flask.importer.types import BeetsLibrary
from tests.test_importer.conftest import (
    VALID_PATHS,
    album_path_absolute,
    use_mock_tag_album,
)


"""
Proposal testing session flows:

There are a number of edge cases when triggering sessions. Might be more
I'm missing at the moment.

-----------

Import best
- New folder
- Generate Preview
- Import best

Import asis
- New folder
- Generate Preview
- Import asis

Import specific candidate
- New folder
- Generate Preview
- Import candidate

------------

any = best | asis | specific candidate

Adding a new candidate
- New folder
- Generate Preview
- Add candidates
- Import any

Already imported
- New folder
- Generate Preview
- Import any
- Generate Preview
- Import any
- Should somehow error with already imported! <-- ask or user config

Already imported with action
- New folder
- Generate Preview
- Import any
- Generate Preview
- Import any (with action for duplicate)
- Should import the duplicate depending on the action


----------

Autoimport what happens with the progress after a failed auto import

"""


from beets_flask.invoker import run_import_candidate, run_preview
