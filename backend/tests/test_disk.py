import os
import shutil
import tempfile
import pytest

from beets_flask.disk import (
    is_album_folder,
    all_album_folders,
    album_folders_from_track_paths,
    is_within_multi_dir,
)


def touch(path):
    with open(path, "w") as f:
        pass


@pytest.fixture
def base():
    """
    Create a folder structure for testing purposes.
    """
    base = tempfile.mkdtemp()

    # music files and misc
    os.makedirs(os.path.join(base, "artist/album_good"))
    touch(os.path.join(base, "artist/album_good/cover.jpg"))
    touch(os.path.join(base, "artist/album_good/track_1.mp3"))
    touch(os.path.join(base, "artist/album_good/track_2.mp3"))

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


def test_is_album_folder_empty(base):
    assert not is_album_folder(base + "/artist/album_empty")


def test_is_album_folder_good(base):
    assert is_album_folder(base + "/artist/album_good")


def test_is_album_folder_junk(base):
    assert not is_album_folder(base + "/artist/album_junk")


def test_is_album_folder_multi(base):
    assert is_album_folder(base + "/artist/album_multi/1")
    assert is_album_folder(base + "/artist/album_multi/1/CD1")
    assert is_album_folder(base + "/artist/album_multi/1/CD2")


def test_all_album_folders_no_subdirs(base):
    print(all_album_folders(base))
    assert set(all_album_folders(base)) == {
        base + "/artist/album_good",
        base + "/artist/album_multi/1",
        base + "/artist/album_multi/2",
        base + "/artist/album_multi/2/CD1",
        base + "/artist/album_multi/2/CD2",
    }


def test_all_album_folders_with_subdirs(base):
    assert set(all_album_folders(base, subdirs=True)) == {
        base + "/artist/album_good",
        base + "/artist/album_multi/1",
        base + "/artist/album_multi/1/CD1",
        base + "/artist/album_multi/1/CD2",
        base + "/artist/album_multi/2",
        base + "/artist/album_multi/2/CD1",
        base + "/artist/album_multi/2/CD2",
    }


def test_is_within_multi_dir(base):
    assert is_within_multi_dir(base + "/artist/album_multi/1/CD1/")
    assert is_within_multi_dir(base + "/artist/album_multi/1/CD2/")
    # should work with and without trailing slashes
    assert is_within_multi_dir(base + "/artist/album_multi/2/CD1")
    assert is_within_multi_dir(base + "/artist/album_multi/2/CD2")
    assert not is_within_multi_dir(base + "/artist/album_multi/")
    assert not is_within_multi_dir(base + "/artist/album_good/")


def test_album_folders_from_track_path_1(base):
    folders = album_folders_from_track_paths([base + "/artist/album_good/track_1.mp3"])
    assert folders == [base + "/artist/album_good"]


def test_album_folders_from_track_path_2(base):
    folders = album_folders_from_track_paths(
        [base + "/artist/album_multi/1/CD1/track_1.mp3"],
        # this is a bit of an edge-case: the subdirs arg has no effect here,
        # cos only one file (and therefore, no way to
        use_parent_for_multidisc=False,
    )
    assert folders == [
        base + "/artist/album_multi/1/CD1",
    ]


def test_album_folders_from_track_path_3(base):
    folders = album_folders_from_track_paths(
        [
            base + "/artist/album_multi/1/CD1/track_1.mp3",
            base + "/artist/album_multi/1/CD2/track_1.mp3",
        ],
        use_parent_for_multidisc=False,
    )
    assert folders == [
        base + "/artist/album_multi/1/CD1",
        base + "/artist/album_multi/1/CD2",
    ]


def test_album_folders_from_track_path_4(base):
    folders = album_folders_from_track_paths(
        [
            base + "/artist/album_multi/1/CD1/track_1.mp3",
            base + "/artist/album_multi/1/CD2/track_1.mp3",
        ],
        use_parent_for_multidisc=True,
    )
    assert folders == [
        base + "/artist/album_multi/1",
    ]
