import pytest
from quart import Response


class TestFileUploadErrors:
    async def test_successful_file_upload(self, client, tmp_path, monkeypatch):
        # Setup: create a valid inbox directory
        inbox_dir = tmp_path / "inbox"
        inbox_dir.mkdir(parents=True, exist_ok=True)
        target_dir = inbox_dir / "nested" / "subdir"

        monkeypatch.setattr(
            "beets_flask.server.routes.file_upload.get_inbox_folders",
            lambda: [str(inbox_dir)],
        )
        filename = "uploaded.txt"
        file_content = b"hello test file upload"
        headers = {
            "X-Filename": filename,
            "X-File-Target-Dir": str(target_dir),
        }
        response = await client.post(
            "/api_v1/file_upload/",
            headers=headers,
            data=file_content,
        )

        # Check status codes
        print(f"{target_dir=}")
        data = await response.get_json()
        assert response.status_code == 200
        assert data["status"] == "ok"

        # Check file exists in target dir and content matches
        final_path = target_dir / filename
        assert final_path.exists()
        with open(final_path, "rb") as f:
            assert f.read() == file_content

    @pytest.mark.parametrize(
        "headers",
        [
            {"X-File-Target-Dir": "/some/path"},
            {"X-Filename": "file.txt"},
        ],
    )
    async def test_missing_required_headers(self, client, headers):
        response = await client.post(
            "/api_v1/file_upload/",
            headers=headers,
            data=b"testdata",
        )
        data = await response.get_json()
        assert str(response.status_code).startswith("4")
        assert data["type"] == "InvalidUsageException"
        assert "Missing header" in data["message"]

    async def test_invalid_target_path(self, client, monkeypatch):
        # Patch get_inbox_folders to return a known inbox path
        monkeypatch.setattr(
            "beets_flask.server.routes.file_upload.get_inbox_folders",
            lambda: ["/valid/inbox"],
        )
        response = await client.post(
            "/api_v1/file_upload/",
            headers={
                "X-Filename": "file.txt",
                "X-File-Target-Dir": "/invalid/path",
            },
            data=b"testdata",
        )
        data = await response.get_json()
        assert str(response.status_code).startswith("4")
        assert data["type"] == "InvalidUsageException"
        assert "Invalid target path" in data["message"]
