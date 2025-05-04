"""Import/Preview flow tests for the backend.

These tests are designed to ensure that the import and preview flows work as expected. These
flows may be triggered from the frontend by the users and we want to ensure that everything
has a well defined path to follow.
"""

from abc import ABC
from pathlib import Path
from typing import TYPE_CHECKING
from unittest import mock

import pytest
from beets_flask.database.models.states import FolderInDb, SessionStateInDb
from beets_flask.disk import Folder
from beets_flask.importer.progress import FolderStatus
from beets_flask.invoker.enqueue import (
    Progress,
    run_import_candidate,
    run_import_undo,
    run_preview,
    run_preview_add_candidates,
)
from beets_flask.server.websocket.status import FolderStatusUpdate, JobStatusUpdate
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
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
    statuses: list[FolderStatusUpdate] = []

    async def send_status_update(self, status):
        """Mock the emit_status decorator"""
        self.statuses.append(status)

    # ??? due to class inheritance, scope="function" effectively becomes class.
    # What we found is that, as is now, we get a websocket that survives between
    # different test functions.
    @pytest.fixture(autouse=True, scope="function")
    def mock(self):
        """Mock the emit_status decorator"""

        with mock.patch(
            "beets_flask.server.websocket.status.send_status_update",
            self.send_status_update,
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
        assert db_session.execute(stmt).scalar() is None, (
            "Database should be empty before the test"
        )

        await run_preview(
            "obsolete_hash_preview",
            str(path),
            group_albums=None,
            autotag=None,
        )

        # Check that status was emitted correctly, we emit once before and once after run
        assert len(self.statuses) == 2
        assert self.statuses[0].status == FolderStatus.PREVIEWING
        assert self.statuses[1].status == FolderStatus.PREVIEWED

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
        assert s_state_live.tasks[0].old_paths is None

        t_state_live = s_state_live.task_states[0]
        assert t_state_live.progress == Progress.PREVIEW_COMPLETED

        for c in t_state_live.candidate_states:
            assert len(c.duplicate_ids) == 0, (
                "Should not have duplicates in empty library"
            )

    async def test_search_candidates(self, db_session: Session, path: Path):
        """Test the search candidates of the import process.

        This should be done in the preview step, but we want to test
        it separately to make sure that the candidates are found correctly.
        """

        stmt = select(SessionStateInDb).order_by(SessionStateInDb.created_at.desc())
        s_state_indb = db_session.execute(stmt).scalar()

        assert s_state_indb is not None
        assert len(s_state_indb.tasks) == 1

        id_99_red_balloons = "189002e7-3285-4e2e-92a3-7f6c30d407a2"
        exc = await run_preview_add_candidates(
            "obsolete_hash_preview",
            str(path),
            search={
                "search_ids": [
                    id_99_red_balloons,
                ],  # Nena 99 Red Balloons
                "search_artist": None,
                "search_album": None,
            },
        )

        assert exc is None, "Should not return an error"

        stmt = select(SessionStateInDb)
        s_state_indb = db_session.execute(stmt).scalar()
        assert s_state_indb is not None
        assert s_state_indb.folder.full_path == str(path)

        # candidates now contain the search results
        s_state_live = s_state_indb.to_live_state()
        assert len(s_state_live.task_states) == 1
        t_state_live = s_state_live.task_states[0]
        album_ids = [c.match.info.album_id for c in t_state_live.candidate_states]
        assert id_99_red_balloons in album_ids, "Should have added the new candidate"

    async def test_regenerate_preview(self, db_session: Session, path: Path):
        """Test the regeneration of the preview of the import process.

        We start from an earlier preview, and want to make sure that
        the new preview creates a state with a higher folder_revision,
        keeping the old one in tact.
        """
        f = Folder.from_path(path)

        exc = await run_preview(
            f.hash,
            str(path),
            group_albums=None,
            autotag=None,
        )
        assert exc is None, "Should not return an error"

        stmt = select(SessionStateInDb.folder_revision)
        revisions = db_session.execute(stmt).scalars().all()

        assert 0 in revisions
        assert 1 in revisions
        assert len(revisions) == 2, "Should have two revisions in the database"

        # clean up the second session
        stmt = delete(SessionStateInDb).where(
            SessionStateInDb.folder_hash == f.hash,
            SessionStateInDb.folder_revision == 1,
        )
        db_session.execute(stmt)
        db_session.commit()

    async def test_import(self, db_session: Session, path: Path):
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
        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path),
            candidate_id=None,  # None uses best match
        )
        assert exc is None, "Should not return an error"
        # raise NotImplementedError("Implement me")

        # Check that status was emitted correctly, we emit once before and once after run
        assert len(self.statuses) == 2
        assert self.statuses[0].status == FolderStatus.IMPORTING
        assert self.statuses[1].status == FolderStatus.IMPORTED

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
        assert s_state_live.tasks[0].old_paths is not None

        t_state_live = s_state_live.task_states[0]
        assert t_state_live.progress == Progress.IMPORT_COMPLETED

        for c in t_state_live.candidate_states:
            assert len(c.duplicate_ids) == 0, (
                "Should not have duplicates in empty library"
            )
        assert t_state_live.chosen_candidate_state_id is not None

        # Check that we have the items in the beets lib
        albums = self.beets_lib.albums()
        assert len(albums) == 1, "Should have imported one album"
        items = albums[0].items()
        assert len(items) == 1, "Should have imported one item"

        # gui import ids are set
        album = albums[0]
        assert hasattr(album, "gui_import_id"), "Album should have gui_import_id"
        assert album.gui_import_id is not None, "Album should have gui_import_id"

    async def test_reimport_fails(self, db_session: Session, path: Path):
        """Reimport should fail if the state is already imported.

        We use errors as values here so we need to check the return value
        """
        stmt = select(func.count()).select_from(SessionStateInDb)
        assert db_session.execute(stmt).scalar() == 1, (
            "Database should contain the one preview session state from the previous test"
        )

        self.statuses = []

        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path),
            candidate_id=None,  # None uses best match
            duplicate_action="ask",
        )

        assert exc is not None
        assert exc["message"] == "Cannot redo imports. Try undo and/or retag!"

        assert len(self.statuses) == 2
        assert self.statuses[0].status == FolderStatus.IMPORTING
        assert self.statuses[1].status == FolderStatus.FAILED

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
            group_albums=None,
            autotag=None,
        )

        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path / "Chant [SINGLE]"),
            candidate_id=None,  # None uses best match
            duplicate_action="ask",  # ask raises on duplicate
        )

        # FIXME: We might want to raise our own exception here
        assert exc is not None
        assert exc["type"] == "DuplicateException"

    async def test_undo(self, db_session: Session, path: Path):
        """Test the undo of the import process.

        This should remove the items from the beets library and
        set the progress back to PREVIEW_COMPLETED. Also the disk
        items should be removed/moved back.
        """

        f = Folder.from_path(path)

        items = self.beets_lib.items()
        item = items[0]
        assert item is not None, "Should have imported at least one item for this test."
        imported_path = Path(item.path.decode("utf-8"))

        self.statuses = []
        exc = await run_import_undo(
            f.hash,
            str(path),
            delete_files=True,
        )

        assert exc is None
        assert len(self.statuses) == 2
        assert self.statuses[0].status == FolderStatus.DELETING
        assert self.statuses[1].status == FolderStatus.DELETED

        items = self.beets_lib.items()
        assert len(items) == 0, "Should have removed all items from beets library"
        assert not imported_path.exists(), "Should have removed the imported files"

    async def test_undo_fails(self, db_session: Session, path: Path):
        """If the session is not in a imported state we should fail."""
        f = Folder.from_path(path)

        exc = await run_import_undo(
            f.hash,
            str(path),
            delete_files=True,
        )

        assert exc is not None
        assert "Cannot undo if never imported" in exc["message"]

    async def test_reimport_after_undo(self, db_session: Session, path: Path):
        # Case two: Import session valid but no beets items
        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path),
            candidate_id=None,  # None uses best match
        )
        assert exc is None

        # Check that we have the items in the beets lib
        albums = self.beets_lib.albums()
        assert len(albums) == 1, "Should have imported one album"
        items = albums[0].items()
        assert len(items) == 1, "Should have imported one item"

        # Check files have been imported
        imported_path = Path(items[0].path.decode("utf-8"))
        assert imported_path.exists(), "Should have imported the files"
        assert imported_path.is_file(), "Should have imported the files"

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

        # Reset session state to PREVIEW_COMPLETED to allow to reuse it on
        # multiple runs of this test
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
        assert self.statuses[0].status == FolderStatus.IMPORTING
        assert self.statuses[1].status == FolderStatus.IMPORTED

        # After import we should not have a duplicate id anymore
        session_state = db_session.execute(stmt).scalar()
        assert session_state is not None
        live_state = session_state.to_live_state()
        assert live_state is not None

        for task in live_state.task_states:
            chosen_candidate = task.chosen_candidate_state
            assert chosen_candidate is not None
            assert len(chosen_candidate.duplicate_ids) == 0, (
                "Should not have duplicates after import"
            )

    async def test_undo_with_missing_beets_items(self, db_session: Session, path: Path):
        f = Folder.from_path(path)
        items = self.beets_lib.items()

        with self.beets_lib.transaction() as tx:
            for item in items:
                item.remove()

        exc = await run_import_undo(
            f.hash,
            str(path),
            delete_files=True,
        )

        assert exc is not None
        assert exc["type"] == "IntegrityException"


