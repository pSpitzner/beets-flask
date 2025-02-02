import time
from beets_flask.importer.pipeline import AsyncPipeline

import logging

import pytest
import asyncio

log = logging.getLogger(__name__)

@pytest.mark.asyncio
async def test_smoke_async(caplog):
    """ Async version of the beets smoke test
    for pipeline
    """

    async def produce():
        for i in range(5):
            log.debug("producing %i" % i)
            await asyncio.sleep(0.1)
            yield i

    async def work():
        num = yield
        while True:
            log.debug("working %i" % num)
            if num == 0:
                await asyncio.sleep(2)
                log.debug("waiting long")
            else:
                await asyncio.sleep(0.1)
                log.debug("waiting short")
            log.debug("worked %i" % num)
            num = yield num * 2

    async def consume():
        while True:
            num = yield
            await asyncio.sleep(0.1)
            log.debug("consuming %i" % num)


    initial_task = produce()
    stages = [work(), consume()]
    pipeline = AsyncPipeline(initial_task, stages)


    await pipeline.run_async()
    assert caplog.record_tuples == [
        (__name__, logging.DEBUG, "producing 0"),
        (__name__, logging.DEBUG, "working 0"),
        (__name__, logging.DEBUG, "consuming 0"),
        (__name__, logging.DEBUG, "producing 1"),
        (__name__, logging.DEBUG, "working 1"),
        (__name__, logging.DEBUG, "consuming 2"),
        (__name__, logging.DEBUG, "producing 2"),
        (__name__, logging.DEBUG, "working 2"),
        (__name__, logging.DEBUG, "consuming 4"),
        (__name__, logging.DEBUG, "producing 3"),
        (__name__, logging.DEBUG, "working 3"),
        (__name__, logging.DEBUG, "consuming 6"),
        (__name__, logging.DEBUG, "producing 4"),
        (__name__, logging.DEBUG, "working 4"),
        (__name__, logging.DEBUG, "consuming 8"),
    ]


@pytest.mark.asyncio
async def test_smoke_sync(caplog):
    """ Async version of the beets smoke test
    for pipeline
    """

    def produce():
        for i in range(5):
            log.debug("producing %i" % i)
            time.sleep(0.1)
            yield i

    def work():
        num = yield
        while True:
            log.debug("working %i" % num)
            time.sleep(0.1)
            num = yield num * 2

    def consume():
        while True:
            num = yield
            time.sleep(0.1)
            log.debug("consuming %i" % num)


    initial_task = produce()
    stages = [work(), consume()]
    pipeline = AsyncPipeline(initial_task, stages)


    await pipeline.run_async()
    assert caplog.record_tuples == [
        (__name__, logging.DEBUG, "producing 0"),
        (__name__, logging.DEBUG, "working 0"),
        (__name__, logging.DEBUG, "consuming 0"),
        (__name__, logging.DEBUG, "producing 1"),
        (__name__, logging.DEBUG, "working 1"),
        (__name__, logging.DEBUG, "consuming 2"),
        (__name__, logging.DEBUG, "producing 2"),
        (__name__, logging.DEBUG, "working 2"),
        (__name__, logging.DEBUG, "consuming 4"),
        (__name__, logging.DEBUG, "producing 3"),
        (__name__, logging.DEBUG, "working 3"),
        (__name__, logging.DEBUG, "consuming 6"),
        (__name__, logging.DEBUG, "producing 4"),
        (__name__, logging.DEBUG, "working 4"),
        (__name__, logging.DEBUG, "consuming 8"),
    ]
