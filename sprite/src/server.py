"""Sprite TCP server -- listens on port 8765 for Bridge connections via TCP Proxy.

The AgentRuntime is scoped to the server, NOT the connection. This means:
- Conversation context survives TCP reconnections (sleep/wake, page reload)
- When a new connection arrives, we update the runtime's send_fn
- The SDK client stays alive across reconnections
"""

from __future__ import annotations

import asyncio
import logging
import signal

from .gateway import SpriteGateway
from .runtime import AgentRuntime

logger = logging.getLogger(__name__)

HOST = "0.0.0.0"
PORT = 8765


async def handle_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    runtime: AgentRuntime,
) -> None:
    """Handle a single TCP connection from the Bridge (via Sprites TCP Proxy).

    Reuses the server-scoped AgentRuntime so conversation context persists
    across reconnections.
    """
    remote = writer.get_extra_info("peername")
    logger.info("Connection opened: %s", remote)

    async def send_fn(data: str) -> None:
        writer.write((data + "\n").encode())
        await writer.drain()

    # Point the runtime at the new connection's send_fn
    runtime.update_send_fn(send_fn)

    gateway = SpriteGateway(send_fn=send_fn, runtime=runtime)

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

    # Runtime scoped to server — survives TCP reconnections
    # Task 8 wires in TranscriptDB/MemoryDB
    runtime = AgentRuntime(send_fn=_noop_send)

    handler = lambda r, w: handle_connection(r, w, runtime=runtime)
    server = await asyncio.start_server(handler, HOST, PORT)
    logger.info("Sprite server listening on tcp://%s:%d", HOST, PORT)
    await stop
    server.close()
    await runtime.cleanup()
    logger.info("Shutting down...")


async def _noop_send(data: str) -> None:
    """Placeholder send_fn until first connection arrives."""
    logger.warning("No active connection — dropping message")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(main())
