class TestErrorHandling:

    def test_invalid_usage(self, client):
        response = client.get("/api_v1/error/invalidUsage")
        data = response.get_json()
        assert response.status_code == 400
        assert data["error"] == "Bad request"
        assert data["message"] == "This is a bad request"

    def test_not_implemented(self, client):
        response = client.get("/api_v1/error/notImplemented")
        data = response.get_json()
        assert response.status_code == 501
        assert data["error"] == "Not implemented"

    def test_config_error(self, client):
        response = client.get("/api_v1/error/configError")
        data = response.get_json()
        assert response.status_code == 400
        assert data["error"] == "Bad request"
        assert data["message"] == "Configuration Error"

    def test_file_not_found(self, client):
        response = client.get("/api_v1/error/fileNotFound")
        data = response.get_json()
        assert response.status_code == 404
        assert data["error"] == "File not found"
        assert data["message"] == "This is a file not found error"

    def test_generic_error(self, client):
        response = client.get("/api_v1/error/genericError")
        data = response.get_json()
        assert response.status_code == 500
        assert data["error"] == "Internal server error"
        assert "message" in data
        assert "trace" in data
