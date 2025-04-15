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

    def reset_database(self):
        """
        Reset the database to a clean state.
        This method is called before and after each test in the class.
        """
        from beets_flask.database.setup import _reset_database

        _reset_database()

    @pytest.fixture(autouse=True, scope="class")
    def setup(self, testapp):
        """
        Automatically reset the database before and after ALL tests in this class.

        Args:
            db_session_factory: Pytest fixture providing a database session.
        """
        self.reset_database()
        yield
        self.reset_database()


class InvokerStatusMockMixin(ABC):
    """
    Allows to test without a running websocket server for
    status updates in the invoker.

    Usage:
    ```
    class TestMyFeature(InvokerStatusMockMixin):
        def test_something(self):
            # add to clean db
            assert self.statuses == [SomeStatus]
    ```
    """

    # list[{path: str, hash: str, status: FolderStatus}]
    statuses: list[dict] = []

    async def send_folder_status_update(self, **kwargs):
        """Mock the emit_status decorator"""
        print(f"Mocked send_folder_status_update: {kwargs}")
        self.statuses.append(kwargs)

    # ??? due to class inheritance, scope="function" effectively becomes class.
    # What we found is that, as is now, we get a websocket that survives between
    # different test functions.
    @pytest.fixture(autouse=True, scope="function")
    def mock(self):
        """Mock the emit_status decorator"""

        with mock.patch(
            "beets_flask.invoker.send_folder_status_update",
            self.send_folder_status_update,
        ):
            yield

        # Unexpectetly, this does not reset the statuses after each test.
        # -> do it manually in the tests as needed.
        self.statuses = []


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


class TestImportBest(InvokerStatusMockMixin, IsolatedDBMixin):
    """
    Import best
    - New folder
    - Generate Preview
    - Import best
    """

    @pytest.fixture()
    def path(self) -> Path:
        path = album_path_absolute(VALID_PATHS[0])
        use_mock_tag_album(str(path))
        return path

    async def test_preview(self, db_session: Session, path: Path):
        """Test the preview of the import process."""

        stmt = select(SessionStateInDb).order_by(SessionStateInDb.created_at.desc())
        assert db_session.execute(stmt).scalar() is None, (
            "Database should be empty before the test"
        )

        await run_preview(
            "obsolete_hash_preview",
            str(path),
        )

        # Check that status was emitted correctly, we emit once before and once after run
        assert len(self.statuses) == 2
        assert self.statuses[0]["status"] == FolderStatus.PREVIEWING
        assert self.statuses[1]["status"] == FolderStatus.PREVIEWED

        # Check db contains the tagged folder
        stmt = select(SessionStateInDb)
        s_state_indb = db_session.execute(stmt).scalar()

        assert s_state_indb is not None
        assert s_state_indb.folder.full_path == str(path)

        # Check preview content is correct
        s_state_live = s_state_indb.to_live_state()
        assert s_state_live is not None
        assert s_state_live.folder_path == path
        assert len(s_state_live.task_states) == 1

        t_state_live = s_state_live.task_states[0]
        assert t_state_live.progress == Progress.PREVIEW_COMPLETED

        for c in t_state_live.candidate_states:
            assert len(c.duplicate_ids) == 0, (
                "Should not have duplicates in empty library"
            )

    async def test_import(
        self, db_session: Session, path: Path, beets_lib: BeetsLibrary
    ):
        """
        Test the import of the tagged folder.

        The preview of the previous test should still exist in the database,
        because we reset the db via IsolatedDBMixin on scope=class
        """

        stmt = select(func.count()).select_from(SessionStateInDb)
        assert db_session.execute(stmt).scalar() == 1, (
            "Database should contain the one preview session state from the previous test"
        )

        self.statuses = []
        await run_import_candidate(
            "obsolete_hash_import",
            str(path),
            candidate_id=None,  # None uses best match
        )

        # Check that status was emitted correctly, we emit once before and once after run
        assert len(self.statuses) == 2
        assert self.statuses[0]["status"] == FolderStatus.IMPORTING
        assert self.statuses[1]["status"] == FolderStatus.IMPORTED

        # Check db still contains one tagged folder
        stmt = select(SessionStateInDb)
        s_state_indb = db_session.execute(stmt).scalar()

        assert s_state_indb is not None
        assert s_state_indb.folder.full_path == str(path)

        # Check preview content is correct
        s_state_live = s_state_indb.to_live_state()
        assert s_state_live is not None
        assert s_state_live.folder_path == path
        assert len(s_state_live.task_states) == 1

        t_state_live = s_state_live.task_states[0]
        assert t_state_live.progress == Progress.IMPORT_COMPLETED

        for c in t_state_live.candidate_states:
            assert len(c.duplicate_ids) == 0, (
                "Should not have duplicates in empty library"
            )

        # Check that we have the items in the beets lib
        albums = beets_lib.albums()
        assert len(albums) == 1, "Should have imported one album"

        # gui import ids are set
        album = albums[0]
        assert hasattr(album, "gui_import_id"), "Album should have gui_import_id"
        assert album.gui_import_id is not None, "Album should have gui_import_id"

    async def test_reimport_fails(self, db_session: Session, path: Path):
        """Reimport should fail if the state is already imported"""
        stmt = select(func.count()).select_from(SessionStateInDb)
        assert db_session.execute(stmt).scalar() == 1, (
            "Database should contain the one preview session state from the previous test"
        )

        self.statuses = []

        with pytest.raises(
            Exception,
            match="Already progressed past preview",
        ):
            await run_import_candidate(
                "obsolete_hash_import",
                str(path),
                candidate_id=None,  # None uses best match
                duplicate_action="ask",
            )

        assert len(self.statuses) == 2
        assert self.statuses[0]["status"] == FolderStatus.IMPORTING
        assert self.statuses[1]["status"] == FolderStatus.FAILED

    async def test_duplicate_import_fails(
        self, db_session: Session, path: Path, beets_lib: BeetsLibrary
    ):
        """
        Duplicates should normally only happen if you import the same
        items from a different folder.

        We use the same items but a different folder here ;) A bit
        hacky but works for our purpose.
        """

        raise NotImplementedError("FIXME")

        await run_preview(
            "obsolete_hash_preview",
            str(path),
        )

        await run_import_candidate(
            "obsolete_hash_import",
            str(path),
            candidate_id=None,
            duplicate_action="ask",
        )

        self.statuses = []
        with pytest.raises(
            Exception,
            match="Already progressed past preview",
        ):
            await run_import_candidate(
                "obsolete_hash_import",
                str(path / "Chant [SINGLE]"),
                candidate_id=None,  # None uses best match
                duplicate_action="ask",  # ask raises on duplicate
            )

        # Check that status was emitted correctly, we emit once before and once after run
        assert len(self.statuses) == 2
        assert self.statuses[0]["status"] == FolderStatus.IMPORTING
        assert self.statuses[1]["status"] == FolderStatus.FAILED
