"""Sprite TCP server -- listens on port 8765 for Bridge connections via TCP Proxy."""

from __future__ import annotations

import asyncio
import logging
import signal

from .gateway import SpriteGateway
from .database import Database

logger = logging.getLogger(__name__)

HOST = "0.0.0.0"
PORT = 8765


async def handle_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    db: Database | None = None,
) -> None:
    """Handle a single TCP connection from the Bridge (via Sprites TCP Proxy)."""
    remote = writer.get_extra_info("peername")
    logger.info("Connection opened: %s", remote)

    async def send_fn(data: str) -> None:
        writer.write((data + "\n").encode())
        await writer.drain()

    gateway = SpriteGateway(send_fn=send_fn, db=db)

    try:
        while True:
            line = await reader.readline()
            if not line:
                break
            raw = line.decode("utf-8", errors="replace").strip()
            if raw:
                await gateway.route(raw)
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("Unhandled error in connection handler")
    finally:
        writer.close()
        logger.info("Connection ended: %s", remote)


async def main() -> None:
    """Start the TCP server with graceful shutdown."""
    stop = asyncio.Future()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: stop.set_result(None))

    async with Database() as db:
        handler = lambda r, w: handle_connection(r, w, db=db)
        server = await asyncio.start_server(handler, HOST, PORT)
        logger.info("Sprite server listening on tcp://%s:%d", HOST, PORT)
        await stop
        server.close()
        logger.info("Shutting down...")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(main())
