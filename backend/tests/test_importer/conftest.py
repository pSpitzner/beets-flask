import logging
import os
import shutil
from pathlib import Path
from typing import List, Optional

import pytest

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)


VALID_PATHS = ["1992", "1992/Chant [SINGLE]", "Annix", "Annix/Antidote"]


# Path relative to data/audio
@pytest.fixture
def album_paths(tmpdir_factory):
    # Create a temporary directory
    tmpdir = tmpdir_factory.mktemp("audio")

    destinations = []

    for path in VALID_PATHS:
        # Copy files
        source = Path(__file__).parent.parent / "data" / "audio" / path
        destination = tmpdir / path
        # os.makedirs(destination, exist_ok=True)

        shutil.rmtree(destination, ignore_errors=True)
        shutil.copytree(source, destination)
        destinations.append(Path(destination))

    yield destinations

    # Clean up
    shutil.rmtree(tmpdir)


# ----------------- Monkeypath beets to use cached responses ----------------- #

import pickle

from beets import autotag
from beets.autotag import tag_album as _tag_album

album_path: str


def use_mock_tag_album(a_dir: str):
    """Use a cached lookup for the tag_album function in beets
    this allows to not make requests to the internet when testing
    the importer.
    """
    global album_path
    album_path = a_dir

    autotag.tag_album = tag_album


def tag_album(
    items,
    search_artist: Optional[str] = None,
    search_album: Optional[str] = None,
    search_ids: List[str] = [],
):
    global album_path
    log.debug(f"Using monkey patched lookup {album_path=}")

    if (Path(album_path) / "lookup.pickle").exists():
        log.debug(f"Using cached lookup {album_path=}")
        with open(Path(album_path) / "lookup.pickle", "rb") as f:
            return pickle.load(f)

    else:
        log.debug(f"Using default lookup {album_path=}")
        res = _tag_album(items, search_artist, search_album, search_ids)
        with open(Path(album_path) / "lookup.pickle", "wb") as f:
            pickle.dump(res, f)

        return res


autotag.tag_album = tag_album
