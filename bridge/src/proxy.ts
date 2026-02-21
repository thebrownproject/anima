import { WebSocket } from 'ws'
import { SpriteConnection } from './sprite-connection.js'
import { getConnectionsByUser } from './connection-store.js'
import { handleDisconnect, bufferMessage, cleanupReconnectState } from './reconnect.js'
import { startKeepalive, stopKeepalive } from './keepalive.js'
import { checkAndUpdate } from './updater.js'
import { startSpriteServer } from './provisioning.js'

/** Active Sprite connections keyed by user ID. */
const spriteConnections = new Map<string, SpriteConnection>()

export function getSpriteConnection(userId: string): SpriteConnection | undefined {
  return spriteConnections.get(userId)
}

/** Register a connection in the Map. Used by ensureSpriteConnection and reconnect. */
export function registerSpriteConnection(userId: string, conn: SpriteConnection): void {
  spriteConnections.set(userId, conn)
}

/**
 * Create a SpriteConnection, connect it, and wire up reconnection on close.
 * Does NOT register in spriteConnections -- caller must call registerSpriteConnection
 * (or pass it as registerConnection in ReconnectDeps) after any verification step.
 */
async function createSpriteConnection(userId: string, spriteName: string, token: string): Promise<SpriteConnection> {
  const conn = new SpriteConnection({
    spriteName,
    token,
    onMessage: (data) => broadcastToBrowsers(userId, data),
    onClose: (_code, _reason) => {
      // Guard: only act if this connection is still the active one for this user.
      if (spriteConnections.get(userId) !== conn) return

      spriteConnections.delete(userId)
      if (getConnectionsByUser(userId).length > 0) {
        handleDisconnect(userId, {
          spriteName,
          token,
          createConnection: (sn, tk) => createSpriteConnection(userId, sn, tk),
          registerConnection: (c) => registerSpriteConnection(userId, c),
          sendToSprite: (data) => forwardToSprite(userId, data),
        }).catch((err) => {
          console.error(`[reconnect:${userId}] Unhandled error:`, err)
        })
      }
    },
    onError: (err) => {
      console.error(`[sprite:${spriteName}] TCP Proxy error:`, err.message)
    },
  })

  await conn.connect()
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
 * Connect to a Sprite via TCP Proxy if not already connected for this user.
 * Returns the existing connection if one is active.
 */
export async function ensureSpriteConnection(
  userId: string,
  spriteName: string,
  token: string,
): Promise<SpriteConnection> {
  const existing = spriteConnections.get(userId)
  if (existing && existing.state === 'connected') {
    return existing
  }

  // Clean up stale entry
  if (existing) {
    existing.close()
    spriteConnections.delete(userId)
  }

  // Best-effort lazy update — don't block connection on failure
  try {
    await checkAndUpdate(spriteName)
  } catch (err) {
    console.warn(`[proxy] Update check failed for ${spriteName}, proceeding:`, err)
  }

  let conn: SpriteConnection
  try {
    conn = await createSpriteConnection(userId, spriteName, token)
  } catch (err) {
    // If server isn't running (1011 = nothing listening on port), start it and retry once
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('TCP Proxy closed during init')) {
      console.warn(`[proxy:${spriteName}] Server not running, starting via exec...`)
      await startSpriteServer(spriteName, token)
      conn = await createSpriteConnection(userId, spriteName, token)
    } else {
      throw err
    }
  }
  spriteConnections.set(userId, conn)
  startKeepalive(userId)
  return conn
}

/** Forward a browser message to the Sprite for this user. Buffers when not connected. */
export function forwardToSprite(userId: string, message: string): boolean {
  const conn = spriteConnections.get(userId)
  if (conn && conn.state === 'connected') {
    return conn.send(message)
  }
  // Not connected — buffer for reconnect (either in progress or about to start)
  return bufferMessage(userId, message)
}

/** Broadcast a Sprite message to all browser connections for a user. */
function broadcastToBrowsers(userId: string, data: string): void {
  const browsers = getConnectionsByUser(userId)
  for (const browser of browsers) {
    if (browser.ws.readyState === WebSocket.OPEN) {
      browser.ws.send(data)
    }
  }
}

/** Disconnect the Sprite connection for a user (e.g., when last browser disconnects). */
export function disconnectSprite(userId: string): void {
  stopKeepalive(userId)
  cleanupReconnectState(userId)
  const conn = spriteConnections.get(userId)
  if (conn) {
    conn.close()
    spriteConnections.delete(userId)
  }
}
