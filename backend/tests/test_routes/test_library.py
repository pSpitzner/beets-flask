"""
Currently still requires a beets library with some content in
the default location of the user.
"""

import pytest
from quart.typing import TestClientProtocol as Client
from ..conftest import beets_lib_item, beets_lib_album


class TestArtistsEndpoint:
    """Test class for the Albums endpoint in the API.

    This class contains tests for retrieving albums and individual album details
    from the beets library via the API.
    """

    artists = [
        "Basstripper",
        "Beta",
    ]

    @pytest.fixture(autouse=True)
    def albums(self, beets_lib):  # type: ignore
        """Fixture to add albums to the beets library before running tests."""
        for artist in self.artists:
            beets_lib.add(beets_lib_album(albumartist=artist))
            beets_lib.add(beets_lib_item(albumartist=artist))

    @pytest.mark.asyncio
    async def test_get_artists(self, client: Client, beets_lib):
        """Test the GET request to retrieve all albums by a specific artist.

        Asserts:
            - The response status code is 200 for each artist.
            - The returned data artist matches the requested artist.
        """

        response = await client.get("/api_v1/library/artist/")
        data = await response.get_json()
        assert response.status_code == 200, "Response status code is not 200"
        assert len(data) == len(self.artists), "Data length is not 2"

    @pytest.mark.asyncio
    async def test_get_artist(self, client: Client, beets_lib):
        """Test the GET request to retrieve a specific artist by its ID.

        Asserts:
            - The response status code is 200 for each artist.
            - The returned data ID matches the requested artist ID.
        """

        for artist in self.artists:
            response = await client.get(f"/api_v1/library/artist/{artist}")
            data = await response.get_json()
            assert response.status_code == 200, "Response status code is not 200"

            # We added one album and one item for each artist
            assert len(data["albums"]) == 1, "Data length is not 1"
            assert (
                data["albums"][0]["albumartist"] == artist
            ), "Data artist does not match artist"


class TestAlbumsEndpoint:
    """Test class for the Albums endpoint in the API.

    This class contains tests for retrieving albums and individual album details
    from the beets library via the API.
    """

    @pytest.fixture(autouse=True)
    def albums(self, beets_lib):  # type: ignore
        """Fixture to add albums to the beets library before running tests."""
        beets_lib.add(beets_lib_album(artist="Basstripper", album="Bass"))
        beets_lib.add(beets_lib_album(artist="Beta"))

    @pytest.mark.asyncio
    async def test_get_albums(self, client: Client):
        """Test the GET request to retrieve all albums.

        Asserts:
            - The response status code is 200.
            - The data returned is a list with the expected length.
        """
        response = await client.get("/api_v1/library/album/")
        data = await response.get_json()
        assert response.status_code == 200, "Response status code is not 200"
        assert len(data) == 1, "Data length is not 1"

    @pytest.mark.asyncio
    async def test_get_album(self, client: Client, beets_lib):
        """Test the GET request to retrieve a specific album by its ID.

        Asserts:
            - The response status code is 200 for each album.
            - The returned data ID matches the requested album ID.
        """
        albums = beets_lib.albums()
        for album in albums:
            response = await client.get(f"/api_v1/library/album/{album.id}")
            data = await response.get_json()
            assert response.status_code == 200, "Response status code is not 200"
            assert data["id"] == album.id, "Data id does not match album id"


# ---------------------------------------------------------------------------- #
#                                  Beets items                                 #
# ---------------------------------------------------------------------------- #


class TestItemsEndpoint:
    """Test class for the Items endpoint in the API.

    This class contains tests for retrieving items and individual item details
    from the beets library via the API.
    """

    @pytest.fixture(autouse=True)
    def items(self, beets_lib):  # type: ignore
        """Fixture to add items to the beets library before running tests."""
        beets_lib.add(beets_lib_album(artist="Basstripper", album="Bass"))
        beets_lib.add(beets_lib_album(artist="Beta", album="Alpha"))

    @pytest.mark.asyncio
    async def test_get_items(self, client: Client):
        """Test the GET request to retrieve all items.

        Asserts:
            - The response status code is 200.
            - The data returned is a list with the expected length.
        """
        response = await client.get("/api_v1/library/item/")
        data = await response.get_json()
        assert response.status_code == 200, "Response status code is not 200"
        assert len(data) == 1, "Data length is not 1"

    @pytest.mark.asyncio
    async def test_get_item(self, client: Client, beets_lib):
        """Test the GET request to retrieve a specific item by its ID.

        Asserts:
            - The response status code is 200 for each item.
            - The returned data ID matches the requested item ID.
        """
        items = beets_lib.items()
        for item in items:
            response = await client.get(f"/api_v1/library/item/{item.id}")
            data = await response.get_json()
            assert response.status_code == 200, "Response status code is not 200"
            assert data["id"] == item.id, "Data id does not match item id"


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
