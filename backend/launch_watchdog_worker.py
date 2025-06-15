import asyncio

from beets_flask.logger import log
from beets_flask.watchdog.inbox import register_inboxes

if __name__ == "__main__":
    log.debug(f"Launching inbox watchdog worker")
    watchdog = register_inboxes()
    if watchdog:
        try:
            asyncio.get_event_loop().run_forever()
        except KeyboardInterrupt:
            watchdog.stop()
