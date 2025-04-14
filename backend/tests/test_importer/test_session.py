import logging
import os
from abc import ABC
from pathlib import Path

from beets_flask.invoker import run_preview
import pytest

from beets_flask.database.setup import _reset_database
from beets_flask.importer.session import PreviewSession
from beets_flask.importer.states import SessionState
from tests.test_importer.conftest import (
    VALID_PATHS,
    album_path_absolute,
    use_mock_tag_album,
)

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)


@pytest.mark.skip(reason="This test is only for generating!")
def test_generate_lookup():
    """Generate a lookup file for the albums.
    Uncomment the pytest.skip() to generate the lookup files.

    They should normally exist in the repository already.
    """
    for path in VALID_PATHS:
        path = Path(__file__).parent.parent / "data" / "audio" / path
        use_mock_tag_album(str(path))

        state = SessionState(path)
        session = PreviewSession(state)

        state = session.run_sync()
        assert os.path.exists(path / "lookup.pickle")


def test_album_exists(album_paths: list[Path]):
    """Just a check to test if the album_paths fixture
    is working as expected."""
    for ap in album_paths:
        assert ap.exists()
        assert ap.is_dir()
        assert len(list(ap.glob("**/*.mp3"))) > 0


class TestPreviewSessions:
    def get_state(self, path: str):
        p = album_path_absolute(path)
        self.session = PreviewSession(SessionState(p))
        use_mock_tag_album(str(p))
        return self.session.run_sync()

    @pytest.mark.parametrize("path", VALID_PATHS)
    def test_candidates_url(self, path):
        state = self.get_state(path)
        for task in state.task_states:
            for candidate in task.candidate_states:
                if candidate.id.startswith("asis"):
                    assert candidate.url is not None
                    assert candidate.url.startswith("file://")
                else:
                    assert candidate.url is not None
                    assert candidate.url.startswith("https")

        log.debug(f"State: {state}")


class IsolatedDBMixin(ABC):
    """
    A pytest mixin class to reset the database before and after ALL
    tests in this class are run.

    Usage:
    ```
    class TestMyFeature(IsolatedDBMixin):
        def test_something(self):
            # add to clean db

        def test_something_else(self):
            # db has data from previous test
    ```
    """

    @pytest.fixture(autouse=True, scope="class")
    def setup(self):
        """
        Automatically reset the database before and after ALL tests in this class.

        Args:
            db_session_factory: Pytest fixture providing a database session.
        """
        _reset_database()
        yield
        _reset_database()


class TestImportBest(IsolatedDBMixin):
    @pytest.fixture(autouse=True)
    def mock_emit_status(self, monkeypatch):
        """Mock the emit_status decorator"""

        def mock_emit_status(func):
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)

            return wrapper

        monkeypatch.setattr("beets_flask.invoker.emit_status", mock_emit_status)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("path", VALID_PATHS)
    async def test_preview(self, path: str):
        """Test the preview of the import process."""
        await run_preview("test", path)


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
