import pytest

from beets_flask.database import db_session, Tag


@pytest.fixture
def tags():
    tags = []
    with db_session() as session:
        t = [
            Tag(kind="import", album_folder=f)
            for f in ["/some/folder", "/some/folder2", "/some/folder3"]
        ]
        [session.merge(tag) for tag in t]
        session.commit()
        tags = [tag.to_dict() for tag in t]

    yield tags

    with db_session() as session:
        session.query(Tag).delete()


class TestTagEndpoints:

    def test_add_tag(self, client):
        data = {"kind": "import", "folder": "/some/folder"}
        response = client.post("/api_v1/tag/add", json=data)
        data = response.get_json()
        assert response.status_code == 200
        assert data["message"] == "1 tags added as kind: import"

    def test_get_all_tags(self, client, tags):
        response = client.get("/api_v1/tag/")
        data = response.get_json()
        assert response.status_code == 200
        assert isinstance(data, list)
        assert len(data) == len(tags)
        for tag in tags:
            assert tag.get("id") in [tag.get("id") for tag in data]

    def test_get_tag_by_id(self, client, tags):
        for tag in tags:
            response = client.get(f"/api_v1/tag/id/{tag['id']}")
            data = response.get_json()
            assert response.status_code == 200
            assert isinstance(data, dict)
            assert_same_tag(tag, data)

    def test_delete_tag_by_id(self, client, tags):
        for tag in tags:
            response = client.delete(f"/api_v1/tag/id/{tag['id']}")
            data = response.get_json()
            assert response.status_code == 200
            assert data["message"] == "Tag deleted"

        # Test if tags are deleted
        response = client.delete(f"/api_v1/tag/id/{tags[0]['id']}")
        data = response.get_json()
        assert response.status_code == 404
        assert data["message"] == "Tag not found"

    def test_get_tag_by_folder_path(self, client, tags):
        for tag in tags:
            print({tag["album_folder"]})
            response = client.get(f"/api_v1/tag/path/{tag['album_folder'][1:]}")
            data = response.get_json()
            assert response.status_code == 200
            assert isinstance(data, dict)
            assert_same_tag(tag, data)

    def test_delete_tag_by_folder_path(self, client, tags):
        for tag in tags:
            response = client.delete(f"/api_v1/tag/path/{tag['album_folder'][1:]}")
            data = response.get_json()
            assert response.status_code == 200
            assert data["message"] == "Tag deleted"

        # Test if tags are deleted
        response = client.delete(f"/api_v1/tag/path/{tags[0]['album_folder'][1:]}")
        data = response.get_json()
        assert response.status_code == 404
        assert data["message"] == "Tag not found"


def assert_same_tag(tag1, tag2):
    assert tag1.get("id") == tag2.get("id")
    assert tag1.get("album_folder") == tag2.get("album_folder")
    assert tag1.get("kind") == tag2.get("kind")
