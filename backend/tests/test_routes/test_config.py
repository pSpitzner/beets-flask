def test_get_all(client):
    # Not really much we can test here
    response = client.get("/api_v1/config/all")

    assert response.status_code == 200


def test_get_basic(client):
    response = client.get("/api_v1/config/")

    assert response.status_code == 200

    data = response.get_json()

    assert "gui" in data
    assert "import" in data
    assert "match" in data
