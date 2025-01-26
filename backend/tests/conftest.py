import asyncio
import os
import pytest
from beets_flask.__init__ import create_app

from beets_flask.config.beets_config import refresh_config
from quart import Quart
from quart.typing import TestClientProtocol


@pytest.fixture(name="testapp", scope="session")
def fixture_testapp():

    app = create_app("test")

    yield app


@pytest.fixture(name="client")
def fixture_client(testapp: Quart) -> TestClientProtocol:
    return testapp.test_client()


@pytest.fixture(name="runner")
def fixture_runner(app):
    return app.test_cli_runner()


@pytest.fixture(autouse=True)
def beets_lib(tmpdir_factory):

    # Setup beets to use the tempdir
    # for reference, see also
    # https://github.com/beetbox/beets/blob/22163d70a77449d83670e60ad3758474463de31b/beets/test/helper.py#L196
    tmp_dir = tmpdir_factory.mktemp("beets_flask")
    os.environ["BEETSDIR"] = str(tmp_dir / "beets")
    os.environ["HOME"] = str(tmp_dir)
    os.makedirs(tmp_dir / "beets", exist_ok=True)

    # Initialize a new beets library
    import beets.library

    lib = beets.library.Library(path=str(tmp_dir / "beets" / "library.db"))

    refresh_config()

    # Yield the library for other functions to use
    yield lib

    # Remove the beets database
    # os.remove(temp_dir / "beets.db")


def beets_lib_item(**kwargs):
    """
    Usage:

    beets_lib.add(item(title="the title", artist="the artist", album="the album"))
    """
    import beets.library

    default_kwargs = dict(
        title="the title",
        artist="the artist",
        albumartist="the album artist",
        album="the album",
        genre="the genre",
        lyricist="the lyricist",
        composer="the composer",
        arranger="the arranger",
        grouping="the grouping",
        year=1,
        month=2,
        day=3,
        track=4,
        tracktotal=5,
        disc=6,
        disctotal=7,
        lyrics="the lyrics",
        comments="the comments",
    )
    default_kwargs.update(kwargs)

    i = beets.library.Item(
        None,
        **default_kwargs,
    )
    return i


def beets_lib_album(**kwargs):
    """
    Usage:

    beets_lib.add(album(title="the title", artist="the artist"))
    """
    import beets.library

    default_kwargs = dict(
        album="the album",
        albumartist="the album artist",
        genre="the genre",
        year=1,
        month=2,
        day=3,
        tracktotal=5,
        disctotal=7,
        lyrics="the lyrics",
        comments="the comments",
    )
    default_kwargs.update(kwargs)

    a = beets.library.Album(
        db=None,
        **default_kwargs,
    )
    return a
