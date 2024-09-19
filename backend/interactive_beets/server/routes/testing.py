"""Just some temporary tests"""

import asyncio

from quart import Blueprint, websocket

test_bp = Blueprint("test", __name__, url_prefix="/test")


@test_bp.route("/", methods=["GET"])
async def get():
    return {"message": "Hello, World!"}


@test_bp.route("/", methods=["POST"])
async def post():
    return {"message": "Hello, World!"}


@test_bp.websocket("/")
async def ws():
    try:
        while True:
            data = await websocket.receive()
            await websocket.send(data)
    except asyncio.CancelledError:
        # Handle disconnection here
        raise
