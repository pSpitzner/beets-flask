"""Simple Redis pub/sub for streaming messages from RQ workers to websocket clients.

Workers call `publish()` to send messages.
The server runs `subscriber_task()` to forward messages to connected clients.
"""

import json
from typing import Any

from beets_flask.logger import log
from beets_flask.redis import redis_conn

# Channel name for bandcamp sync logs
BANDCAMP_CHANNEL = "bandcamp:logs"


def publish(channel: str, data: dict[str, Any]):
    """Publish a message to a Redis channel. Call this from RQ workers.
    
    This is synchronous and safe to call from worker processes.
    """
    message = json.dumps(data)
    log.debug(f"Publishing to {channel}: {message}")
    redis_conn.publish(channel, message)


def publish_bandcamp_log(message: str, status: str | None = None):
    """Convenience function to publish a bandcamp sync log message."""
    data: dict[str, Any] = {"logs": [message]}
    if status:
        data["status"] = status
    log.debug(f"publish_bandcamp_log: {data}")
    publish(BANDCAMP_CHANNEL, data)


async def subscriber_task(sio, namespace: str = "/status"):
    """Background task that subscribes to Redis and forwards to websocket clients.
    
    Args:
        sio: The socket.io server instance
        namespace: The namespace to emit to
    """
    import asyncio
    
    log.info("Starting pub/sub subscriber task...")
    
    # Create a separate Redis connection for pub/sub (required by Redis)
    from redis import Redis
    pubsub_conn = Redis()
    pubsub = pubsub_conn.pubsub()
    pubsub.subscribe(BANDCAMP_CHANNEL)
    
    log.info(f"Subscribed to Redis channel: {BANDCAMP_CHANNEL}")
    
    try:
        while True:
            # Non-blocking get with timeout
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            
            if message and message["type"] == "message":
                log.debug(f"Received pub/sub message: {message}")
                try:
                    data = json.loads(message["data"])
                    await sio.emit("bandcamp_sync_update", data, namespace=namespace)
                except json.JSONDecodeError:
                    log.warning(f"Invalid JSON in pub/sub message: {message['data']}")
                except Exception as e:
                    log.error(f"Error emitting pub/sub message: {e}")
            
            # Yield control to other async tasks
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        log.info("Subscriber task cancelled")
    except Exception as e:
        log.error(f"Subscriber task error: {e}", exc_info=True)
    finally:
        pubsub.unsubscribe(BANDCAMP_CHANNEL)
        pubsub.close()
        pubsub_conn.close()
