#!/usr/bin/env python
"""dirhash - a python library (and CLI) for hashing of file system directories.

https://github.com/andhus/dirhash-python

Modified here to not hash the full file data, and only use file stats instead.

Using just the stats instead of full file hashes gives a decent speedup and should
suffice for what we need here.
Mixed directory some 4GB: down from ~10s to 400ms

See very end of file

-------------------------------------------------------------------------------

MIT License

Copyright (c) 2019 Anders Huss

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

import hashlib
import os
from functools import partial
from multiprocessing import Pool

from scantree import CyclicLinkedDir, RecursionFilter, scantree

__all__ = [
    "algorithms_guaranteed",
    "algorithms_available",
    "dirhash",
    "dirhash_impl",
    "included_paths",
    "Filter",
    "get_match_patterns",
    "Protocol",
]


algorithms_guaranteed = {"md5", "sha1", "sha224", "sha256", "sha384", "sha512"}
algorithms_available = hashlib.algorithms_available


def dirhash(
    directory,
    algorithm,
    match=("*",),
    ignore=None,
    linked_dirs=True,
    linked_files=True,
    empty_dirs=False,
    entry_properties=("name", "data"),
    allow_cyclic_links=False,
    chunk_size=2**20,
    jobs=1,
):
    """Computes the hash of a directory based on its structure and content.

    # Arguments
        directory: Union[str, pathlib.Path] - Path to the directory to hash.
        algorithm: str - The name of the hashing algorithm to use. See
            `dirhash.algorithms_available` for the available options.
        match: Iterable[str] - An iterable of glob/wildcard match-patterns for paths
            to include when computing the hash. Default is ["*"] which means that all
            files and directories are matched.  To e.g. only include python source
            files, use: `match=["*.py"]`. See "Path Selection and Filtering" section
            below for further details.
        ignore: Optional[Iterable[str]] - An iterable of glob/wildcard match-patterns
            for paths to ignore when computing the hash. Default `None` (no ignore
            patterns). To e.g. exclude hidden files and directories use:
            `ignore=[".*/", ".*"]`. See "Path Selection and Filtering" section below
            for further details.
        linked_dirs: bool - If `True` (default), follow symbolic links to other
            *directories* and include these and their content in the hash
            computation.
        linked_files: bool - If `True` (default), include symbolic linked files in
            the hash computation.
        empty_dirs: bool - If `True`, include empty directories when computing the
            hash. A directory is considered empty if it does not contain any files
            that *matches provided matching criteria*. Default `False`, i.e. empty
            directories are ignored (as is done in git version control).
        entry_properties: Iterable[str] - A set (i.e. order does not matter) of the
            file/directory properties to consider when computing the hash. Supported
            properties are {"name", "data", "is_link"} where at least one of
            "name" and "data" must be included. Default is ["name", "data"] which
            means that the content (actual data) as well as the path relative to the
            root `directory` of files will affect the hash value. See "Entry
            Properties Interpretation" section below for further details.
        allow_cyclic_links: bool - If `False` (default) a `SymlinkRecursionError` is
            raised on presence of cyclic symbolic links. If set to `True` the the
            dirhash value for directory causing the cyclic link is replaced with the
            hash function hexdigest of the relative path from the link to the target.
        chunk_size: int - The number of bytes to read in one go from files while
            being hashed. A too small size will slow down the processing and a larger
            size consumes more working memory. Default 2**20 byte = 1 MiB.
        jobs: int - The number of processes to use when computing the hash.
            Default `1`, which means that a single (the main) process is used. NOTE
            that using multiprocessing can significantly speed-up execution, see
            `https://github.com/andhus/dirhash-python/benchmark` for further
            details.

    # Returns
        str - The hash/checksum as a string of the hexadecimal digits (the result of
        `hexdigest` method of the hashlib._hashlib.HASH object corresponding to the
        provided `algorithm`).

    # Raises
        TypeError/ValueError: For incorrectly provided arguments.
        SymlinkRecursionError: In case the `directory` contains symbolic links that
            lead to (infinite) recursion and `allow_cyclic_links=False` (default).

    # Path Selection and Filtering
        Provided glob/wildcard (".gitignore style") match-patterns determine what
        paths within the `directory` to include when computing the hash value. Paths
        *relative to the root `directory`* (i.e. excluding the name of the root
        directory itself) are matched against the patterns.
            The `match` argument represent what should be *included* - as opposed
        to the `ignore` argument for which matches are *excluded*. Using `ignore` is
        just short for adding the same patterns to the `match` argument with the
        prefix "!", i.e. the calls bellow are equivalent:
            `dirhash(..., match=["*", "!<pattern>"])`
            `dirhash(..., ignore=["<pattern>"])`
        To validate which paths are included, call `dirhash.included_paths` with
        the same values for the arguments: `match`, `ignore`, `linked_dirs`,
        `linked_files` and `empty_dirs` to get a list of all paths that will be
        included when computing the hash by this function.

    # Entry Properties Interpretation
        - ["name", "data"] (Default) - The name as well as data is included. Due to
            the recursive nature of the dirhash computation, "name" implies that the
            path relative to the root `directory` of each file/directory affects the
            computed hash value.
        - ["data"] - Compute the hash only based on the data of files -
            *not* their names or the names of their parent directories. NOTE that
            the tree structure in which files are organized under the `directory`
            root still influences the computed hash. As longs as all files have
            the same content and are organised the same way in relation to all
            other files in the Directed Acyclic Graph representing the file-tree,
            the hash will remain the same (but the "name of nodes" does not
            matter). This option can e.g. be used to verify that that data is
            unchanged after renaming files (change extensions etc.).
        - ["name"] - Compute the hash only based on the name and location of
            files in the file tree under the `directory` root. This option can
            e.g. be used to check if any files have been added/moved/removed,
            ignoring the content of each file.
        - "is_link" - if this options is added to any of the cases above the
            hash value is also affected by whether a file or directory is a
            symbolic link or not. NOTE: with this property added, the hash
            will be different than without it even if there are no symbolic links
            in the directory.

    # References
        See https://github.com/andhus/dirhash/README.md for a formal
        description of how the returned hash value is computed.
    """
    filter_ = Filter(
        match_patterns=get_match_patterns(match=match, ignore=ignore),
        linked_dirs=linked_dirs,
        linked_files=linked_files,
        empty_dirs=empty_dirs,
    )
    protocol = Protocol(
        entry_properties=entry_properties, allow_cyclic_links=allow_cyclic_links
    )
    return dirhash_impl(
        directory=directory,
        algorithm=algorithm,
        filter_=filter_,
        protocol=protocol,
        chunk_size=chunk_size,
        jobs=jobs,
    )


def dirhash_impl(
    directory, algorithm, filter_=None, protocol=None, chunk_size=2**20, jobs=1
):
    """Computes the hash of a directory based on its structure and content.

    In contrast to `dirhash.dirhash`, this function accepts custom implementations of
    the `dirhash.Filter` and `dirhash.Protocol` classes.

    # Arguments
        directory: Union[str, pathlib.Path] - Path to the directory to hash.
        algorithm: str - The name of the hashing algorithm to use. See
            `dirhash.algorithms_available` for the available options.
            It is also possible to provide a callable object that returns an instance
            implementing the `hashlib._hashlib.HASH` interface.
        filter_: dirhash.Filter - Determines what files and directories to include
            when computing the hash. See docs of `dirhash.Filter` for further
            details.
        protocol: dirhash.Protocol - Determines (mainly) what properties of files and
            directories to consider when computing the hash value.
        chunk_size: int - The number of bytes to read in one go from files while
            being hashed. A too small size will slow down the processing and a larger
            size consumes more working memory. Default 2**20 byte = 1 MiB.
        jobs: int - The number of processes to use when computing the hash.
            Default `1`, which means that a single (the main) process is used. NOTE
            that using multiprocessing can significantly speed-up execution, see
            `https://github.com/andhus/dirhash/tree/master/benchmark` for further
            details.

    # Returns
        str - The hash/checksum as a string of the hexadecimal digits (the result of
        `hexdigest` method of the hashlib._hashlib.HASH object corresponding to the
        provided `algorithm`).

    # Raises
        TypeError/ValueError: For incorrectly provided arguments.
        SymlinkRecursionError: In case the `directory` contains symbolic links that
            lead to (infinite) recursion and the protocol option `allow_cyclic_links`
            is `False`.

    # References
        See https://github.com/andhus/dirhash/README.md for a formal
        description of how the returned hash value is computed.
    """

    def get_instance(value, cls_, argname):
        if isinstance(value, cls_):
            return value
        if value is None:
            return cls_()
        raise TypeError(f"{argname} must be an instance of {cls_} or None")

    filter_ = get_instance(filter_, Filter, "filter_")
    protocol = get_instance(protocol, Protocol, "protocol")
    hasher_factory = _get_hasher_factory(algorithm)

    def dir_apply(dir_node):
        if not filter_.empty_dirs:
            if dir_node.path.relative == "" and dir_node.empty:
                # only check if root node is empty (other empty dirs are filter
                # before `dir_apply` with `filter_.empty_dirs=False`)
                raise ValueError(f"{directory}: Nothing to hash")
        descriptor = protocol.get_descriptor(dir_node)
        _dirhash = hasher_factory(descriptor.encode("utf-8")).hexdigest()

        return dir_node.path, _dirhash

    if jobs == 1:
        cache = {}

        def file_apply(path):
            return path, _get_filehash(
                path.real, hasher_factory, chunk_size=chunk_size, cache=cache
            )

        _, dirhash_ = scantree(
            directory,
            recursion_filter=filter_,
            file_apply=file_apply,
            dir_apply=dir_apply,
            follow_links=True,
            allow_cyclic_links=protocol.allow_cyclic_links,
            cache_file_apply=False,
            include_empty=filter_.empty_dirs,
            jobs=1,
        )
    else:  # multiprocessing
        real_paths = set()

        def extract_real_paths(path):
            real_paths.add(path.real)
            return path

        root_node = scantree(
            directory,
            recursion_filter=filter_,
            file_apply=extract_real_paths,
            follow_links=True,
            allow_cyclic_links=protocol.allow_cyclic_links,
            cache_file_apply=False,
            include_empty=filter_.empty_dirs,
            jobs=1,
        )
        real_paths = list(real_paths)
        # hash files in parallel
        file_hashes = _parmap(
            partial(
                _get_filehash, hasher_factory=hasher_factory, chunk_size=chunk_size
            ),
            real_paths,
            jobs=jobs,
        )
        # prepare the mapping with precomputed file hashes
        real_path_to_hash = dict(zip(real_paths, file_hashes))

        def file_apply(path):
            return path, real_path_to_hash[path.real]

        _, dirhash_ = root_node.apply(file_apply=file_apply, dir_apply=dir_apply)

    return dirhash_


def included_paths(
    directory,
    match=("*",),
    ignore=None,
    linked_dirs=True,
    linked_files=True,
    empty_dirs=False,
    allow_cyclic_links=False,
):
    """Inspect what paths are included for the corresponding arguments to the
    `dirhash.dirhash` function.

    # Arguments:
        This function accepts the following subset of the function `dirhash.dirhash`
        arguments: `directory`, `match`, `ignore`, `linked_dirs`, `linked_files`,
        `empty_dirs` and `allow_cyclic_links`, *with the same interpretation*. See
        docs of `dirhash.dirhash` for further details.

    # Returns
        List[str] - A sorted list of the paths that would be included when computing
        the hash of the `directory` using `dirhash.dirhash` and the same arguments.
    """
    filter_ = Filter(
        match_patterns=get_match_patterns(match=match, ignore=ignore),
        linked_dirs=linked_dirs,
        linked_files=linked_files,
        empty_dirs=empty_dirs,
    )
    protocol = Protocol(allow_cyclic_links=allow_cyclic_links)

    leafpaths = scantree(
        directory,
        recursion_filter=filter_,
        follow_links=True,
        allow_cyclic_links=protocol.allow_cyclic_links,
        include_empty=filter_.empty_dirs,
    ).leafpaths()

    return [
        path.relative if path.is_file() else os.path.join(path.relative, ".")
        for path in leafpaths
    ]


class Filter(RecursionFilter):
    """Specification of what files and directories to include for the `dirhash`
    computation.

    # Arguments
        match: Iterable[str] - An iterable of glob/wildcard (".gitignore style")
            match patterns for selection of which files and directories to include.
            Paths *relative to the root `directory`* (i.e. excluding the name of the
            root directory itself) are matched against the provided patterns. For
            example, to include all files, except for hidden ones use:
            `match=['*', '!.*']` Default `None` which is equivalent to `['*']`,
            i.e. everything is included.
        linked_dirs: bool - If `True` (default), follow symbolic links to other
            *directories* and include these and their content in the hash
            computation.
        linked_files: bool - If `True` (default), include symbolic linked files in
            the hash computation.
        empty_dirs: bool - If `True`, include empty directories when computing the
            hash. A directory is considered empty if it does not contain any files
            that *matches provided matching criteria*. Default `False`, i.e. empty
            directories are ignored (as is done in git version control).
    """

    def __init__(
        self, match_patterns=None, linked_dirs=True, linked_files=True, empty_dirs=False
    ):
        super().__init__(
            linked_dirs=linked_dirs, linked_files=linked_files, match=match_patterns
        )
        self.empty_dirs = empty_dirs


def get_match_patterns(
    match=None,
    ignore=None,
    ignore_extensions=None,
    ignore_hidden=False,
):
    """Helper to compose a list of list of glob/wildcard (".gitignore style") match
    patterns based on options dedicated for a few standard use-cases.

    # Arguments
        match: Optional[List[str]] - A list of match-patterns for files to *include*.
            Default `None` which is equivalent to `['*']`, i.e. everything is
            included (unless excluded by arguments below).
        ignore: Optional[List[str]] -  A list of match-patterns for files to
            *ignore*. Default `None` (no ignore patterns).
        ignore_extensions: Optional[List[str]] -  A list of file extensions to
            ignore. Short for `ignore=['*.<my extension>', ...]` Default `None` (no
            extensions ignored).
        ignore_hidden: bool - If `True` ignore hidden files and directories. Short
            for `ignore=['.*', '.*/']` Default `False`.
    """
    match = ["*"] if match is None else list(match)
    ignore = [] if ignore is None else list(ignore)
    ignore_extensions = [] if ignore_extensions is None else list(ignore_extensions)

    if ignore_hidden:
        ignore.extend([".*", ".*/"])

    for ext in ignore_extensions:
        if not ext.startswith("."):
            ext = "." + ext
        ext = "*" + ext
        ignore.append(ext)

    match_spec = match + ["!" + ign for ign in ignore]

    def deduplicate(items):
        items_set = set()
        dd_items = []
        for item in items:
            if item not in items_set:
                dd_items.append(item)
                items_set.add(item)

        return dd_items

    return deduplicate(match_spec)


class Protocol:
    """Specifications of which file and directory properties to consider when
        computing the `dirhash` value.

    # Arguments
        entry_properties: Iterable[str] - A combination of the supported properties
            {"name", "data", "is_link"} where at least one of "name" and "data" is
            included. Interpretation:
            - ["name", "data"] (Default) - The name as well as data is included. Due
                to the recursive nature of the dirhash computation, "name" implies
                that the path relative to the root `directory` of each file/directory
                affects the computed hash value.
            - ["data"] - Compute the hash only based on the data of files -
                *not* their names or the names of their parent directories. NOTE that
                the tree structure in which files are organized under the `directory`
                root still influences the computed hash. As longs as all files have
                the same content and are organised the same way in relation to all
                other files in the Directed Acyclic Graph representing the file-tree,
                the hash will remain the same (but the "name of nodes" does not
                matter). This option can e.g. be used to verify that that data is
                unchanged after renaming files (change extensions etc.).
            - ["name"] - Compute the hash only based on the name and location of
                files in the file tree under the `directory` root. This option can
                e.g. be used to check if any files have been added/moved/removed,
                ignoring the content of each file.
            - "is_link" - if this options is added to any of the cases above the
                hash value is also affected by whether a file or directory is a
                symbolic link or not. NOTE: which this property added, the hash
                will be different than without it even if there are no symbolic links
                in the directory.
        allow_cyclic_links: bool - If `False` (default) a `SymlinkRecursionError` is
            raised on presence of cyclic symbolic links. If set to `True` the the
            dirhash value for directory causing the cyclic link is replaced with the
            hash function hexdigest of the relative path from the link to the target.
    """

    class EntryProperties:
        NAME = "name"
        DATA = "data"
        IS_LINK = "is_link"
        options = {NAME, DATA, IS_LINK}
        _DIRHASH = "dirhash"

    _entry_property_separator = "\000"
    _entry_descriptor_separator = "\000\000"

    def __init__(self, entry_properties=("name", "data"), allow_cyclic_links=False):
        entry_properties = set(entry_properties)
        if not entry_properties.issubset(self.EntryProperties.options):
            raise ValueError(
                f"entry properties {entry_properties - self.EntryProperties.options} "
                "not supported"
            )
        if not (
            self.EntryProperties.NAME in entry_properties
            or self.EntryProperties.DATA in entry_properties
        ):
            raise ValueError(
                "at least one of entry properties `name` and `data` must be used"
            )
        self.entry_properties = entry_properties
        self._include_name = self.EntryProperties.NAME in entry_properties
        self._include_data = self.EntryProperties.DATA in entry_properties
        self._include_is_link = self.EntryProperties.IS_LINK in entry_properties

        if not isinstance(allow_cyclic_links, bool):
            raise ValueError(
                f"allow_cyclic_link must be a boolean, got {allow_cyclic_links}"
            )
        self.allow_cyclic_links = allow_cyclic_links

    def get_descriptor(self, dir_node):
        if isinstance(dir_node, CyclicLinkedDir):
            return self._get_cyclic_linked_dir_descriptor(dir_node)

        entries = dir_node.directories + dir_node.files
        entry_descriptors = [
            self._get_entry_descriptor(self._get_entry_properties(path, entry_hash))
            for path, entry_hash in entries
        ]
        return self._entry_descriptor_separator.join(sorted(entry_descriptors))

    @classmethod
    def _get_entry_descriptor(cls, entry_properties):
        entry_strings = [f"{name}:{value}" for name, value in entry_properties]
        return cls._entry_property_separator.join(sorted(entry_strings))

    def _get_entry_properties(self, path, entry_hash):
        properties = []
        if path.is_dir():
            properties.append((self.EntryProperties._DIRHASH, entry_hash))
        elif self._include_data:  # path is file
            properties.append((self.EntryProperties.DATA, entry_hash))

        if self._include_name:
            properties.append((self.EntryProperties.NAME, path.name))
        if self._include_is_link:
            properties.append((self.EntryProperties.IS_LINK, path.is_symlink))

        return properties

    def _get_cyclic_linked_dir_descriptor(self, dir_node):
        relpath = dir_node.path.relative
        target_relpath = dir_node.target_path.relative
        path_to_target = os.path.relpath(
            # the extra '.' is needed if link back to root, because
            # an empty path ('') is not supported by os.path.relpath
            os.path.join(".", target_relpath),
            os.path.join(".", relpath),
        )
        # TODO normalize posix!
        return path_to_target


def _get_hasher_factory(algorithm):
    """Returns a "factory" of hasher instances corresponding to the given algorithm
    name. Bypasses input argument `algorithm` if it is already a hasher factory
    (verified by attempting calls to required methods).
    """
    if algorithm in algorithms_guaranteed:
        return getattr(hashlib, algorithm)

    if algorithm in algorithms_available:
        return partial(hashlib.new, algorithm)

    try:  # bypass algorithm if already a hasher factory
        hasher = algorithm(b"")
        hasher.update(b"")
        hasher.hexdigest()
        return algorithm
    except:  # noqa: E722
        pass

    raise ValueError(f"`algorithm` must be one of: {algorithms_available}`")


def _parmap(func, iterable, jobs=1):
    """Map with multiprocessing.Pool"""
    if jobs == 1:
        return [func(element) for element in iterable]

    pool = Pool(jobs)
    try:
        results = pool.map(func, iterable)
    finally:
        pool.close()

    return results


def _get_filehash(filepath, hasher_factory, chunk_size, cache=None):
    """Compute the hash of the given filepath.

    # Arguments
        filepath: str - Path to the file to hash.
        hasher_factory: (f: f() -> hashlib._hashlib.HASH): Callable that returns an
            instance of the `hashlib._hashlib.HASH` interface.
        chunk_size (int): The number of bytes to read in one go from files while
            being hashed.
        cache ({str: str} | None): A mapping from `filepath` to hash (return value
            of this function). If not None, a lookup will be attempted before hashing
            the file and the result will be added after completion.

    # Returns
        The hash/checksum as a string the of hexadecimal digits.

    # Side-effects
        The `cache` is updated if not None.
    """
    if cache is not None:
        filehash = cache.get(filepath, None)
        if filehash is None:
            filehash = _get_filehash(filepath, hasher_factory, chunk_size)
            cache[filepath] = filehash
        return filehash

    hasher = hasher_factory()

    # upstream
    # with open(filepath, "rb") as f:
    #     for chunk in iter(lambda: f.read(chunk_size), b""):
    #         hasher.update(chunk)

    # Hash only by stats
    stats = os.stat(filepath)
    hash = f"{stats.st_mtime}{stats.st_size}{stats.st_ino}"
    hasher.update(hash.encode("utf-8"))

    return hasher.hexdigest()
