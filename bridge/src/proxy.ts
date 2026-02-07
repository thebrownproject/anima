import { WebSocket } from 'ws'
import { SpriteConnection } from './sprite-connection.js'
import { getConnectionsByStack } from './index.js'

/** Active Sprite connections keyed by stack ID. */
const spriteConnections = new Map<string, SpriteConnection>()

export function getSpriteConnection(stackId: string): SpriteConnection | undefined {
  return spriteConnections.get(stackId)
}

export function getSpriteConnectionCount(): number {
  return spriteConnections.size
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

  const conn = new SpriteConnection({
    spriteName,
    token,
    onMessage: (data) => broadcastToBrowsers(stackId, data),
    onClose: (_code, _reason) => {
      spriteConnections.delete(stackId)
    },
    onError: (err) => {
      console.error(`[sprite:${spriteName}] TCP Proxy error:`, err.message)
    },
  })

  await conn.connect()
  spriteConnections.set(stackId, conn)
  return conn
}

/** Forward a browser message to the Sprite for this stack. */
export function forwardToSprite(stackId: string, message: string): boolean {
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
  const conn = spriteConnections.get(stackId)
  if (conn) {
    conn.close()
    spriteConnections.delete(stackId)
  }
}
