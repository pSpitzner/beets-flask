from abc import ABC
from unittest import mock

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from beets_flask.database.models.states import SessionStateInDb
from beets_flask.importer.progress import FolderStatus
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

    @pytest.fixture(autouse=True, scope="session")
    def mock(self):
        """Mock the emit_status decorator"""

        with mock.patch(
            "beets_flask.invoker.send_folder_status_update",
            self.send_folder_status_update,
            spec=True,
        ):
            yield

    @pytest.fixture(autouse=True)
    def reset_statuses(self):
        """Reset the status stack after each test"""
        yield
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


from beets_flask.invoker import run_preview


class TestImportBest(InvokerStatusMockMixin, IsolatedDBMixin):

    async def test_preview(self, db_session: Session):
        """Test the preview of the import process."""
        path = VALID_PATHS[0]
        path = album_path_absolute(path)
        use_mock_tag_album(str(path))

        stmt = select(SessionStateInDb).order_by(SessionStateInDb.created_at.desc())
        obj_before = db_session.execute(stmt).scalar()
        assert obj_before is None, "Database should be empty before the test"

        await run_preview(
            "test_hash",
            str(path),
        )

        # Check that status was emitted correctly
        assert len(self.statuses) == 2
        assert self.statuses[0]["status"] == FolderStatus.RUNNING
        assert self.statuses[1]["status"] == FolderStatus.TAGGED

        # Check db contains the tagged folder
        stmt = select(SessionStateInDb)
        obj_after = db_session.execute(stmt).scalar()

        assert obj_after is not None
        assert obj_after.folder.full_path == str(path)
