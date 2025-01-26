"""
Currently still requires a beets library with some content in
the default location of the user.
"""

import pytest


@pytest.mark.asyncio
async def test_get_albums(client):
    response = await client.get("/api_v1/library/album/")
    data = await response.get_json()
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_album(client):
    response = await client.get("/api_v1/library/album/1")
    data = await response.get_json()
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_item(client):
    response = await client.get("/api_v1/library/item/1")
    data = await response.get_json()
    assert response.status_code == 200


# ---------------------------------------------------------------------------- #
#                                   Test art                                   #
# ---------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_get_art(client):
    response = await client.get("/api_v1/library/item/1/art")
    data = await response.get_json()
    assert response.status_code == 200, repr(data)

    response = await client.get("/api_v1/library/album/1/art")
    data = await response.get_json()
    assert response.status_code == 200, repr(data)
