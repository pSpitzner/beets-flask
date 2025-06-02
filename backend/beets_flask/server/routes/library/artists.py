"""Artists endpoint.

Split artists by separators, and do some basic aggregation.
"""

from typing import TYPE_CHECKING

import pandas as pd
from cachetools.keys import hashkey
from quart import Blueprint, Response, g

from beets_flask.logger import log
from beets_flask.server.exceptions import IntegrityException, NotFoundException

artists_bp = Blueprint("artists", __name__)

if TYPE_CHECKING:
    # For type hinting the global g object
    from . import g

# TODOs:
# Currently artist_sort is completely ignored. Im not even sure what it is supposed to do.
# Also artistids are not used, but they are in the database.

# Note: I wanted to use polars first but it does not support alpine images yet, so we use pandas instead.


def get_artists_pandas(table: str, artist: str | None = None) -> pd.DataFrame:
    """Get all artists from the database using pandas.

    Returns
    -------
        DataFrame with columns ['artist', 'count', 'last_added']
    """
    if table == "items":
        query = """
            SELECT
                artist,
                added
            FROM
                items
        """
    elif table == "albums":
        query = """
            SELECT
                albumartist AS artist,
                added
            FROM
                albums
        """
    else:
        raise ValueError(f"Invalid table name: {table}. Must be 'items' or 'albums'.")

    if artist is not None:
        # If an artist is specified, filter the query
        query += f" WHERE instr(artist, ?) > 0"

    with g.lib.transaction() as tx:
        rows = tx.query(query, (artist,)) if artist else tx.query(query)

    # Read from the database
    df = pd.DataFrame(rows, columns=["artist", "added"])

    # Split artists by ',' or ';' and explode into separate rows
    separators = [",", ";"]

    # Split artist strings into lists
    df["artist"] = df["artist"].str.split(rf"[{''.join(separators)}]")

    # Explode lists to rows
    df = df.explode("artist")

    # Strip whitespace
    df["artist"] = df["artist"].str.strip()

    # Group by artist and aggregate
    result = (
        df.groupby("artist")
        .agg(count=("artist", "size"), last_added=("added", "max"))
        .reset_index()
    )

    if artist is not None:
        # If an artist is specified, filter the result
        result = result[result["artist"].str.contains(artist, case=False)]

    return result


@artists_bp.route("/artists/<path:artist_name>", methods=["GET"])
@artists_bp.route("/artists", methods=["GET"], defaults={"artist_name": None})
async def all_artists(artist_name: str | None = None):
    """Get all artists from the database.

    This endpoint retrieves all artists from the database, splits them by
    specified separators and aggregates the data to count the number of items.
    """
    artists_albums = (
        get_artists_pandas("albums", artist_name)
        .rename(columns={"count": "album_count", "last_added": "last_album_added"})
        .set_index("artist")
    )
    artists_items = (
        get_artists_pandas("items", artist_name)
        .rename(columns={"count": "item_count", "last_added": "last_item_added"})
        .set_index("artist")
    )
    # Join the two DataFrames on artist name and count the number of items and albums
    artists = artists_albums.join(
        artists_items,
        how="outer",
    ).reset_index()

    return Response(artists.to_json(orient="records"), mimetype="application/json")
