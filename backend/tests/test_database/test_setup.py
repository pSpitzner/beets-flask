import pytest
from beets_flask.database.setup import with_db_session


def test_with_db_session_decorator(testapp):
    # Needs the testapp

    @with_db_session
    def sample_function(session=None):
        return session is not None

    assert sample_function() is True


