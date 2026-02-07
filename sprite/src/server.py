"""Sprite WebSocket server -- listens on port 8765 for Bridge connections."""

from __future__ import annotations

import asyncio
import logging
import signal

import websockets
from websockets.asyncio.server import serve, ServerConnection

from .gateway import SpriteGateway

logger = logging.getLogger(__name__)

HOST = "0.0.0.0"
PORT = 8765


async def handle_connection(ws: ServerConnection) -> None:
    """Handle a single WebSocket connection from the Bridge."""
    remote = ws.remote_address
    logger.info("Connection opened: %s", remote)

    gateway = SpriteGateway(send_fn=ws.send)

    try:
        async for raw in ws:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8", errors="replace")
            await gateway.route(raw)
    except websockets.ConnectionClosed:
        logger.info("Connection closed: %s", remote)
    except Exception:
        logger.exception("Unhandled error in connection handler")
    finally:
        logger.info("Connection ended: %s", remote)


async def main() -> None:
    """Start the WebSocket server with graceful shutdown."""
    stop = asyncio.Future()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: stop.set_result(None))

    async with serve(handle_connection, HOST, PORT) as server:
        logger.info("Sprite server listening on ws://%s:%d", HOST, PORT)
        await stop
        logger.info("Shutting down...")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(main())
