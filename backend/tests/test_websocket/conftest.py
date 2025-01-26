import asyncio
import ssl
from typing import Any, AsyncIterator, Awaitable, Optional
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


import pytest_asyncio


@pytest_asyncio.fixture(name="ws_server", scope="session", autouse=True)
async def fixture_ws_server(testapp):
    server = UvicornTestServer(testapp)
    try:
        await server.start_up()
        yield
        await server.tear_down()
    except Exception as e:
        print(e)
        raise e


@pytest_asyncio.fixture(scope="session")
async def ws_client():

    sio = socketio.AsyncClient()
    await sio.connect(BASE_URL, wait_timeout=1)
    yield sio
    await sio.disconnect()
    await sio.wait()


@pytest_asyncio.fixture(scope="session")
async def ws_client_import():

    sio = socketio.AsyncClient()
    await sio.connect(BASE_URL, wait_timeout=1, namespaces=["/import"])
    yield sio
    await sio.disconnect()
    await sio.wait()