class TestChooseCandidatesSingleTask(
    InvokerStatusMockMixin, IsolatedDBMixin, IsolatedBeetsLibraryMixin
):
    """Test a typical import using a choosen candidate."""

    @pytest.fixture()
    def path_single_task(self) -> Path:
        path = album_path_absolute(VALID_PATHS[0])
        use_mock_tag_album(str(path))
        return path

    async def test_choose_candidates(
        self,
        db_session: Session,
        path_single_task: Path,
    ):
        """Test the import of the tagged folder using a candidate id (single task in session)"""

        exc = await run_preview(
            "obsolete_hash_preview",
            str(path_single_task),
            group_albums=None,
            autotag=None,
        )
        assert exc is None, "Should not return an error"

        # Check db contains the tagged folder
        stmt = select(SessionStateInDb)
        s_state_indb = db_session.execute(stmt).scalar()

        assert s_state_indb is not None
        assert s_state_indb.folder.full_path == str(path_single_task)
        assert len(s_state_indb.tasks) == 1

        choosen_candidate = s_state_indb.tasks[0].candidates[-2]

        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path_single_task),
            candidate_id=choosen_candidate.id,
        )
        assert exc is None, "Should not return an error"

        # Check db still contains one tagged folder
        stmt = select(SessionStateInDb)
        s_state_indb = db_session.execute(stmt).scalar()
        assert s_state_indb is not None
        assert s_state_indb.folder.full_path == str(path_single_task)

        # Check choosen candidate is the one we imported
        s_state_live = s_state_indb.to_live_state()
        assert s_state_live is not None
        assert s_state_live.folder_path == path_single_task
        assert len(s_state_live.task_states) == 1
        assert s_state_live.tasks[0].old_paths is not None
        t_state_live = s_state_live.task_states[0]
        assert t_state_live.progress == Progress.IMPORT_COMPLETED
        assert t_state_live.chosen_candidate_state is not None
        assert t_state_live.chosen_candidate_state_id == choosen_candidate.id


