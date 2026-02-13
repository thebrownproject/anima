import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { getSprite } from './sprites-client.js'
import { SpriteConnection } from './sprite-connection.js'
import { getConnectionsByUser } from './connection-store.js'
import { startSpriteServer } from './provisioning.js'
import type { SystemMessage } from './protocol.js'

const MAX_BUFFER = 50
const BUFFER_TTL_MS = 60_000
const POLL_INTERVAL_MS = 1_000
const MAX_POLL_ATTEMPTS = 30
const SERVER_PING_TIMEOUT_MS = 5_000

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
  if (!state.inProgress) return false
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

function broadcastSystem(userId: string, event: 'sprite_waking' | 'sprite_ready', message?: string): void {
  const msg: SystemMessage = {
    type: 'system',
    id: uuidv4(),
    timestamp: Date.now(),
    payload: { event, message },
  }
  const data = JSON.stringify(msg)
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
    const timer = setTimeout(() => resolve(false), SERVER_PING_TIMEOUT_MS)
    const origHandler = conn['opts'].onMessage

    conn['opts'].onMessage = (data: string) => {
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'pong') {
          clearTimeout(timer)
          conn['opts'].onMessage = origHandler
          resolve(true)
          return
        }
      } catch { /* forward normally */ }
      origHandler(data)
    }

    const sent = conn.send(JSON.stringify({ type: 'ping', id: uuidv4(), timestamp: Date.now() }))
    if (!sent) {
      clearTimeout(timer)
      conn['opts'].onMessage = origHandler
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
  sendToSprite: (data: string) => boolean
  /** Override for testing. Default sends ping, waits for pong. */
  verifyServer?: (conn: SpriteConnection) => Promise<boolean>
  /** Override for testing. Default launches exec to restart Python server. */
  restartServer?: (spriteName: string, token: string) => Promise<void>
}

/**
 * Handle a Sprite TCP Proxy connection drop.
 * Wakes the Sprite, reconnects, verifies server, replays buffered messages.
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
      return false
    }

    const conn = await deps.createConnection(deps.spriteName, deps.token)
    state.connection = conn

    const alive = await verify(conn)
    if (!alive) {
      console.warn(`[reconnect:${userId}] Server unresponsive, attempting exec restart`)
      conn.close()
      await restart(deps.spriteName, deps.token)
      const retryConn = await deps.createConnection(deps.spriteName, deps.token)
      state.connection = retryConn
    }

    broadcastSystem(userId, 'sprite_ready', 'Sprite reconnected')

    const messages = drainBuffer(userId)
    for (const msg of messages) {
      deps.sendToSprite(msg)
    }

    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[reconnect:${userId}] Reconnection failed:`, msg)
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
