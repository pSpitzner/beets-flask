from redis import Redis
from rq import Queue

# Setup redis connection
redis_conn = Redis()

# Init our different queues
tag_queue = Queue("tag", connection=redis_conn)
preview_queue = Queue("preview", connection=redis_conn)
import_queue = Queue("import", connection=redis_conn)


queues = [tag_queue, preview_queue, import_queue]
