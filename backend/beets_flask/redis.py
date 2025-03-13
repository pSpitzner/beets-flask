from redis import Redis
from rq import Queue

# Setup redis connection
redis_conn = Redis()

# Init our different queues
preview_queue = Queue("preview", connection=redis_conn)
import_queue = Queue("import", connection=redis_conn)


queues = [preview_queue, import_queue]

__all__ = [
    "queues",
    "import_queue",
    "preview_queue",
    "redis_conn",
]
