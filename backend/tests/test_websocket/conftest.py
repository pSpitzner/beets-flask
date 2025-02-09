import logging
import asyncio
import ssl
from typing import Any, AsyncIterator, Awaitable, Optional
from engineio.async_socket import AsyncSocket
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
        super().__init__(
            config=uvicorn.Config(app, host=host, port=port, ws_ping_interval=0.01)
        )

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
        await asyncio.sleep(self.config.ws_ping_interval or 0.01)


import pytest_asyncio


@pytest_asyncio.fixture(name="ws_server", scope="session", autouse=True)
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


@pytest_asyncio.fixture(scope="session")
async def ws_client(ws_server):
    sio = socketio.AsyncClient()
    await sio.connect(BASE_URL, wait_timeout=1)
    try:
        yield sio
    finally:
        await sio.disconnect()
        await sio.wait()
        await sio.shutdown()


@pytest_asyncio.fixture(scope="function", loop_scope="session")
async def ws_client_import(ws_server):
    sio = socketio.AsyncClient(request_timeout=1, reconnection=False)
    await sio.connect(BASE_URL, wait=False, namespaces=["/import"])
    try:
        yield sio
    finally:
        await sio.disconnect()
        await sio.wait()
        await sio.shutdown()
