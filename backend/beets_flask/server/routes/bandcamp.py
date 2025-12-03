"""Bandcamp sync API routes.

Provides endpoints for:
- GET /bandcamp/status - Get current sync status and logs
- POST /bandcamp/sync - Start a new sync operation  
- DELETE /bandcamp/sync - Abort current sync operation
- GET /bandcamp/config - Get bandcampsync configuration

Progress logs are stored in Redis and can be polled via the status endpoint.
"""

from http.cookies import SimpleCookie

from quart import Blueprint, jsonify, request

from beets_flask.bandcamp import BandcampSyncManager, get_bandcamp_config
from beets_flask.logger import log
from beets_flask.server.exceptions import InvalidUsageException

bandcamp_bp = Blueprint("bandcamp", __name__, url_prefix="/bandcamp")


@bandcamp_bp.route("/config", methods=["GET"])
async def get_config_endpoint():
    """Get bandcampsync configuration."""
    config = get_bandcamp_config()
    return jsonify(
        {
            "enabled": config.enabled,
            "path": config.path,
        }
    )


@bandcamp_bp.route("/status", methods=["GET"])
async def get_status():
    """Get current sync status.
    
    Returns
    -------
        {
            "status": "idle" | "pending" | "running" | "complete" | "error" | "aborted",
            "error": "string"  // Only present if status is "error"
        }
    
    Note: Logs are streamed via WebSocket (bandcamp_sync_update event).
    """
    manager = BandcampSyncManager()
    status = manager.get_status()
    return jsonify(status)


@bandcamp_bp.route("/sync", methods=["POST"])
async def start_sync():
    """Start a new bandcamp sync operation.

    Request body:
        {
            "cookies": "string"  // Raw cookie string from Bandcamp
        }

    Returns
    -------
        {
            "started": true  // If sync was started
        }
        
    Returns 409 Conflict if a sync is already running.
    """
    config = get_bandcamp_config()
    if not config.enabled:
        raise InvalidUsageException(
            "Bandcampsync is not enabled. Enable it in your beets-flask config."
        )

    data = await request.get_json()
    if not data or "cookies" not in data:
        raise InvalidUsageException("Missing 'cookies' in request body")

    cookies = data["cookies"]
    if not isinstance(cookies, str) or not cookies.strip():
        raise InvalidUsageException("'cookies' must be a non-empty string")

    # Clean up cookie string - strip "Cookie:" prefix if present
    cookies = cookies.strip()
    if cookies.lower().startswith("cookie:"):
        cookies = cookies[7:].lstrip()

    # Validate that the cookie string can be parsed and contains required cookies
    test_cookie = SimpleCookie()
    test_cookie.load(cookies)
    
    if not test_cookie:
        raise InvalidUsageException(
            "Could not parse cookie string. Make sure you copied just the cookie value "
            "(e.g., 'identity=XXX; client_id=YYY'), not the header name."
        )
    
    if "identity" not in test_cookie:
        raise InvalidUsageException(
            "Cookie string is missing the required 'identity' cookie. "
            "Make sure you are logged in to Bandcamp and copied all cookies."
        )

    log.debug(f"Bandcamp sync: cookie length={len(cookies)}, parsed {len(test_cookie)} cookies")

    manager = BandcampSyncManager()
    started = manager.start_sync(cookies)

    if not started:
        return jsonify({"started": False, "message": "A sync is already running"}), 409

    log.info("Started bandcamp sync")

    return jsonify({"started": True}), 202


@bandcamp_bp.route("/sync", methods=["DELETE"])
async def abort_sync():
    """Abort the current sync operation.

    Note: The abort is best-effort. The sync may continue for a short
    time after the abort is requested, but no more progress will be
    published and the final status will be 'aborted'.
    """
    manager = BandcampSyncManager()

    if not manager.abort_sync():
        return jsonify({"aborted": False, "message": "No sync is currently running"}), 404

    log.info("Abort requested for bandcamp sync")

    return jsonify({"aborted": True})
