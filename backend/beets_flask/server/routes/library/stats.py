import shutil
from pathlib import Path
from typing import TYPE_CHECKING, Optional, TypedDict, cast

from quart import Blueprint, g, jsonify

from beets_flask.config import get_config
from beets_flask.disk import dir_size

if TYPE_CHECKING:
    # For type hinting the global g object
    from . import g

stats_bp = Blueprint("stats", __name__)

__all__ = ["stats_bp"]


class LibraryStats(TypedDict):
    libraryPath: str
    items: int  # Num Tracks and stuff / num Files
    albums: int  # Num Albums
    artists: int  # Num Artists
    genres: int  # Num Genres
    labels: int  # Num Labels

    size: int  # bytes of the library folder
    lastItemAdded: Optional[int]  # UTC timestamp
    lastItemModified: Optional[int]  # UTC timestamp
    runtime: int  # seconds


@stats_bp.route("/stats", methods=["GET"])
async def stats():
    """Get library statistics."""

    config = get_config()

    with g.lib.transaction() as tx:
        album_stats = tx.query(
            "SELECT COUNT(*), COUNT(DISTINCT genre), COUNT(DISTINCT label), COUNT(DISTINCT albumartist) FROM albums"
        )
        items_stats = tx.query(
            "SELECT COUNT(*), MAX(added), MAX(mtime), SUM(length) FROM items"
        )

    lib_path = cast(str, config["directory"].get(str))

    ret: LibraryStats = {
        "libraryPath": str(config["directory"].as_str()),
        "items": items_stats[0][0],
        "albums": album_stats[0][0],
        "artists": album_stats[0][3],
        "genres": album_stats[0][1],
        "labels": album_stats[0][2],
        "size": dir_size(Path(lib_path)),
        "lastItemAdded": (
            round(items_stats[0][1] * 1000) if items_stats[0][1] is not None else None
        ),
        "lastItemModified": (
            round(items_stats[0][2] * 1000) if items_stats[0][2] is not None else None
        ),
        "runtime": items_stats[0][3],
    }

    return jsonify(ret)
