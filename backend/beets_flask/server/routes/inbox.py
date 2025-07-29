import shutil
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import TypedDict, cast

from cachetools import Cache
from mediafile import Image, MediaFile  # comes with the beets install
from quart import Blueprint, jsonify, request
from sqlalchemy import func, select
from tinytag import TinyTag

from beets_flask.database import db_session_factory
from beets_flask.database.models.states import FolderInDb, SessionStateInDb
from beets_flask.disk import Folder, dir_files, dir_size, path_to_folder
from beets_flask.importer.progress import Progress
from beets_flask.server.exceptions import InvalidUsageException, NotFoundException
from beets_flask.server.routes.library.artwork import send_image
from beets_flask.server.utility import (
    pop_folder_params,
    pop_paths_param,
)
from beets_flask.server.websocket.status import (
    trigger_clear_cache,
)
from beets_flask.watchdog.inbox import (
    get_inbox_folders,
    get_inbox_for_path,
)

inbox_bp = Blueprint("inbox", __name__, url_prefix="/inbox")


@inbox_bp.route("/tree", methods=["GET"])
async def get_tree():
    """Get all paths inside the inbox folder(s)."""

    inbox_folders = get_inbox_folders()

    # Create dict representation of inbox folders
    folders: list[Folder] = []
    for folder in inbox_folders:
        folders.append(path_to_folder(folder, subdirs=False))

    return jsonify(folders)


@inbox_bp.route("/folder", methods=["POST"])
async def get_folder():
    """Get the folder structure for a given inbox folder.

    Parameters
    ----------
    folder_path : str
        The path to the folder to get the structure for.
    """
    params = await request.get_json()

    folder_hashes, folder_paths = pop_folder_params(params, allow_mismatch=True)

    if len(folder_paths) != 1 and len(folder_hashes) != 1:
        raise InvalidUsageException(
            f"Only one folder path or hash must be provided. Got: {folder_hashes=}, {folder_paths=}"
        )

    folder_path = folder_paths[0] if len(folder_paths) == 1 else None
    folder_hash = folder_hashes[0] if len(folder_hashes) == 1 else None

    # Only absolute paths are allowed
    if folder_path is not None and not Path(folder_path).is_absolute():
        raise InvalidUsageException(
            f"Only absolute paths are allowed. Got: {folder_path=}"
        )

    folder: Folder | None = None

    # If a hash is provided, try to get the folder from the inbox cache first
    # If this fails, try to get from db
    if folder_hash is not None:
        inbox_folders = get_inbox_folders()
        for inbox_folder in inbox_folders:
            for f in path_to_folder(inbox_folder, subdirs=False).walk():
                if isinstance(f, Folder) and f.hash == folder_hash:
                    folder = f
                    break

            if folder is not None:
                break

        if folder is None:
            with db_session_factory() as session:
                stmt = select(FolderInDb).where(FolderInDb.id == folder_hash)
                f_in_db = session.execute(stmt).scalars().first()
                if f_in_db is not None:
                    folder = f_in_db.to_live_folder()

    # If a path is provided, and we did not find the folder via hash,
    # try to create folder or get it from db
    if folder is None and folder_path is not None:
        try:
            folder_path = Path(folder_path).resolve()
            folder = Folder.from_path(folder_path, subdirs=False)
        except FileNotFoundError:
            # Try to lookup in db, maybe folder doesn't exist anymore?
            with db_session_factory() as session:
                stmt = (
                    select(FolderInDb)
                    .where(FolderInDb.full_path == str(folder_path))
                    .order_by(FolderInDb.updated_at.desc())
                )

                f_in_db = session.execute(stmt).scalars().first()
                if f_in_db is not None:
                    folder = f_in_db.to_live_folder()

    # If we still don't have a folder, raise an error
    if folder is None:
        raise InvalidUsageException(
            f"Could not find folder with {folder_hash=} or path {folder_path=}.",
            status_code=404,
        )

    return jsonify(folder)


@inbox_bp.route("/tree/refresh", methods=["POST"])
async def refresh_cache():
    """Clear the cache for the path_to_dict function."""
    await trigger_clear_cache()
    return "Ok"


