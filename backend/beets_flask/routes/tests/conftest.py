import pytest
from beets_flask.__init__ import create_app


@pytest.fixture(name="testapp")
def fixture_testapp():

    app = create_app("test")

    yield app

    # Cleanup goes here if needed


@pytest.fixture(name="client")
def fixture_client(testapp):
    return testapp.test_client()
