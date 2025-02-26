import os
from hashlib import md5

from cachetools import TTLCache, cached

cache = TTLCache(maxsize=1024, ttl=900)


@cached(cache=cache)
def dirhash(dirname: str) -> bytes:
    hash = md5()

    # Hash for each entry in the directory
    for entry in os.scandir(dirname):
        if entry.is_dir():
            hash.update(dirhash(entry.path))
        else:
            # TODO: Filter audio only
            fs = os.stat(entry.path)

            hash.update(fs.st_size.to_bytes(8, byteorder="big"))
            hash.update(fs.st_ino.to_bytes(8, byteorder="big"))
            hash.update(str(fs.st_mtime).encode())
            hash.update(entry.name.encode())

    return hash.digest()


def dirhash_c(dirname: str, clear_cache=False) -> str:
    """Compute high level hash for a directory.

    The hash is computed by hashing the path of each file and by using
    its filesystem metadata (size, mtime, ctime).

    Parameters
    ----------
    dirname: str
        The path to the directory
    clear_cache: bool, optional
        If True, the cache will be cleared before computing the hash
    """

    global cache
    if clear_cache:
        cache.clear()

    return dirhash(dirname).hex()


__all__ = ["dirhash_c"]
