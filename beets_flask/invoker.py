from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime
import requests
import os

from beets_flask.models import Tag, TagGroup
from beets_flask.redis import rq
from beets_flask.beets_sessions import PreviewSession, MatchedImportSession
from beets_flask.utility import log, AUDIO_EXTENSIONS
from beets_flask.db_engine import (
    db_session,
    with_db_session,
    db_session_factory,
    Session,
)


class TagInvoker:
    """
    This class is the glue between three concepts:
    - the BeetSessions (interacting with beets, implementing core functions)
    - the Tags (our sql database model, grabbed by the gui to display everything static)
    - the Redis Queue (to run the tasks in the background)

    Args:
        tagId (str): the tag id to delegate to a worker. Needs to be in the database (and committed).
    """

    def __init__(self, tagId: str | None = None):
        self.tagId = tagId

    def enqueue(self):
        """
        Delegate the tag to a redis worker, depending on its kind.
        """
        bt = Tag.get_by(Tag.id == self.tagId)
        if bt.kind == "preview":
            self.runPreview()  # type: ignore
        elif bt.kind == "import":
            self.runImport()  # type: ignore

    @rq.job(timeout=600)
    @with_db_session
    def runPreview(
        self, session: Session, callback_url: str | None = None
    ) -> str | None:
        """
        Run a PreviewSession on an existing tag.

        Args:
            callback_url (str, optional): called on success/failure. Defaults to None.

        Returns:
            str: the match url, if we found one, else None.
        """

        log.debug(f"Preview task on {self.tagId}")
        bt = Tag.get_by(Tag.id == self.tagId, session=session)
        session.merge(bt)
        bt.kind = "preview"
        bt.status = "tagging"
        bt.updated_at = datetime.now()
        session.commit()

        try:
            bs = PreviewSession(path=bt.album_folder)
            bs.run_and_capture_output()

            log.debug(bs.preview)

            bt.preview = bs.preview
            bt.distance = bs.match_dist
            bt.match_url = bs.match_url
            bt.num_tracks = bs.match_num_tracks
            bt.status = (
                "tagged"
                if (bt.match_url is not None and bs.status == "ok")
                else "unmatched"
            )
        except Exception as e:
            log.debug(e)
            bt.status = "failed"
            if callback_url:
                requests.post(
                    callback_url,
                    json={"status": "beets preview failed", "tag": bt.to_dict()},
                )
            return None
        finally:
            bt.updated_at = datetime.now()
            session.commit()
            # ut.update_client_view("tags")

        if callback_url:
            requests.post(
                callback_url,
                json={"status": "beets preview done", "tag": bt.to_dict()},
            )

        # cleanup_status()

        log.debug(f"preview done. {bt.status=}, {bt.match_url=}")
        session.close()

        return bt.match_url

    @rq.job(timeout=600)
    @with_db_session
    def runImport(
        self,
        session: Session,
        match_url: str | None = None,
        callback_url: str | None = None,
    ) -> list[str]:
        """
        Run an ImportSession for our tag.
        Relies on a preview to have been generated before.
        If it was not, we do it here (blocking the import thread).
        We do not import if no match is found according to your beets config.

        Args:
            callback_url (str | None, optional): called on status change. Defaults to None.

        Returns:
            The folder all imported files share in common. Empty list if nothing was imported.
        """

        log.debug(f"Import task on {self.tagId}")

        bt = Tag.get_by(Tag.id == id)
        session.merge(bt)
        bt.kind = "import"
        bt.updated_at = datetime.now()
        session.commit()

        match_url = match_url or self._get_or_gen_match_url(session)
        if not match_url:
            if callback_url:
                requests.post(
                    callback_url,
                    json={
                        "status": "beets import failed: no match url found.",
                        "tag": bt.to_dict(),
                    },
                )
            return []

        try:
            bs = MatchedImportSession(path=bt.album_folder, match_url=match_url)
            bs.run_and_capture_output()

            bt.preview = bs.preview
            bt.distance = bs.match_dist
            bt.match_url = bs.match_url
            bt.num_tracks = bs.match_num_tracks
            bt.track_paths_after = bs.track_paths_after_import
            bt.status = "imported" if bs.status == "ok" else "failed"
        except Exception as e:
            log.debug(e)
            bt.track_paths_after = []
            bt.status = "failed"
            if callback_url:
                requests.post(
                    callback_url,
                    json={"status": "beets import failed", "tag": bt.to_dict()},
                )
            return []
        finally:
            bt.updated_at = datetime.now()
            session.commit()
            # ut.update_client_view("tags")

        if callback_url:
            requests.post(
                callback_url,
                json={"status": "beets preview done", "tag": bt.to_dict()},
            )

        # cleanup_status()
        return bt.track_paths_after

    def _get_or_gen_match_url(self, session: Session) -> str | None:
        bt = Tag.get_by(Tag.id == self.tagId, session=session)

        if bt.match_url is not None:
            log.debug(f"Match url already exists for {bt.album_folder}: {bt.match_url}")
            return bt.match_url
        if bt.distance is None:
            log.debug(f"No unique match for {bt.album_folder}: {bt.match_url}")
            # preview task was run but no match found.
            return None

        log.debug(
            f"Running preview task to get match url for {bt.album_folder}: {bt.match_url}"
        )
        bs = PreviewSession(path=bt.album_folder)
        bs.run_and_capture_output()
        return bs.match_url
