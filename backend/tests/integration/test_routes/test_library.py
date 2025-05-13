"""
Currently still requires a beets library with some content in
the default location of the user.
"""

import pytest
from quart.typing import TestClientProtocol as Client
from tests.conftest import beets_lib_album, beets_lib_item


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
            a = beets_lib_album(albumartist=artist)
            beets_lib.add(a)
            beets_lib.add(beets_lib_item(albumartist=artist, album_id=a.id))

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
            response = await client.get(f"/api_v1/library/artist/{artist}/albums")
            data = await response.get_json()
            assert response.status_code == 200, "Response status code is not 200"
            # We added one album and one item for each artist
            assert len(data) == 1, "Data length is not 1"
            assert data[0]["albumartist"] == artist, "Data artist does not match artist"


class TestAlbumsEndpoint:
    """Test class for the Albums endpoint in the API.

    This class contains tests for retrieving albums and individual album details
    from the beets library via the API.
    """

    @pytest.fixture(autouse=True)
    def albums(self, beets_lib):  # type: ignore
        """Fixture to add albums to the beets library before running tests."""
        a = beets_lib_album(artist="Basstripper", album="Bass")
        beets_lib.add(a)
        beets_lib.add(beets_lib_item(artist="Beta", album_id=a.id))

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
        beets_lib.add(beets_lib_item(artist="Basstripper", album="Bass"))
        beets_lib.add(beets_lib_item(artist="Beta", album="Alpha"))

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


@pytest.mark.skip("Test is skipped because it requires a beets library with art. TODO")
class TestArtEndpoint:
    """Test class for the Art endpoint in the API.

    This class contains tests for retrieving art for items and albums
    from the beets library via the API.
    """

    @pytest.fixture(autouse=True)
    def items(self, beets_lib):  # type: ignore
        """Fixture to add items to the beets library before running tests."""
        beets_lib.add(beets_lib_item(artist="Basstripper", album="Bass"))
        beets_lib.add(beets_lib_album(artist="Beta", album="Alpha"))

    async def test_get_art(self, client: Client, beets_lib):
        """Test the GET request to retrieve art for an item and an album.

        Asserts:
            - The response status code is 200 for each item and album.
        """

        items = beets_lib.items()
        for item in items:
            response = await client.get(f"/api_v1/library/item/{item.id}/art")
            data = await response.get_json()
            print(data)
            assert response.status_code == 200

        albums = beets_lib.albums()

        for album in albums:
            response = await client.get(f"/api_v1/library/album/{album.id}/art")
            data = await response.get_json()
            assert response.status_code == 200
