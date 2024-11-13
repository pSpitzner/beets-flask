"""This tests if we can create and delete tags.
"""

from beets_flask.database.models.tag import Tag


def test_add_tag(db_session, tmp_path):
    tag_id = add_tag(db_session, str(tmp_path))
    read_tag = Tag.get_by(Tag.id == tag_id)
    assert read_tag is not None


def test_delete_tag(db_session, tmp_path):
    tag_id = add_tag(db_session, str(tmp_path))
    tag = Tag.get_by(Tag.id == tag_id, session=db_session)
    db_session.delete(tag)
    db_session.commit()
    read_tag = Tag.get_by(Tag.id == tag_id)
    assert read_tag is None


def add_tag(session, folder):
    tag = Tag(
        album_folder=folder,
        kind="preview",
        status="dummy",
    )
    session.merge(tag)
    session.commit()
    return tag.id