class TestMultipleTasks(
    InvokerStatusMockMixin, IsolatedDBMixin, IsolatedBeetsLibraryMixin
):
    """Test a typical import of a multiple tasks using choosen candidates."""

    @pytest.fixture()
    def path_multiple_tasks(self) -> Path:
        path = album_path_absolute("multi")
        use_mock_tag_album(str(path))
        return path

    async def test_choose_candidates_multiple_tasks(
        self,
        db_session: Session,
        path_multiple_tasks: Path,
    ):
        """Test the import of the tagged folder."""

        exc = await run_preview(
            "obsolete_hash_preview",
            str(path_multiple_tasks),
            group_albums=None,
            autotag=None,
        )
        assert exc is None, "Should not return an error"

        # Check db contains the tagged folder with multiple tasks
        stmt = select(SessionStateInDb)
        s_state_indb = db_session.execute(stmt).scalar()
        assert s_state_indb is not None
        assert len(s_state_indb.tasks) > 1, "Should have multiple tasks"

        # For each task, choose a different candidate

        candidates = {}
        for task in s_state_indb.tasks:
            print(task.paths)
            print([c.metadata for c in task.candidates])
            assert len(task.candidates) > 2, "Should have candidates"
            candidates[task.id] = task.candidates[-2].id

        # Check that we have the same number of candidates as tasks
        assert len(candidates) == len(s_state_indb.tasks), (
            "Should have same number of candidates as tasks"
        )

        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path_multiple_tasks),
            candidate_id=candidates,
        )
        assert exc is None, "Should not return an error"

        # Check db still contains one tagged folder
        stmt = select(SessionStateInDb)
        s_state_indb = db_session.execute(stmt).scalar()
        assert s_state_indb is not None
        assert s_state_indb.folder.full_path == str(path_multiple_tasks)
        assert len(s_state_indb.tasks) > 1, "Should have multiple tasks"

    @pytest.mark.parametrize("duplicate_action", ["skip", "merge", "remove", "keep"])
    async def test_duplicate_action(
        self,
        db_session: Session,
        path_multiple_tasks: Path,
        duplicate_action: str,
    ):
        """Test the import of the tagged folder with duplicate action."""

        # Check db contains the tagged folder with multiple tasks
        stmt = select(SessionStateInDb)
        s_state_indb = db_session.execute(stmt).scalar()
        assert s_state_indb is not None
        assert len(s_state_indb.tasks) > 1, "Should have multiple tasks"

        # Reset session state to PREVIEW_COMPLETED to allow to reuse it on
        # multiple runs of this test
        stmt = (
            select(SessionStateInDb)
            .join(FolderInDb)
            .where(FolderInDb.full_path == str(path_multiple_tasks))
        )
        session_state = db_session.execute(stmt).scalar()
        assert session_state is not None
        # Reset progress to PREVIEW_COMPLETED
        for task in session_state.tasks:
            task.progress = Progress.PREVIEW_COMPLETED
        db_session.commit()

        # For each task, choose a different candidate and duplicate action
        duplicate_actions = {}
        candidates = {}
        for task in s_state_indb.tasks:
            assert len(task.candidates) > 2, "Should have candidates"
            candidates[task.id] = task.candidates[-2].id
            duplicate_actions[task.id] = duplicate_action

        # Check that we have the same number of candidates as tasks
        assert len(candidates) == len(s_state_indb.tasks), (
            "Should have same number of candidates as tasks"
        )

        exc = await run_import_candidate(
            "obsolete_hash_import",
            str(path_multiple_tasks),
            candidate_id=candidates,
            duplicate_action=duplicate_actions,
        )
        assert exc is None, "Should not return an error"


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
