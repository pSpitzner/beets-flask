import asyncio
import logging
from typing import Any, Optional

import pytest
import socketio
import uvicorn

HOST = "127.0.0.1"
PORT = 5006
BASE_URL = f"http://{HOST}:{PORT}"


class UvicornTestServer(uvicorn.Server):
    def __init__(
        self,
        app: socketio.ASGIApp,
        host: str = HOST,
        port: int = PORT,
    ):
        self._startup_done = asyncio.Event()
        self._serve_task: Optional[asyncio.Task] = None
        super().__init__(config=uvicorn.Config(app, host=host, port=port))

    async def startup(self, sockets=None) -> None:
        """Override uvicorn startup"""
        await super().startup()
        self.config.setup_event_loop()
        self._startup_done.set()

    async def start_up(self) -> None:
        """Start up server asynchronously"""
        self._serve_task = asyncio.create_task(self.serve())
        await self._startup_done.wait()

    async def tear_down(self) -> None:
        """Shut down server asynchronously"""
        self.should_exit = True
        if self._serve_task:
            # Cancel the serve task
            self._serve_task.cancel()
            # Wait for all tasks to complete, ignoring any CancelledErrors
            try:
                await self._serve_task
            except asyncio.exceptions.CancelledError:
                pass
        await self.shutdown()


@pytest.fixture
async def fixture_ws_server(testapp):
    server = UvicornTestServer(testapp)
    try:
        await server.start_up()
        yield
        await server.tear_down()
        await server.shutdown()
    except Exception as e:
        raise e

    tasks = asyncio.all_tasks()
    for task in tasks:
        if task is not asyncio.current_task():
            task.cancel()


@pytest.fixture
async def ws_client(fixture_ws_server):
    client = socketio.AsyncClient(reconnection=False)
    await client.connect(
        BASE_URL,
        namespaces=["/test"],
        transports=["websocket"],
    )
    try:
        yield client
    finally:
        await client.disconnect()
        await client.wait()
        await client.shutdown()
