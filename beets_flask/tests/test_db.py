import os, shutil
from beets_flask.models import Tag
from beets_flask.db_engine import db_session

from .test_flask import app, client


def add_tag(folder : str):
    with db_session() as session:
        os.makedirs(folder, exist_ok=True)
        tag = Tag(
            album_folder=folder,
            kind="preview",
            status="dummy",
        )
        session.merge(tag)
        session.commit()
        shutil.rmtree(folder)
        return tag.id

def test_add_tag():
    tag_id = add_tag("/music/inbox/dummy_folder")
    read_tag = Tag.get_by(Tag.id == tag_id)
    assert read_tag is not None


