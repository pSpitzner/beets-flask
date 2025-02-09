import pytest
from socketio import AsyncClient


@pytest.mark.asyncio
async def test_ws_client(ws_client_import):
    assert isinstance(ws_client_import, AsyncClient)
    assert ws_client_import.sid is not None
    assert ws_client_import.connected is True
