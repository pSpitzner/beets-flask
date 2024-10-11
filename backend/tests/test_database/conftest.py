import pytest

from beets_flask.database import db_session


@pytest.fixture(name="db_session")
def fixture_db_session(testapp):
    with db_session() as session:
        yield session
