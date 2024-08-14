import pytest


@pytest.fixture(name="testapp")
def fixture_testapp():
    from interactive_beets import create_app

    app = create_app("test")
    return app


@pytest.fixture(name="client")
def fixture_client(testapp):
    return testapp.test_client()
