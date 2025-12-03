"""Bandcamp sync worker and manager.

This module wraps the bandcampsync package.
Uses Redis pub/sub to stream logs to websocket clients.

There is only ever one bandcamp sync job at a time (singleton pattern).
"""

import logging
import os
import tempfile
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from beets_flask.config import get_config
from beets_flask.logger import log
from beets_flask.redis import redis_conn


class SyncStatus(str, Enum):
    """Status of a bandcamp sync operation."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    ERROR = "error"
    ABORTED = "aborted"


class PubSubLogHandler(logging.Handler):
    """Logging handler that publishes log messages via Redis pub/sub."""

    def __init__(self):
        super().__init__()

    def emit(self, record: logging.LogRecord):
        try:
            from beets_flask.server.websocket.pubsub import publish_bandcamp_log

            msg = self.format(record)
            # Always include "running" status so frontend knows sync is still active
            publish_bandcamp_log(msg, status="running")
        except Exception:
            self.handleError(record)


@dataclass
class BandcampConfig:
    """Configuration for bandcampsync integration."""

    enabled: bool
    path: str


def get_bandcamp_config() -> BandcampConfig:
    """Get bandcampsync configuration from beets-flask config."""
    config = get_config()
    try:
        bandcamp_cfg = config["gui"]["bandcampsync"]
        return BandcampConfig(
            enabled=bandcamp_cfg["enabled"].get(bool),
            path=bandcamp_cfg["path"].get(str),
        )
    except Exception:
        return BandcampConfig(enabled=False, path="/music/bandcamp_inbox")


# Redis keys for the singleton sync job
SYNC_STATUS_KEY = "bandcamp:sync:status"
SYNC_ABORT_KEY = "bandcamp:sync:abort"


class BandcampSyncManager:
    """Manages the singleton bandcamp sync operation."""

    def __init__(self):
        self.redis = redis_conn

    def get_status(self) -> dict[str, Any]:
        """Get the current status of the sync operation.

        Returns dict with 'status' key, plus 'error' if status is error.
        Logs are streamed via WebSocket, not included here.
        """
        from beets_flask.redis import bandcamp_queue

        # Check if there's a job in the queue or currently running
        queued_jobs = bandcamp_queue.job_ids
        current_job = bandcamp_queue.started_job_registry.get_job_ids()

        if current_job:
            status_val = SyncStatus.RUNNING.value
        elif queued_jobs:
            status_val = SyncStatus.PENDING.value
        else:
            # Check Redis for last status (for complete/error/aborted)
            status = self.redis.get(SYNC_STATUS_KEY)
            status_val = (
                status.decode() if isinstance(status, bytes) else (status or "idle")
            )

        result: dict[str, Any] = {"status": status_val}

        # If error, try to get error message
        if status_val == SyncStatus.ERROR.value:
            error_msg = self.redis.get(f"{SYNC_STATUS_KEY}:error")
            if error_msg:
                result["error"] = (
                    error_msg.decode() if isinstance(error_msg, bytes) else error_msg
                )

        return result

    def is_running(self) -> bool:
        """Check if a sync is currently running or pending."""
        status = self.get_status()
        return status["status"] in [SyncStatus.PENDING.value, SyncStatus.RUNNING.value]

    def start_sync(self, cookies: str) -> bool:
        """Start a new bandcamp sync operation.

        Args:
            cookies: Raw cookie string from Bandcamp

        Returns
        -------
            True if sync was started, False if one is already running
        """
        from beets_flask.redis import bandcamp_queue

        config = get_bandcamp_config()
        if not config.enabled:
            raise ValueError("Bandcampsync is not enabled in configuration")

        # Check if already running
        if self.is_running():
            return False

        # Clear abort flag
        self.redis.delete(SYNC_ABORT_KEY)

        # Set status to pending
        self.redis.set(SYNC_STATUS_KEY, SyncStatus.PENDING.value)
        self.redis.delete(f"{SYNC_STATUS_KEY}:error")

        # Enqueue the sync job
        bandcamp_queue.enqueue(
            run_bandcamp_sync,
            cookies,
            config.path,
            job_timeout=3600,  # 1 hour timeout
        )

        return True

    def abort_sync(self) -> bool:
        """Request abort of the current sync operation.

        Returns True if abort was requested, False if no sync is running.
        """
        if not self.is_running():
            return False

        self.redis.set(SYNC_ABORT_KEY, "1")
        return True

    def is_aborted(self) -> bool:
        """Check if abort has been requested."""
        abort_flag = self.redis.get(SYNC_ABORT_KEY)
        return abort_flag == b"1" if abort_flag else False


def run_bandcamp_sync(cookies: str, download_path: str):
    """Worker function to run bandcamp sync.

    This function is executed in an RQ worker process.
    Uses Redis pub/sub to stream logs to websocket clients.
    """
    from beets_flask.server.websocket.pubsub import publish_bandcamp_log

    # Monkey-patch requests to use curl_cffi for browser-like TLS fingerprint.
    # This is needed because Alpine Linux's musl-based OpenSSL produces a TLS
    # fingerprint that Bandcamp's bot detection blocks with 403.
    try:
        from curl_cffi import requests as cffi_requests

        class CffiSessionAdapter:
            """Adapter that wraps curl_cffi to match requests.Session interface."""

            def __init__(self):
                self._cookies = {}

            @property
            def cookies(self):
                return self

            def set(self, name, value):
                self._cookies[name] = value

            def request(
                self, method, url, headers=None, cookies=None, data=None, json=None
            ):
                # Merge cookies
                all_cookies = {**self._cookies}
                if cookies:
                    all_cookies.update(cookies)

                return cffi_requests.request(
                    method,
                    url,
                    headers=headers,
                    cookies=all_cookies,
                    data=data,
                    json=json,
                    impersonate="chrome",
                )

            def get(self, url, **kwargs):
                return self.request("GET", url, **kwargs)

            def post(self, url, **kwargs):
                return self.request("POST", url, **kwargs)

        # Patch the requests module - bandcampsync already imported it,
        # but this will affect future Session() instantiations
        import requests

        requests.Session = CffiSessionAdapter
        log.info("Patched requests.Session with curl_cffi for browser TLS fingerprint")
    except ImportError:
        log.warning("curl_cffi not available, using standard requests (may get 403)")

    redis_client = redis_conn
    manager = BandcampSyncManager()

    log.info("Importing bandcampsync...")
    from bandcampsync import do_sync

    log.info("bandcampsync imported")

    # Update status to running and notify clients
    redis_client.set(SYNC_STATUS_KEY, SyncStatus.RUNNING.value)
    publish_bandcamp_log("Starting sync...", status=SyncStatus.RUNNING.value)

    # Set up log handler to stream bandcampsync logs via pub/sub
    handler = PubSubLogHandler()
    handler.setFormatter(logging.Formatter("%(name)s [%(levelname)s] %(message)s"))

    # Attach handler to bandcampsync loggers
    bandcamp_loggers = ["sync", "bandcamp", "download", "media", "ignores", "notify"]
    for logger_name in bandcamp_loggers:
        logger = logging.getLogger(logger_name)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False

    try:
        # Ensure download path exists
        os.makedirs(download_path, exist_ok=True)

        # Create a temporary file for cookies
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False
        ) as cookie_file:
            cookie_file.write(cookies)
            cookie_path = cookie_file.name

        try:
            # Run the sync
            # TODO: subprocess so that abort can actually work.
            do_sync(
                None,  # cookies_path
                cookies,  # cookies
                Path(download_path),  # dir_path (must be Path object)
                "flac",  # media_format
                None,  # temp_dir_root
                "",  # ign_patterns (empty string, not None)
                None,  # notify_url
            )

            # Check if aborted during execution
            if manager.is_aborted():
                redis_client.set(SYNC_STATUS_KEY, SyncStatus.ABORTED.value)
                publish_bandcamp_log(
                    "Sync aborted by user", status=SyncStatus.ABORTED.value
                )
            else:
                redis_client.set(SYNC_STATUS_KEY, SyncStatus.COMPLETE.value)
                publish_bandcamp_log(
                    "Sync completed successfully", status=SyncStatus.COMPLETE.value
                )
        finally:
            # Clean up temp cookie file
            if os.path.exists(cookie_path):
                os.unlink(cookie_path)

    except Exception as e:
        log.exception(f"Bandcamp sync failed: {e}")
        redis_client.set(SYNC_STATUS_KEY, SyncStatus.ERROR.value)
        redis_client.set(f"{SYNC_STATUS_KEY}:error", str(e))
        publish_bandcamp_log(f"ERROR: {e}", status=SyncStatus.ERROR.value)

    finally:
        # Remove handlers to avoid issues on subsequent runs
        for logger_name in bandcamp_loggers:
            logger = logging.getLogger(logger_name)
            logger.removeHandler(handler)
            logger.propagate = True
