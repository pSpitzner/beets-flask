import os
from hashlib import md5
from pathlib import Path
from re import Pattern
from typing import Optional

from cachetools import Cache


def dirhash_c(
    dirname: str | Path,
    cache: Optional[Cache[str, bytes]],
    filter_regex: Optional[Pattern[str]] = None,
) -> bytes:
    """Compute a hash for a directory.

    The hash is computed by hashing the path of each file and using
    its filesystem metadata (size, mtime, ctime).

    Parameters
    ----------
    dirname: str
        The path to the directory
    cache: dict, optional
        A cache object to store intermediate results. If None, no caching is used.
    filter_regex: re.Pattern, optional
        When calculating checksum contributon for files, only consider
        those that match the provided pattern.
    """
    if isinstance(dirname, Path):
        dirname = str(dirname.resolve())

    if cache is not None and dirname in cache:
        return cache[dirname]

    hash = md5()

    # Hash for each entry in the directory
    for entry in os.scandir(dirname):
        if entry.is_dir():
            hash.update(dirhash_c(entry.path, cache, filter_regex))
        else:
            # Skip files that do not match the filter
            if filter_regex is not None and not filter_regex.match(entry.name):
                print(f"skipping {entry}")
                continue

            fs = os.stat(entry.path)
            hash.update(fs.st_size.to_bytes(8, byteorder="big"))
            hash.update(fs.st_ino.to_bytes(8, byteorder="big"))
            hash.update(str(fs.st_mtime).encode())
            hash.update(entry.name.encode())

    # dirstats
    fs = os.stat(dirname)
    hash.update(dirname.encode())
    # hash.update(fs.st_size.to_bytes(8, byteorder="big"))
    # hash.update(fs.st_ino.to_bytes(8, byteorder="big"))
    # hash.update(str(fs.st_mtime).encode())

    # for dirs we should use very little info.
    # For instance, mtime, ino, size get changed when e.g. a file
    # is added directly inside - and this becomes somewhat inconsistent with
    # regex ignore patterns. (adding an ignored file would still modify the hash)

    return hash.digest()


__all__ = ["dirhash_c"]
