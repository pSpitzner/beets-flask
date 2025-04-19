import pytest


@pytest.mark.asyncio
async def test_get_all(client):
    # Not really much we can test here
    response = await client.get("/api_v1/config/all")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_basic(client):
    response = await client.get("/api_v1/config/")

    assert response.status_code == 200

    data = await response.get_json()

    assert "gui" in data
    assert "import" in data
    assert "match" in data
