import { WebSocket } from 'ws'
import { SpriteConnection } from './sprite-connection.js'
import { getConnectionsByStack } from './connection-store.js'
import { handleDisconnect, isReconnecting, bufferMessage, cleanupReconnectState } from './reconnect.js'
import { startKeepalive, stopKeepalive } from './keepalive.js'
import { checkAndUpdate } from './updater.js'
import { startSpriteServer } from './provisioning.js'

/** Active Sprite connections keyed by stack ID. */
const spriteConnections = new Map<string, SpriteConnection>()

export function getSpriteConnection(stackId: string): SpriteConnection | undefined {
  return spriteConnections.get(stackId)
}

/**
 * Create a SpriteConnection, register it, and wire up reconnection on close.
 * Extracted so reconnect.ts can call the same logic for re-establishment.
 */
async function createAndRegister(stackId: string, spriteName: string, token: string): Promise<SpriteConnection> {
  const conn = new SpriteConnection({
    spriteName,
    token,
    onMessage: (data) => broadcastToBrowsers(stackId, data),
    onClose: (_code, _reason) => {
      spriteConnections.delete(stackId)
      // Only attempt reconnection if browsers are still connected
      if (getConnectionsByStack(stackId).length > 0) {
        handleDisconnect(stackId, {
          spriteName,
          token,
          createConnection: (sn, tk) => createAndRegister(stackId, sn, tk),
          sendToSprite: (data) => forwardToSprite(stackId, data),
        }).catch((err) => {
          console.error(`[reconnect:${stackId}] Unhandled error:`, err)
        })
      }
    },
    onError: (err) => {
      console.error(`[sprite:${spriteName}] TCP Proxy error:`, err.message)
    },
  })

  await conn.connect()
  spriteConnections.set(stackId, conn)
  return conn
}

/** For testing — clear all tracked connections. */
export function resetSpriteConnections(): void {
  for (const conn of spriteConnections.values()) {
    conn.close()
  }
  spriteConnections.clear()
}

/**
 * Connect to a Sprite via TCP Proxy if not already connected for this stack.
 * Returns the existing connection if one is active.
 */
export async function ensureSpriteConnection(
  stackId: string,
  spriteName: string,
  token: string,
): Promise<SpriteConnection> {
  const existing = spriteConnections.get(stackId)
  if (existing && existing.state === 'connected') {
    return existing
  }

  // Clean up stale entry
  if (existing) {
    existing.close()
    spriteConnections.delete(stackId)
  }

  // Best-effort lazy update — don't block connection on failure
  try {
    await checkAndUpdate(spriteName)
  } catch (err) {
    console.warn(`[proxy] Update check failed for ${spriteName}, proceeding:`, err)
  }

  let conn: SpriteConnection
  try {
    conn = await createAndRegister(stackId, spriteName, token)
  } catch (err) {
    // If server isn't running (1011 = nothing listening on port), start it and retry once
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('TCP Proxy closed during init')) {
      console.warn(`[proxy:${spriteName}] Server not running, starting via exec...`)
      await startSpriteServer(spriteName, token)
      conn = await createAndRegister(stackId, spriteName, token)
    } else {
      throw err
    }
  }
  startKeepalive(stackId)
  return conn
}

/** Forward a browser message to the Sprite for this stack. Buffers during reconnect. */
export function forwardToSprite(stackId: string, message: string): boolean {
  if (isReconnecting(stackId)) {
    return bufferMessage(stackId, message)
  }
  const conn = spriteConnections.get(stackId)
  if (!conn || conn.state !== 'connected') return false
  return conn.send(message)
}

/** Broadcast a Sprite message to all browser connections for a stack. */
function broadcastToBrowsers(stackId: string, data: string): void {
  const browsers = getConnectionsByStack(stackId)
  for (const browser of browsers) {
    if (browser.ws.readyState === WebSocket.OPEN) {
      browser.ws.send(data)
    }
  }
}

/** Disconnect the Sprite connection for a stack (e.g., when last browser disconnects). */
export function disconnectSprite(stackId: string): void {
  stopKeepalive(stackId)
  cleanupReconnectState(stackId)
  const conn = spriteConnections.get(stackId)
  if (conn) {
    conn.close()
    spriteConnections.delete(stackId)
  }
}
