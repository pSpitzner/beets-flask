import asyncio
import pytest
from beets_flask.__init__ import create_app


@pytest.fixture(name="testapp", scope="session")
def fixture_testapp():

    app = create_app("test")

    yield app


@pytest.fixture(name="client")
def fixture_client(testapp):
    return testapp.test_client()


@pytest.fixture(name="runner")
def fixture_runner(app):
    return app.test_cli_runner()
