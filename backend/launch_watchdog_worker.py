import asyncio
import os

# dirty workaround, we pretend this is a rq worker so we get the logger to create
# a child log with pid
os.environ.setdefault("RQ_JOB_ID", "wdog")

from beets_flask.config import get_config
from beets_flask.logger import log
from beets_flask.watchdog.inbox import register_inboxes


async def main():
    log.debug(f"Launching inbox watchdog worker")
    config = get_config()
    debounce = int(
        config["gui"]["inbox"]["debounce_before_autotag"].as_number()  # type: ignore
    )
    watchdog = register_inboxes(debounce=debounce)


if __name__ == "__main__":
    asyncio.run(main())
    asyncio.get_event_loop().run_forever()
