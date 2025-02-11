from pathlib import Path
from typing import List
from beets_flask.importer.states import SessionState, TaskState, CandidateState, ImportStatusMessage
from beets_flask.importer.types import BeetsAlbumMatch, BeetsTrackInfo
import pytest

from ..conftest import beets_lib_item
from beets import importer
from beets import autotag

import logging
log = logging.getLogger(__name__)


def get_album_match(tracks : List[BeetsTrackInfo], items, **info):
    match = BeetsAlbumMatch(
        distance=autotag.Distance(),
        info=autotag.AlbumInfo(
            tracks=tracks,
            **info,
        ),
        extra_items=[],
        extra_tracks=[],
        mapping={i: tracks[idx] for idx, i in enumerate(items)},
    )
    return match


@pytest.fixture
def import_task(beets_lib):

    item = beets_lib_item(title="title", path="path")
    task = importer.ImportTask(
        paths=[b"a path"], toppath=b"top path", items=[item]
    )

    track_info = autotag.TrackInfo(
        title="match title"
    )
    album_match = get_album_match([track_info], [item], album="match album")

    task.candidates = [album_match]
    return task


def test_task(import_task):
    assert isinstance(import_task, importer.ImportTask)

    # Test if paths is bytes
    assert isinstance(import_task.paths, list)
    for path in import_task.paths:
        assert isinstance(path, bytes)

    assert import_task.paths == [b"a path"]
    assert import_task.toppath == b"top path"

def test_task_state(import_task):
    task_state = TaskState(import_task, session_state=None)
    # in our code, we cast to proper path type
    assert isinstance(task_state.toppath, Path)
    assert isinstance(task_state.paths, list)
    for path in task_state.paths:
        assert isinstance(path, Path)

    assert task_state.paths == [Path("a path")]
    assert task_state.toppath == Path("top path")
    assert task_state.items == [import_task.items[0]]

    # Task state always has asis candidate
    assert task_state.best_candidate is not None
    assert task_state.best_candidate.id == "asis"


    log.debug(task_state)



def test_candidate_state():
    pass
