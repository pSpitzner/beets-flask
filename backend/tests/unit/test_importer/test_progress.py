import pytest

from beets_flask.importer.progress import Progress, ProgressState


def test_progress_equality():
    assert Progress.NOT_STARTED == Progress.NOT_STARTED
    assert Progress.READING_FILES == Progress.READING_FILES
    assert Progress.IMPORT_COMPLETED == Progress.IMPORT_COMPLETED
    assert Progress.NOT_STARTED != Progress.READING_FILES


def test_progress_less_than():
    assert Progress.NOT_STARTED < Progress.READING_FILES
    assert Progress.READING_FILES < Progress.GROUPING_ALBUMS
    assert not (Progress.IMPORT_COMPLETED < Progress.NOT_STARTED)


def test_progress_subtraction():
    assert Progress.READING_FILES - 1 == Progress.NOT_STARTED
    assert (
        Progress.IMPORT_COMPLETED - 100 == Progress.NOT_STARTED
    )  # Test clamping to min
    assert (Progress.NOT_STARTED + 1) == Progress.READING_FILES


def test_progress_addition():
    assert Progress.NOT_STARTED + 1 == Progress.READING_FILES
    assert (
        Progress.READING_FILES + 100 == Progress.IMPORT_COMPLETED
    )  # Test clamping to max
    assert Progress.IMPORT_COMPLETED + (-1) == Progress.MANIPULATING_FILES


# Test cases for ProgressState dataclass
def test_progress_state_equality():
    state1 = ProgressState(Progress.NOT_STARTED)
    state2 = ProgressState(Progress.NOT_STARTED)
    state3 = ProgressState(Progress.READING_FILES)

    assert state1 == state2
    assert state1 != state3
    assert state1 == Progress.NOT_STARTED  # Test against enum directly
    assert state3 == Progress.READING_FILES


def test_progress_state_less_than():
    state1 = ProgressState(Progress.NOT_STARTED)
    state2 = ProgressState(Progress.READING_FILES)
    state3 = ProgressState(Progress.IMPORT_COMPLETED)

    assert state1 < state2
    assert state2 < state3
    assert not (state3 < state1)
    assert state1 < Progress.READING_FILES  # Test against enum directly
    assert not (state3 < Progress.NOT_STARTED)


def test_progress_greater_than():
    state1 = ProgressState(Progress.NOT_STARTED)
    state2 = ProgressState(Progress.READING_FILES)
    state3 = ProgressState(Progress.IMPORT_COMPLETED)

    assert state2 > state1
    assert state3 > state2
    assert not (state1 > state3)
    assert not (state1 > Progress.READING_FILES)  # Test against enum directly
    assert not (Progress.NOT_STARTED > state3)


def test_progress_invalid_comparison():
    with pytest.raises(Exception):
        # Comparing with non-Progress type
        Progress.NOT_STARTED < "invalid_type"  # type: ignore

    state = ProgressState(Progress.NOT_STARTED)
    with pytest.raises(Exception):
        # Comparing with non-Progress/ProgressState type
        state < "invalid_type"  # type: ignore
