import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { getSprite, buildExecUrl } from './sprites-client.js'
import { SpriteConnection } from './sprite-connection.js'
import { getConnectionsByStack } from './connection-store.js'
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

function getState(stackId: string): ReconnectState {
  let state = reconnectStates.get(stackId)
  if (!state) {
    state = { inProgress: false, buffer: [], connection: null }
    reconnectStates.set(stackId, state)
  }
  return state
}

export function isReconnecting(stackId: string): boolean {
  return reconnectStates.get(stackId)?.inProgress === true
}

export function bufferMessage(stackId: string, data: string): boolean {
  const state = getState(stackId)
  if (!state.inProgress) return false
  if (state.buffer.length >= MAX_BUFFER) return false
  state.buffer.push({ data, bufferedAt: Date.now() })
  return true
}

function drainBuffer(stackId: string): string[] {
  const state = reconnectStates.get(stackId)
  if (!state) return []
  const now = Date.now()
  const valid = state.buffer
    .filter((m) => now - m.bufferedAt < BUFFER_TTL_MS)
    .map((m) => m.data)
  state.buffer = []
  return valid
}

function broadcastSystem(stackId: string, event: 'sprite_waking' | 'sprite_ready', message?: string): void {
  const msg: SystemMessage = {
    type: 'system',
    id: uuidv4(),
    timestamp: Date.now(),
    payload: { event, message },
  }
  const data = JSON.stringify(msg)
  for (const browser of getConnectionsByStack(stackId)) {
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

/** Default: restart Python WS server via exec. */
async function defaultRestartServer(spriteName: string, token: string): Promise<void> {
  const url = buildExecUrl(spriteName, ['bash', '-c', 'cd /workspace && PYTHONPATH=/workspace/.os /workspace/.os/.venv/bin/python3 -m src.server'])
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); resolve() }, 3_000)
    ws.on('open', () => { clearTimeout(timer); setTimeout(() => { ws.close(); resolve() }, 1_000) })
    ws.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
  await new Promise((r) => setTimeout(r, 2_000))
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
 * Coalesces concurrent calls — only one reconnect runs per stack.
 */
export async function handleDisconnect(stackId: string, deps: ReconnectDeps): Promise<boolean> {
  const state = getState(stackId)
  if (state.inProgress) return false

  state.inProgress = true
  const verify = deps.verifyServer ?? defaultVerifyServer
  const restart = deps.restartServer ?? defaultRestartServer

  try {
    broadcastSystem(stackId, 'sprite_waking', 'Sprite connection lost, reconnecting...')

    const running = await waitForRunning(deps.spriteName)
    if (!running) {
      console.error(`[reconnect:${stackId}] Sprite ${deps.spriteName} failed to reach running state`)
      return false
    }

    const conn = await deps.createConnection(deps.spriteName, deps.token)
    state.connection = conn

    const alive = await verify(conn)
    if (!alive) {
      console.warn(`[reconnect:${stackId}] Server unresponsive, attempting exec restart`)
      conn.close()
      await restart(deps.spriteName, deps.token)
      const retryConn = await deps.createConnection(deps.spriteName, deps.token)
      state.connection = retryConn
    }

    broadcastSystem(stackId, 'sprite_ready', 'Sprite reconnected')

    const messages = drainBuffer(stackId)
    for (const msg of messages) {
      deps.sendToSprite(msg)
    }

    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[reconnect:${stackId}] Reconnection failed:`, msg)
    return false
  } finally {
    state.inProgress = false
  }
}

export function cleanupReconnectState(stackId: string): void {
  reconnectStates.delete(stackId)
}

export function resetReconnectState(): void {
  reconnectStates.clear()
}
