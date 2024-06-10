import os, shutil
from beets_flask.models import Tag
from beets_flask.db_engine import db_session, reset_database

from .test_flask import app, client, BACKEND_URL


folder = "/music/inbox/dummy_folder"


def setup_function(function):
    os.makedirs(folder, exist_ok=True)


def teardown_function(function):
    reset_database()
    shutil.rmtree(folder)


def add_tag(album_folder):
    with db_session() as session:
        tag = Tag(
            album_folder=album_folder,
            kind="preview",
            status="dummy",
        )
        session.merge(tag)
        session.commit()
        return tag.id


def test_add_tag():
    tag_id = add_tag(folder)
    read_tag = Tag.get_by(Tag.id == tag_id)
    assert read_tag is not None


def test_delete_tag():
    tag_id = add_tag(folder)
    with db_session() as session:
        tag = Tag.get_by(Tag.id == tag_id, session=session)
        session.delete(tag)
        session.commit()
    read_tag = Tag.get_by(Tag.id == tag_id)
    assert read_tag is None


def test_add_tag_route(client):
    os.makedirs(folder, exist_ok=True)
    response = client.post(
        BACKEND_URL + "/tag/add", json={"folder": folder, "kind": "preview"}
    )
    assert response.status_code == 200
    print(response.data)
    assert "id" in response.json
    tag_id = response.json["id"]
    read_tag = Tag.get_by(Tag.id == tag_id)
    assert read_tag is not None
    assert read_tag.album_folder == folder
    assert read_tag.kind == "preview"
    # if the worker has started, we will not have it at "dummy" anymore
    assert read_tag.status in ["dummy", *Tag._valid_statuses]
