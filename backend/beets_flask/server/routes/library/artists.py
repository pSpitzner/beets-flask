"""Artists endpoint.

Split artists by separators, and do some basic aggregation.
"""

import re
from typing import TYPE_CHECKING

import pandas as pd
from quart import Blueprint, Response, g

from beets_flask.config import get_config
from beets_flask.server.exceptions import NotFoundException

artists_bp = Blueprint("artists", __name__)

if TYPE_CHECKING:
    # For type hinting the global g object
    from . import g

# TODOs:
# Currently artist_sort is completely ignored. Im not even sure what it is supposed to do.
# Also artistids are not used, but they are in the database.

# Note: I wanted to use polars first but it does not support alpine images yet, so we use pandas instead.


ARTIST_SEPARATORS: list[str] = get_config()["gui"]["library"][
    "artist_separators"
].as_str_seq()

split_pattern = "|".join(map(re.escape, ARTIST_SEPARATORS))


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

    # Split the artist string by the specified separators
    artists = [a.strip() for a in re.split(split_pattern, artist)] if artist else None

    if artists is not None:
        # If an artist is specified, filter the query
        for i, a in enumerate(artists):
            if i == 0:
                query += f" WHERE instr(artist, ?) > 0"
            else:
                query += f" AND instr(artist, ?) > 0"

    with g.lib.transaction() as tx:
        rows = tx.query(query, artists) if artists else tx.query(query)

    # Read from the database
    df = pd.DataFrame(rows, columns=["artist", "added"])

    # Split artist strings into lists and explode into separate rows
    df["artist"] = df["artist"].str.split(rf"[{''.join(ARTIST_SEPARATORS)}]")
    df = df.explode("artist")

    # Strip whitespace
    df["artist"] = df["artist"].str.strip()
    df["added"] = df["added"] * 1000

    # Group by artist and aggregate
    result = (
        df.groupby("artist")
        .agg(
            count=("artist", "size"),
            last_added=("added", "max"),
            first_added=("added", "min"),
        )
        .reset_index()
    )

    if artists is not None:
        # If an artist is specified, filter the result (respect the separator and resolve as or)
        result = result[
            result["artist"].str.contains("|".join(artists), case=False, regex=True)
        ]
        # Overwrite if there are multiple artists (i.e. joined by a separator)
        if len(artists) > 1 and not result.empty:
            result["artist"] = artist

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
        .rename(
            columns={
                "count": "album_count",
                "last_added": "last_album_added",
                "first_added": "first_album_added",
            }
        )
        .set_index("artist")
    )
    artists_items = (
        get_artists_pandas("items", artist_name)
        .rename(
            columns={
                "count": "item_count",
                "last_added": "last_item_added",
                "first_added": "first_item_added",
            }
        )
        .set_index("artist")
    )
    # Join the two DataFrames on artist name and count the number of items and albums
    artists = artists_albums.join(
        artists_items,
        how="outer",
    ).reset_index()

    # Fill n_albums and n_items with 0 if they are NaN
    artists["album_count"] = artists["album_count"].fillna(0).astype(int)
    artists["item_count"] = artists["item_count"].fillna(0).astype(int)

    if artist_name is not None:
        if artists.empty:
            raise NotFoundException(f"Artist '{artist_name}' not found.")
        else:
            return Response(artists.iloc[0].to_json(), mimetype="application/json")

    return Response(artists.to_json(orient="records"), mimetype="application/json")
