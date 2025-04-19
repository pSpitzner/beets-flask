import logging
import os
from pathlib import Path

import pytest

from beets_flask.importer.session import PreviewSession
from beets_flask.importer.states import SessionState

from .conftest import (
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
        path = Path(__file__).parent.parent.parent / "data" / "audio" / path
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
