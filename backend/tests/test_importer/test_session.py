import logging
import os
from pathlib import Path

from beets_flask.database.models.tag import Tag
from beets_flask.database.setup import db_session_factory
import pytest

from beets_flask.importer.session import PreviewSession
from beets_flask.importer.states import SessionState
from tests.test_importer.conftest import (
    VALID_PATHS,
    album_path_absolute,
    use_mock_tag_album,
    valid_data_for_album_path,
)

from beets_flask.invoker import run_import, run_preview
from beets_flask.server.routes.tag import add_tag

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)

# import conftest from other folder
from tests.test_database.conftest import fdb_session_factory


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
                    assert candidate.url is None
                else:
                    assert candidate.url is not None
                    assert candidate.url.startswith("https")

        log.debug(f"State: {state}")


# this is more of an integration test,
# Note: runPreview here in main thread, not the workers
@pytest.mark.parametrize("path", VALID_PATHS)
def test_run_preview(path: str, db_session_factory):
    ap = album_path_absolute(path)
    use_mock_tag_album(str(ap))
    log.info(f"Preview on album path: {ap}")

    tag_id = None
    with db_session_factory() as session:
        tag = Tag(album_folder=str(ap), kind="preview")
        session.merge(tag)
        session.commit()
        tag_id = tag.id

    run_preview(tag_id)

    comparison = valid_data_for_album_path(ap)

    with db_session_factory() as session:
        tag = session.query(Tag).get(tag_id)
        assert tag is not None
        assert tag.kind == "preview"
        assert tag.status == "tagged"
        assert tag.match_url == comparison["match_url"]
        assert tag.match_album == comparison["match_album"]
        assert tag.match_artist == comparison["match_artist"]
        assert tag.num_tracks == comparison["num_tracks"]
        assert tag.distance == pytest.approx(comparison["distance"], 0.01)
        assert tag.album_folder_basename == comparison["album_folder_basename"]
        assert tag.preview is not None
