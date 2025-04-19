import logging

import pytest
from socketio import AsyncClient

log = logging.getLogger(__name__)


@pytest.mark.asyncio
async def test_ws_client(ws_client):
    assert isinstance(ws_client, AsyncClient)
    assert ws_client.sid is not None
    assert ws_client.connected is True


@pytest.mark.asyncio
async def test_generic_exc(ws_client: AsyncClient):
    # TODO: this needs some more thoughts, we have a more generalized
    # error handling now, we might want to adjust this for websocket
    r = await ws_client.call(
        "test_generic_exc",
        namespace="/test",
        timeout=5,
    )

    assert r is not None
    assert isinstance(r, dict)
    assert r["error"] == "Exception"
    assert r["message"] == "Exception message"
