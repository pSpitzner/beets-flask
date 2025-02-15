import os
from pathlib import Path

import pytest

from beets_flask.importer.session import PreviewSessionNew
from beets_flask.importer.states import SessionState
from tests.test_importer.conftest import use_mock_tag_album


@pytest.mark.skip(reason="This test is only for generating!")
def test_generate_lookup():
    """Generate a lookup file for the albums.
    Uncomment the pytest.skip() to generate the lookup files.

    They should normally exist in the repository already.
    """
    paths = ["1992", "1992/Chant [Single]", "Annix", "Annix/Antidote"]
    for path in paths:
        path = Path(__file__).parent.parent / "data" / "audio" / path
        use_mock_tag_album(str(path))

        state = SessionState(path)
        session = PreviewSessionNew(state)

        state = session.run_sync()
        assert os.path.exists(path / "lookup.pickle")


def test_album_exists(album_paths: list[Path]):
    """Just a check to test if the album_paths fixture
    is working as expected."""
    for ap in album_paths:
        assert ap.exists()
        assert ap.is_dir()
        assert len(list(ap.glob("**/*.mp3"))) > 0
