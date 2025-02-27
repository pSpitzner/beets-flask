import os
from hashlib import md5

from cachetools import Cache, TTLCache, cached

cache = TTLCache(maxsize=1024, ttl=900)


def dirhash_c(dirname: str, cache: Cache[str, bytes]) -> bytes:
    """Compute a hash for a directory.

    The hash is computed by hashing the path of each file and using
    its filesystem metadata (size, mtime, ctime).

    Parameters
    ----------
    dirname: str
        The path to the directory
    cache: dict, optional
        A cache object to store intermediate results. If None, no caching is used.
    """
    if dirname in cache:
        return cache[dirname]

    hash = md5()

    # Hash for each entry in the directory
    for entry in os.scandir(dirname):
        if entry.is_dir():
            hash.update(dirhash_c(entry.path, cache))
        else:
            # TODO: Filter audio only
            fs = os.stat(entry.path)

            hash.update(fs.st_size.to_bytes(8, byteorder="big"))
            hash.update(fs.st_ino.to_bytes(8, byteorder="big"))
            hash.update(str(fs.st_mtime).encode())
            hash.update(entry.name.encode())

    return hash.digest()


__all__ = ["dirhash_c"]
