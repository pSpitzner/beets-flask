from __future__ import annotations

import os
from abc import ABC
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from beets_flask.importer.types import BeetsLibrary


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
    def setup_database(self, testapp):
        """
        Automatically reset the database before and after ALL tests in this class.

        Args:
            db_session_factory: Pytest fixture providing a database session.
        """
        self.reset_database()
        yield
        self.reset_database()


class IsolatedBeetsLibraryMixin(ABC):
    """
    A pytest mixin class to reset the beets library before and after ALL
    tests in this class are run.

    Usage:
    ```
    class TestMyFeature(IsolatedBeetsLibraryMixin):
        def test_something(self):
            # add to clean db

        def test_something_else(self):
            # db has data from previous test
    ```
    """

    @pytest.fixture(autouse=True, scope="class")
    def setup_beetslib(
        self,
    ):
        """Automatically reset the beets library before and after ALL tests in this class."""
        import beets.library

        from beets_flask.config.beets_config import refresh_config

        try:
            os.remove(os.environ["BEETSDIR"] + "/library.db")
        except OSError:
            pass
        lib = beets.library.Library(path=os.environ["BEETSDIR"] + "/library.db")
        refresh_config()
        # Reset the beets library to a clean state
        yield
        # Reset the beets library to a clean state
        os.remove(os.environ["BEETSDIR"] + "/library.db")

    @property
    def beets_lib(self) -> BeetsLibrary:
        """Return the beets library instance."""
        import beets.library

        from beets_flask.config.beets_config import refresh_config

        lib = beets.library.Library(path=os.environ["BEETSDIR"] + "/library.db")
        refresh_config()
        return lib
