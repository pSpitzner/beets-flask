import os
import shutil
from pathlib import Path

import pytest


def touch(path):
    with open(path, "w") as f:
        pass


@pytest.fixture(scope="session")
def base(tmpdir_factory):
    """
    Create a folder structure for testing purposes.
    """
    base = str(tmpdir_factory.mktemp("beets_flask_disk"))

    # music files and misc
    os.makedirs(os.path.join(base, "artist/album_good"))
    source = Path(__file__).parent.parent / "data" / "audio"
    dest = Path(base) / "artist" / "album_good"
    shutil.copytree(source, dest, dirs_exist_ok=True)

    # empty folder
    os.makedirs(os.path.join(base, "artist/album_empty"))

    # no music files, just junk.
    # this depends on the ignored filetypes in the beets config.
    # but with the default config, hidden files should be ignored:
    os.makedirs(os.path.join(base, "artist/album_junk"))
    touch(os.path.join(base, "artist/album_junk/.junk.jpg"))

    # nested folders
    os.makedirs(os.path.join(base, "artist/album_multi/1/CD1"))
    os.makedirs(os.path.join(base, "artist/album_multi/1/CD2"))
    touch(os.path.join(base, "artist/album_multi/1/CD1/track_1.mp3"))
    touch(os.path.join(base, "artist/album_multi/1/CD2/track_1.mp3"))

    os.makedirs(os.path.join(base, "artist/album_multi/2/CD1"))
    os.makedirs(os.path.join(base, "artist/album_multi/2/CD2"))
    touch(os.path.join(base, "artist/album_multi/2/CD1/track_1.mp3"))
    touch(os.path.join(base, "artist/album_multi/2/CD2/track_1.mp3"))
    # the annoying rogue element
    touch(os.path.join(base, "artist/album_multi/2/should_not_be_here.mp3"))

    yield base

    shutil.rmtree(base)


from beets_flask.disk import is_album_folder


class TestIsAlbumFolder:
    @pytest.mark.parametrize(
        "type",
        [Path, str, lambda x: str(x).encode("utf-8")],
    )
    def test_folder_empty(self, type, base):
        p = type(base + "/artist/album_empty")
        assert not is_album_folder(p)

    @pytest.mark.parametrize(
        "type",
        [Path, str, lambda x: str(x).encode("utf-8")],
    )
    def test_folder_good(self, type, base):
        p = type(base + "/artist/album_good")
        assert is_album_folder(p)

    def test_folder_junk(self, base):
        p = base + "/artist/album_junk"
        assert not is_album_folder(p)

    def test_folder_multi(self, base):
        assert is_album_folder(base + "/artist/album_multi/1")
        assert is_album_folder(base + "/artist/album_multi/1/CD1")
        assert is_album_folder(base + "/artist/album_multi/1/CD2")


def test_all_album_folders_no_subdirs(base):
    from beets_flask.disk import all_album_folders

    all_albums = [
        base + "/artist/album_good",
        base + "/artist/album_multi/1",
        base + "/artist/album_multi/2",
        base + "/artist/album_multi/2/CD1",
        base + "/artist/album_multi/2/CD2",
        base + "/artist/album_good/1991",
        base + "/artist/album_good/1991/Chant [SINGLE]",
        base + "/artist/album_good/Annix",
        base + "/artist/album_good/Annix/Antidote",
    ]

    print(all_album_folders(base))
    assert set(all_album_folders(base)) == {Path(p) for p in all_albums}


def test_all_album_folders_with_subdirs(base):
    from beets_flask.disk import all_album_folders

    all_albums_with_subdirs = [
        base + "/artist/album_good",
        base + "/artist/album_good/1991",
        base + "/artist/album_good/1991/Chant [SINGLE]",
        base + "/artist/album_good/Annix",
        base + "/artist/album_good/Annix/Antidote",
        base + "/artist/album_multi/1",
        base + "/artist/album_multi/1/CD1",
        base + "/artist/album_multi/1/CD2",
        base + "/artist/album_multi/2",
        base + "/artist/album_multi/2/CD1",
        base + "/artist/album_multi/2/CD2",
    ]

    assert set(all_album_folders(base, subdirs=True)) == {
        Path(p) for p in all_albums_with_subdirs
    }


def test_is_within_multi_dir(base):
    from beets_flask.disk import is_within_multi_dir

    assert is_within_multi_dir(base + "/artist/album_multi/1/CD1/")
    assert is_within_multi_dir(base + "/artist/album_multi/1/CD2/")
    # should work with and without trailing slashes
    assert is_within_multi_dir(base + "/artist/album_multi/2/CD1")
    assert is_within_multi_dir(base + "/artist/album_multi/2/CD2")
    assert not is_within_multi_dir(base + "/artist/album_multi/")
    assert not is_within_multi_dir(base + "/artist/album_good/")


# input, use_parent_for_multidisc, expected
testdata = [
    (
        ["/artist/album_multi/1/CD1/track_1.mp3"],
        True,
        ["/artist/album_multi/1"],
    ),
    (
        ["/artist/album_multi/1/CD1/track_1.mp3"],
        False,
        ["/artist/album_multi/1/CD1"],
    ),
    (
        [
            "/artist/album_multi/1/CD1/track_1.mp3",
            "/artist/album_multi/1/CD2/track_1.mp3",
        ],
        True,
        ["/artist/album_multi/1"],
    ),
    (
        [
            "/artist/album_multi/1/CD1/track_1.mp3",
            "/artist/album_multi/1/CD2/track_1.mp3",
        ],
        False,
        [
            "/artist/album_multi/1/CD1",
            "/artist/album_multi/1/CD2",
        ],
    ),
]


@pytest.mark.parametrize(
    "input, use_parent_for_multidisc, expected",
    testdata,
)
def test_album_folders_from_track(
    base, input: list[str], use_parent_for_multidisc: bool, expected: list[str]
):
    from beets_flask.disk import album_folders_from_track_paths

    # Try legacy using string paths
    # TODO: Remove once we have migrated to Path objects
    folders = album_folders_from_track_paths(
        [base + p for p in input],
        use_parent_for_multidisc=use_parent_for_multidisc,
    )

    assert len(folders) == len(expected)
    for i, e in enumerate(expected):
        assert folders[i] == Path(base + e)

    # Test same thing with Path objects
    folders = album_folders_from_track_paths(
        [Path(base + p) for p in input],
        use_parent_for_multidisc=use_parent_for_multidisc,
    )

    assert len(folders) == len(expected)
    for i, e in enumerate(expected):
        assert folders[i] == Path(base + e)
