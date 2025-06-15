import asyncio
import os

# dirty workaround, we pretend this is a rq worker so we get the logger to create
# a child log with pid
os.environ.setdefault("RQ_JOB_ID", "wdog")

from beets_flask.logger import log
from beets_flask.watchdog.inbox import register_inboxes


async def main():
    log.debug(f"Launching inbox watchdog worker")
    watchdog = register_inboxes()


if __name__ == "__main__":
    asyncio.run(main())
    asyncio.get_event_loop().run_forever()
