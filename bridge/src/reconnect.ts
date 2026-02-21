import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { getSprite } from './sprites-client.js'
import { SpriteConnection } from './sprite-connection.js'
import { getConnectionsByUser } from './connection-store.js'
import { startSpriteServer } from './provisioning.js'
import { createSystemMessage } from './system-message.js'

const MAX_BUFFER = 50
const BUFFER_TTL_MS = 60_000
const POLL_INTERVAL_MS = 1_000
const MAX_POLL_ATTEMPTS = 30
const SERVER_PING_TIMEOUT_MS = 5_000
const MAX_CONNECT_ATTEMPTS = 5
const CONNECT_RETRY_MS = 2_000

interface BufferedMessage {
  data: string
  bufferedAt: number
}

interface ReconnectState {
  inProgress: boolean
  buffer: BufferedMessage[]
  connection: SpriteConnection | null
}

const reconnectStates = new Map<string, ReconnectState>()

function getState(userId: string): ReconnectState {
  let state = reconnectStates.get(userId)
  if (!state) {
    state = { inProgress: false, buffer: [], connection: null }
    reconnectStates.set(userId, state)
  }
  return state
}

export function isReconnecting(userId: string): boolean {
  return reconnectStates.get(userId)?.inProgress === true
}

export function bufferMessage(userId: string, data: string): boolean {
  const state = getState(userId)
  if (state.buffer.length >= MAX_BUFFER) return false
  state.buffer.push({ data, bufferedAt: Date.now() })
  return true
}

function drainBuffer(userId: string): string[] {
  const state = reconnectStates.get(userId)
  if (!state) return []
  const now = Date.now()
  const valid = state.buffer
    .filter((m) => now - m.bufferedAt < BUFFER_TTL_MS)
    .map((m) => m.data)
  state.buffer = []
  return valid
}

function broadcastSystem(userId: string, event: 'sprite_waking' | 'sprite_ready' | 'reconnect_failed', message?: string): void {
  const data = createSystemMessage(event, message)
  for (const browser of getConnectionsByUser(userId)) {
    if (browser.ws.readyState === WebSocket.OPEN) {
      browser.ws.send(data)
    }
  }
}

async function waitForRunning(spriteName: string): Promise<boolean> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const info = await getSprite(spriteName)
    if (info.status === 'running') return true
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

/** Default: verify server by sending a ping and waiting for pong through TCP Proxy. */
function defaultVerifyServer(conn: SpriteConnection): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      conn.replaceMessageHandler(origHandler)
      resolve(false)
    }, SERVER_PING_TIMEOUT_MS)

    const origHandler = conn.replaceMessageHandler((data: string) => {
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'pong') {
          clearTimeout(timer)
          conn.replaceMessageHandler(origHandler)
          resolve(true)
          return
        }
      } catch { /* forward normally */ }
      origHandler(data)
    })

    const sent = conn.send(JSON.stringify({ type: 'ping', id: uuidv4(), timestamp: Date.now() }))
    if (!sent) {
      clearTimeout(timer)
      conn.replaceMessageHandler(origHandler)
      resolve(false)
    }
  })
}

/** Default: restart Python server via shared utility (includes env vars). */
async function defaultRestartServer(spriteName: string, token: string): Promise<void> {
  await startSpriteServer(spriteName, token)
}

export interface ReconnectDeps {
  spriteName: string
  token: string
  createConnection: (spriteName: string, token: string) => Promise<SpriteConnection>
  /** Register a verified connection in the proxy's spriteConnections Map. */
  registerConnection: (conn: SpriteConnection) => void
  sendToSprite: (data: string) => boolean
  /** Override for testing. Default sends ping, waits for pong. */
  verifyServer?: (conn: SpriteConnection) => Promise<boolean>
  /** Override for testing. Default launches exec to restart Python server. */
  restartServer?: (spriteName: string, token: string) => Promise<void>
}

/**
 * Try to connect to the Sprite TCP Proxy with retries.
 * Handles the deploy scenario where the server isn't listening yet.
 */
async function connectWithRetry(
  userId: string,
  deps: ReconnectDeps,
): Promise<SpriteConnection | null> {
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      return await deps.createConnection(deps.spriteName, deps.token)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('TCP Proxy closed during init')) throw err
      console.warn(`[reconnect:${userId}] Connection attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed (server not ready)`)
      if (attempt < MAX_CONNECT_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, CONNECT_RETRY_MS))
      }
    }
  }
  return null
}

/**
 * Handle a Sprite TCP Proxy connection drop.
 * Wakes the Sprite, reconnects (with retries), verifies server, replays buffered messages.
 * Coalesces concurrent calls — only one reconnect runs per user.
 */
export async function handleDisconnect(userId: string, deps: ReconnectDeps): Promise<boolean> {
  const state = getState(userId)
  if (state.inProgress) return false

  state.inProgress = true
  const verify = deps.verifyServer ?? defaultVerifyServer
  const restart = deps.restartServer ?? defaultRestartServer

  try {
    broadcastSystem(userId, 'sprite_waking', 'Sprite connection lost, reconnecting...')

    const running = await waitForRunning(deps.spriteName)
    if (!running) {
      console.error(`[reconnect:${userId}] Sprite ${deps.spriteName} failed to reach running state`)
      broadcastSystem(userId, 'reconnect_failed', 'Sprite failed to wake')
      return false
    }

    // Abort if all browsers disconnected during wake
    if (getConnectionsByUser(userId).length === 0) {
      console.log(`[reconnect:${userId}] No browsers connected, aborting reconnect`)
      return false
    }

    let conn = await connectWithRetry(userId, deps)

    // All connection attempts failed — start server and try once more
    if (!conn) {
      console.warn(`[reconnect:${userId}] Server not running after ${MAX_CONNECT_ATTEMPTS} attempts, starting via exec...`)
      await restart(deps.spriteName, deps.token)
      conn = await deps.createConnection(deps.spriteName, deps.token)
    }

    // Abort if all browsers disconnected during connect retries
    if (getConnectionsByUser(userId).length === 0) {
      console.log(`[reconnect:${userId}] No browsers connected after connect, aborting`)
      conn.close()
      return false
    }

    state.connection = conn

    const alive = await verify(conn)
    if (!alive) {
      console.warn(`[reconnect:${userId}] Server unresponsive, attempting exec restart`)
      conn.close()
      await restart(deps.spriteName, deps.token)
      conn = await deps.createConnection(deps.spriteName, deps.token)
      state.connection = conn
    }

    // Register in proxy's spriteConnections Map only after verify succeeds
    deps.registerConnection(conn)

    broadcastSystem(userId, 'sprite_ready', 'Sprite reconnected')

    const messages = drainBuffer(userId)
    for (const msg of messages) {
      deps.sendToSprite(msg)
    }

    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[reconnect:${userId}] Reconnection failed:`, msg)
    broadcastSystem(userId, 'reconnect_failed', `Reconnection failed: ${msg}`)
    return false
  } finally {
    state.inProgress = false
  }
}

export function cleanupReconnectState(userId: string): void {
  reconnectStates.delete(userId)
}

export function resetReconnectState(): void {
  reconnectStates.clear()
}
