"""Import/Preview flow tests for the backend.

These tests are designed to ensure that the import and preview flows work as expected. These
flows may be triggered from the frontend by the users and we want to ensure that everything
has a well defined path to follow.
"""

from abc import ABC
from pathlib import Path
from unittest import mock

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from beets_flask.database.models.states import FolderInDb, SessionStateInDb
from beets_flask.importer.progress import FolderStatus
from beets_flask.invoker import Progress, run_import_candidate, run_preview
from tests.mixins.database import IsolatedBeetsLibraryMixin, IsolatedDBMixin
from tests.unit.test_importer.conftest import (
    VALID_PATHS,
    album_path_absolute,
    use_mock_tag_album,
)


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


class TestImportBest(
    InvokerStatusMockMixin, IsolatedDBMixin, IsolatedBeetsLibraryMixin
):
    """Test a typical import using the best candidate.

    This should be the most common case, i.e. the candidate looks good!

    The flow is as follows:
    - Generate Preview
    - Import best candidate
    - Trying to reimport same session should fail
    - Trying to import another session with duplicate candidate should fail
    - Revert import should work
    """

    @pytest.fixture()
    def path(self) -> Path:
        path = album_path_absolute(VALID_PATHS[0])
        use_mock_tag_album(str(path))
        return path

    async def test_preview(self, db_session: Session, path: Path):
        """Test the preview of the import process."""

        stmt = select(SessionStateInDb).order_by(SessionStateInDb.created_at.desc())
        assert (
            db_session.execute(stmt).scalar() is None
        ), "Database should be empty before the test"

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
            assert (
                len(c.duplicate_ids) == 0
            ), "Should not have duplicates in empty library"

    async def test_import(self, db_session: Session, path: Path):
        """
        Test the import of the tagged folder.

        The preview of the previous test should still exist in the database,
        because we reset the db via IsolatedDBMixin on scope=class
        """

        stmt = select(func.count()).select_from(SessionStateInDb)
        assert (
            db_session.execute(stmt).scalar() == 1
        ), "Database should contain the one preview session state from the previous test"

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
            assert (
                len(c.duplicate_ids) == 0
            ), "Should not have duplicates in empty library"

        # Check that we have the items in the beets lib
        albums = self.beets_lib.albums()
        assert len(albums) == 1, "Should have imported one album"

        # gui import ids are set
        album = albums[0]
        assert hasattr(album, "gui_import_id"), "Album should have gui_import_id"
        assert album.gui_import_id is not None, "Album should have gui_import_id"

    async def test_reimport_fails(self, db_session: Session, path: Path):
        """Reimport should fail if the state is already imported.

        We use errors as values here so we need to check the return value
        """
        stmt = select(func.count()).select_from(SessionStateInDb)
        assert (
            db_session.execute(stmt).scalar() == 1
        ), "Database should contain the one preview session state from the previous test"

        self.statuses = []

        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path),
            candidate_id=None,  # None uses best match
            duplicate_action="ask",
        )

        assert exc is not None
        assert isinstance(exc, Exception)
        assert str(exc) == "Already progressed past preview"

        assert len(self.statuses) == 2
        assert self.statuses[0]["status"] == FolderStatus.IMPORTING
        assert self.statuses[1]["status"] == FolderStatus.FAILED

    async def test_duplicate_import_fails(self, path: Path):
        """
        Duplicates should normally only happen if you import the same
        items from a different folder.

        We use the same items but a different folder here ;) A bit
        hacky but works for our purpose.
        """

        # Check item already in beets library
        albums = self.beets_lib.albums()
        assert len(albums) == 1, "Should have imported one album"

        await run_preview(
            "obsolete_hash_preview",
            str(path / "Chant [SINGLE]"),
        )

        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path / "Chant [SINGLE]"),
            candidate_id=None,  # None uses best match
            duplicate_action="ask",  # ask raises on duplicate
        )

        # FIXME: We might want to raise our own exception here
        assert exc is not None
        assert isinstance(exc, Exception)
        assert str(exc) == "Duplicate action 'ask', but no user choice was provided."

    @pytest.mark.parametrize("duplicate_action", ["skip", "merge", "remove", "keep"])
    async def test_duplicate_with_action(
        self, db_session: Session, path: Path, duplicate_action
    ):
        """Test the duplicate action with a different action.

        This should not return an error but just do the action (if not ask).
        """

        # Check item already in beets library
        p = str(path / "Chant [SINGLE]")
        albums = self.beets_lib.albums()
        assert len(albums) == 1, "Should have imported one album"

        # TODO: If a session failed before how do we want to handle/this?
        stmt = (
            select(SessionStateInDb).join(FolderInDb).where(FolderInDb.full_path == p)
        )
        session_state = db_session.execute(stmt).scalar()
        assert session_state is not None

        # Reset progress to PREVIEW_COMPLETED
        for task in session_state.tasks:
            task.progress = Progress.PREVIEW_COMPLETED

        db_session.commit()

        self.statuses = []
        exc = await run_import_candidate(
            "obsolete_hash_import",
            p,
            candidate_id=None,  # None uses best match
            duplicate_action=duplicate_action,
        )

        # Shouldn't return an error
        assert exc is None
        assert len(self.statuses) == 2
        assert self.statuses[0]["status"] == FolderStatus.IMPORTING
        assert self.statuses[1]["status"] == FolderStatus.IMPORTED

    @pytest.mark.skip(reason="Implement")
    async def test_revert(self, db_session: Session, path: Path):
        """Test the revert of the import process.

        This should remove the items from the beets library and
        set the progress back to PREVIEW_COMPLETED. Also the disk
        items should be removed/moved back.
        """
        raise NotImplementedError("Implement me")


class TestImportAsis(
    InvokerStatusMockMixin, IsolatedDBMixin, IsolatedBeetsLibraryMixin
):
    """Test a typical import using the asis candidate.

    We have an extra test for this as the asis candidate is a bit special,
    it is generated by us and uses the original file metadata. Thus just
    to be sure we test it separately.

    The flow is as follows:
    - Generate Preview
    - Import asis candidate
    - Trying to reimport same session should fail
    - Trying to import another session with duplicate candidate should fail
    """

    @pytest.mark.skip(reason="Implement")
    def test_import_asis(self, db_session: Session, path: Path):
        raise NotImplementedError("Implement me")


class TestImportCandidate(
    InvokerStatusMockMixin, IsolatedDBMixin, IsolatedBeetsLibraryMixin
):
    """Test a typical import using the specific candidate.

    The flow is as follows:
    - Generate Preview
    - Import specific candidate
    - Trying to reimport same session should fail
    - Trying to import another session with duplicate candidate should fail
    """

    @pytest.mark.skip(reason="Implement")
    def test_import_candidate(self, db_session: Session, path: Path):
        raise NotImplementedError("Implement me")