@inbox_bp.route("/delete", methods=["DELETE"])
async def delete():
    """Remove all folders provided in the request body via folder_paths.

    Parameters
    ----------
    folder_paths : list[str]
        The paths to the folders to remove.
    folder_hashes : list[str]
        The hashes of the folders to remove.
    """
    params = await request.get_json()
    folder_hashes, folder_paths = pop_folder_params(params, allow_empty=False)

    # Deduplicate based on both path and hash (order-preserving)
    seen: set[tuple[Path, str]] = set()
    folder_paths_and_hashes = []
    for path, hash in zip(folder_paths, folder_hashes):
        if (path, hash) not in seen:
            seen.add((path, hash))
            folder_paths_and_hashes.append((path, hash))

    # Sort by length of the path (longest first, to delete the most nested folders first)
    folder_paths_and_hashes = sorted(
        folder_paths_and_hashes, key=lambda x: len(x[0].parts), reverse=True
    )

    # Check that all hashes are (still) valid
    cache: Cache[str, bytes] = Cache(maxsize=2**16)
    folders: list[Folder] = []
    for folder_path, folder_hash in folder_paths_and_hashes:
        f = Folder.from_path(folder_path, cache=cache)
        folders.append(f)
        if f.hash != folder_hash:
            raise InvalidUsageException(
                "Folder hash does not match the current folder hash! Please refresh your hashes before deleting!",
            )

    # Delete the folders
    for f in folders:
        shutil.rmtree(f.full_path)

    # Clear the cache for the deleted folders
    await trigger_clear_cache()

    return jsonify(
        {
            "deleted": [f.full_path for f in folders],
            "hashes": [f.hash for f in folders],
        }
    )


@inbox_bp.route("/metadata", methods=["POST"])
async def get_multiple_filemeta():
    params = await request.get_json()

    file_paths = pop_paths_param(params, "file_paths", default=[])

    if len(file_paths) == 0:
        raise InvalidUsageException("No file paths provided", status_code=400)

    tags = []

    for p in file_paths:
        if not p.is_file():
            raise InvalidUsageException(f"Invalid file path: {p}", status_code=400)

        tag = _get_filemeta(p)
        tags.append(tag)

    return jsonify(tags)


def _get_filemeta(path: str | Path):
    """Get the file metadata for a given audio file."""

    tag = TinyTag.get(path).as_dict()
    for k, v in tag.items():
        # TODO: we cant just omit if there are multiple values...
        if isinstance(v, list):
            tag[k] = v[0]

    if "filename" in tag:
        tag["filename"] = str(tag["filename"]).split("/")[-1]

    return tag


# TODO: consolidate with the file artwork route from artwork.py
@inbox_bp.route("/metadata_art/<path:query>", methods=["GET"])
async def file_art(query: str):
    """Get the cover art for a given audio file.

    Parameters
    ----------
    query : str
        The path to the file to get the cover art for.
    """
    path = Path("/" + query)
    if not path.is_file():
        raise NotFoundException(f"File not found: '{path}'.")

    return await send_image(_file_art(path))


def _file_art(path: Path):
    """Get the cover art for a given audio file."""

    mediafile = MediaFile(path)
    if not mediafile.images or len(mediafile.images) < 1:
        raise NotFoundException(f"File has no cover art: '{path}'.")

    im: Image = cast(Image, mediafile.images[0])
    return BytesIO(im.data)


# ------------------------------------------------------------------------------------ #
#                                         Stats                                        #
# ------------------------------------------------------------------------------------ #


class InboxStats(TypedDict):
    name: str
    path: str

    # Number of albums tagged via GUI
    tagged_via_gui: int
    # Number of albums imported via GUI
    imported_via_gui: int

    # Bytes of the inbox folder
    size: int
    nFiles: int

    last_created: datetime | None


@inbox_bp.route("/stats", methods=["GET"])
async def stats_for_all():
    """Get the stats for all inbox folders.

    Parameters
    ----------
    folder : str (optional)
        The folder to compute stats for. If not provided, all inbox folders are used.
    """
    folders = get_inbox_folders()
    stats = [compute_stats(f) for f in folders]
    return jsonify(stats)


def compute_stats(folder: str):
    """Compute the stats for the inbox folder.

    # Path parameters
    folder: str (optional) - The folder to compute stats for

    """
    inbox = get_inbox_for_path(folder)
    if inbox is None:
        raise NotFoundException(f"Inbox folder `{folder} not found.")

    p = Path(folder)

    # Compute session stats
    with db_session_factory() as session:
        stmt = (
            select(func.count())
            .select_from(SessionStateInDb)
            .join(FolderInDb)
            .where(FolderInDb.full_path.like(f"{folder}%"))
            .where(SessionStateInDb.progress >= Progress.PREVIEW_COMPLETED)
        )
        n_tagged = session.execute(stmt).scalar_one()

        stmt = (
            select(func.count())
            .select_from(SessionStateInDb)
            .join(FolderInDb)
            .where(FolderInDb.full_path.like(f"{folder}%"))
            .where(SessionStateInDb.progress == Progress.IMPORT_COMPLETED)
        )
        n_imported = session.execute(stmt).scalar_one()

        # last created session
        stmt = (
            select(SessionStateInDb.created_at)
            .join(FolderInDb)
            .where(FolderInDb.full_path.like(f"{folder}%"))
            .order_by(SessionStateInDb.created_at.desc())
            .limit(1)
        )
        last_created = session.execute(stmt).scalars().first()

    ret_map: InboxStats = {
        "name": inbox["name"],
        "path": inbox["path"],
        "nFiles": dir_files(p),
        "size": dir_size(p),
        "tagged_via_gui": n_tagged,
        "imported_via_gui": n_imported,
        "last_created": last_created,
    }

    return ret_map
