import pytest
from beets_flask import create_app

BACKEND_URL = "http://localhost:5001/api_v1"


@pytest.fixture()
def app():
    app = create_app()
    app.config.update(
        {
            "TESTING": True,
        }
    )

    # other setup can go here
    print(f"Flask Blueprint Routes:")
    for blueprint_name, blueprint in app.blueprints.items():
        print(f"\n  Blueprint: {blueprint_name}")
        for rule in app.url_map.iter_rules():
            if rule.endpoint.startswith(blueprint_name):
                print(f"    {str(rule):<46} {str(rule.methods):>40}")

    yield app

    # clean up / reset resources here


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def runner(app):
    return app.test_cli_runner()


def test_inbox_route(client):
    # we need the redirects because of vite
    response = client.get(BACKEND_URL + "/inbox", follow_redirects=True)
    assert response.status_code == 200

def test_inbox_content(client):
    import os, shutil
    os.makedirs("/music/inbox/dummy_album/", exist_ok=True)
    with open('/music/inbox/dummy_album/track1.mp3', 'a'):
        pass
    response = client.get(BACKEND_URL + "/inbox", follow_redirects=True)
    assert "dummy_album" in response.data.decode("utf-8")
    assert "track1.mp3" in response.data.decode("utf-8")
    shutil.rmtree("/music/inbox/dummy_album/")
