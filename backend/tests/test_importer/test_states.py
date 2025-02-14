from pathlib import Path
from typing import List
from beets_flask.importer.states import (
    SessionState,
    TaskState,
    CandidateState,
    ProgressState,
)
from beets_flask.importer.types import BeetsAlbumMatch, BeetsTrackInfo
import pytest

from ..conftest import beets_lib_item
from beets import importer
from beets import autotag

import logging

log = logging.getLogger(__name__)


def get_album_match(tracks: List[BeetsTrackInfo], items, **info):
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
    task = importer.ImportTask(paths=[b"a path"], toppath=b"top path", items=[item])

    track_info = autotag.TrackInfo(title="match title")
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
    import_task.candidates = []

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


def test_candidate_state(import_task):
    task_state = TaskState(import_task, session_state=None)
    candidate_states = task_state.candidate_states

    assert len(candidate_states) == 2  # One from import_task and one asis_candidate
    candidate = candidate_states[0]

    assert isinstance(candidate, CandidateState)
    assert candidate.id is not None
    assert candidate.match == import_task.candidates[0]
    assert candidate.task_state == task_state
    assert candidate.type == "album"
    assert candidate.cur_artist == str(import_task.cur_artist)
    assert candidate.cur_album == str(import_task.cur_album)
    assert candidate.items == import_task.items
    assert candidate.tracks == candidate.match.info.tracks
    assert candidate.distance == candidate.match.distance
    assert candidate.num_tracks == len(candidate.match.info.tracks)
    assert candidate.num_items == len(candidate.items)
    assert candidate.url == None

    # Test asis candidate
    asis_candidate = candidate_states[1]
    assert asis_candidate.id == "asis"
    assert asis_candidate.type == "album"


def test_candidate_state_diff_preview(import_task):
    task_state = TaskState(import_task, session_state=None)
    candidate = task_state.candidate_states[0]

    diff_preview = candidate.diff_preview
    assert isinstance(diff_preview, str)
    assert "match album" in diff_preview


def test_candidate_state_identify_duplicates(import_task, beets_lib):
    task_state = TaskState(import_task, session_state=None)
    candidate = task_state.candidate_states[0]

    duplicates = candidate.identify_duplicates(beets_lib)
    assert isinstance(duplicates, list)
    assert len(duplicates) == 0
    assert candidate.has_duplicates_in_library is False


def test_candidate_state_serialize(import_task):
    task_state = TaskState(import_task, session_state=None)
    candidate = task_state.candidate_states[0]

    serialized = candidate.serialize()
    assert isinstance(serialized, dict)
    assert serialized["id"] == candidate.id
    assert serialized["cur_artist"] == candidate.cur_artist
    assert serialized["cur_album"] == candidate.cur_album
    assert serialized["type"] == candidate.type
    assert serialized["distance"] == candidate.distance.distance
    assert serialized["duplicate_in_library"] == candidate.has_duplicates_in_library
