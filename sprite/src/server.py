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
from pathlib import Path

import anthropic

from .database import TranscriptDB, MemoryDB, WorkspaceDB
from .memory.processor import ObservationProcessor
from .gateway import SpriteGateway
from .runtime import AgentRuntime
from .state_sync import send_state_sync

logger = logging.getLogger(__name__)

HOST = "0.0.0.0"
PORT = 8765
MEMORY_DIR = Path("/workspace/.os/memory")


async def handle_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    runtime: AgentRuntime,
    workspace_db: WorkspaceDB,
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

    gateway = SpriteGateway(send_fn=send_fn, runtime=runtime, workspace_db=workspace_db)

    await send_state_sync(workspace_db, send_fn)

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

    # Initialize databases
    transcript_db = TranscriptDB()
    memory_db = MemoryDB()
    workspace_db = WorkspaceDB()
    await transcript_db.connect()
    await memory_db.connect()
    await workspace_db.connect()

    # Anthropic client for batch processor (reads ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL from env)
    anthropic_client = anthropic.AsyncAnthropic()

    # Observation batch processor
    processor = ObservationProcessor(
        transcript_db=transcript_db,
        memory_db=memory_db,
        anthropic_client=anthropic_client,
        memory_dir=MEMORY_DIR,
    )

    # Runtime scoped to server — survives TCP reconnections
    runtime = AgentRuntime(
        send_fn=_noop_send,
        transcript_db=transcript_db,
        memory_db=memory_db,
        processor=processor,
        workspace_db=workspace_db,
    )

    handler = lambda r, w: handle_connection(r, w, runtime=runtime, workspace_db=workspace_db)
    # 50MB limit for StreamReader — file_upload messages carry base64 data (25MB file ≈ 33MB base64)
    server = await asyncio.start_server(handler, HOST, PORT, limit=50 * 1024 * 1024)
    logger.info("Sprite server listening on tcp://%s:%d", HOST, PORT)
    await stop
    server.close()
    await runtime.cleanup()
    await transcript_db.close()
    await memory_db.close()
    await workspace_db.close()
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
