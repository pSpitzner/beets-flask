import datetime
import os

from sqlalchemy import select
from sqlalchemy.orm.session import make_transient

from .redis import rq
from . import disk
from . import beets_sessions
from . import utility as ut
from .models import Tag
from .db_engine import db_session

from .logger import log


# dont forget to call this guy ini __init__.py
def init():
    # we cannot init db tables in utility because models are not known there
    if os.environ.get("RQ_WORKER_ID", None):
        return

    log.info("Checking beets config:")
    errors = ""
    outs = ""
    out, err = beets_sessions.cli_command(
        [
            "config",
            f"-p",
        ]
    )
    outs += out
    errors += err

    out, err = beets_sessions.cli_command(["--version"])
    outs += out
    errors += err

    log.info(outs)
    if errors:
        log.error(f"{errors} Check your beets config!")


def tag_for_folder(path: str) -> Tag:
    tag = Tag.get_by(Tag.album_folder == path)

    if tag is None:
        raise ValueError(f"No tag found for {path}")

    return tag


def tag_status(tag: str) -> str:
    """Get the status of either an existing tag or via album folder.

    Args:
        tag (str): either an existing tag id or a folder path.

    Returns:
        stats: pending, tagging, tagged, importing, imported, cleared, failed,
            or "notag" if no tag was created for the provided folder, yet.
    """

    if not os.path.exists(tag):
        stmt = select(Tag).where(Tag.id == tag)
        bt = db_session().execute(stmt).scalars().first()

        if bt is None:
            raise ValueError(f"No folder or tag found for {tag}")
        return str(bt.status)

    bt = tag_for_folder(tag)
    if bt is None:
        return "notag"
    else:
        return str(bt.status)


def tag_should_refetch(tag: str) -> bool:
    """helper to check if based on the files in the folder, we should retag.

    Args:
        tag (str): either an existing tag id or a folder path.
    """
    if not os.path.exists(tag):
        stmt = select(Tag).where(Tag.id == tag)
        bt = db_session().execute(stmt).scalars().first()
    else:
        album_folder = disk.album_folders_from_track_paths([tag])[0]
        bt = tag_for_folder(album_folder)

    if bt is None:
        return True

    for f in bt.eligible_track_paths():
        if f not in bt.track_paths:
            return True
    return False


@ut.with_app_context
def cleanup_status():
    # we can get the id from the job args,
    # the reflect the args to submit_and_callback
    queued = [j.args[0] for j in rq.get_queue("preview").jobs]
    queued += [j.args[0] for j in rq.get_queue("import").jobs]

    running = [j.args[0] for j in ut.get_running_jobs()]

    session = db_session()
    stmt = select(Tag).where(Tag.status.notin_(["imported", "cleared", "tagged"]))
    unfinished = session.execute(stmt).scalars().all()

    for bt in unfinished:
        if datetime.datetime.now() - bt.updated_at < datetime.timedelta(seconds=60):
            continue
        if bt.id not in queued and bt.id not in running and bt.distance is None:
            bt.status = "failed"
            session.add(bt)
            session.commit()

    session.close()
