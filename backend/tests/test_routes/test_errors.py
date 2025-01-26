import pytest


class TestErrorHandling:

    @pytest.mark.asyncio
    async def test_invalid_usage(self, client):
        response = await client.get("/api_v1/error/invalidUsage")
        data = await response.get_json()
        assert response.status_code == 400
        assert data["error"] == "Bad request"
        assert data["message"] == "This is a bad request"

    @pytest.mark.asyncio
    async def test_not_implemented(self, client):
        response = await client.get("/api_v1/error/notImplemented")
        data = await response.get_json()
        assert response.status_code == 501
        assert data["error"] == "Not implemented"

    @pytest.mark.asyncio
    async def test_config_error(self, client):
        response = await client.get("/api_v1/error/configError")
        data = await response.get_json()
        assert response.status_code == 400
        assert data["error"] == "Bad request"
        assert data["message"] == "Configuration Error"

    @pytest.mark.asyncio
    async def test_file_not_found(self, client):
        response = await client.get("/api_v1/error/fileNotFound")
        data = await response.get_json()
        assert response.status_code == 404
        assert data["error"] == "File not found"
        assert data["message"] == "This is a file not found error"

    @pytest.mark.asyncio
    async def test_generic_error(self, client):
        response = await client.get("/api_v1/error/genericError")
        data = await response.get_json()
        assert response.status_code == 500
        assert data["error"] == "Internal server error"
        assert "message" in data
        assert "trace" in data
