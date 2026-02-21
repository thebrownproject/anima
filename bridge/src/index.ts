/**
 * Bridge Service -- WebSocket proxy between browsers and Sprites.
 *
 * Lightweight Node.js server on Fly.io. Accepts browser WebSocket
 * connections on /ws, validates Clerk JWT on first message, looks up
 * user's Sprite in Supabase, and tracks authenticated connections.
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import {
  authenticateConnection,
  isAuthError,
} from './auth.js'
import { handleApiProxy } from './api-proxy.js'
import {
  isAuthConnect,
  isWebSocketMessage,
} from './protocol.js'
import { createSystemMessage } from './system-message.js'
import {
  ensureSpriteConnection,
  forwardToSprite,
  disconnectSprite,
  resetSpriteConnections,
} from './proxy.js'
import { resetKeepalives } from './keepalive.js'
import { resetReconnectState } from './reconnect.js'
import {
  ensureSpriteProvisioned,
} from './provisioning.js'
import {
  type Connection,
  getConnection,
  setConnection,
  getConnectionsByUser,
  getConnectionCount,
  removeConnection,
  setPending,
  hasPending,
  getPendingCount,
  removePending,
  allConnections,
  allPending,
} from './connection-store.js'

// Re-export for consumers that previously imported from index
export { type Connection, getConnection, getConnectionsByUser, getConnectionCount, getPendingCount } from './connection-store.js'

const AUTH_TIMEOUT_MS = 30_000

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SPRITES_TOKEN',
  'ANTHROPIC_API_KEY',
  'MISTRAL_API_KEY',
  'SPRITES_PROXY_TOKEN',
]

/**
 * Validate required env vars at startup. Fails fast with a descriptive error
 * listing all missing vars. Skipped in test environment.
 */
export function validateEnv(): void {
  const clerkKey = process.env.CLERK_SECRET_KEY || process.env.CLERK_JWT_KEY
  const missing: string[] = []

  if (!clerkKey) missing.push('CLERK_SECRET_KEY or CLERK_JWT_KEY')
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) missing.push(key)
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
}

function sendError(ws: WebSocket, message: string, requestId?: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(createSystemMessage('error', message, requestId))
  }
}

function handleConnection(ws: WebSocket): void {
  const connectionId = uuidv4()

  const timer = setTimeout(() => {
    sendError(ws, 'Auth timeout: no auth message received')
    ws.close(4001, 'Auth timeout')
    removePending(connectionId)
  }, AUTH_TIMEOUT_MS)

  setPending(connectionId, { ws, timer })

  ws.on('error', (err) => {
    console.error(`[${connectionId}] WebSocket error:`, err.message)
  })

  ws.on('close', () => {
    const conn = getConnection(connectionId)
    removePending(connectionId)
    removeConnection(connectionId)
    if (conn && getConnectionsByUser(conn.userId).length === 0) {
      disconnectSprite(conn.userId)
    }
  })

  // T2.7: Top-level try/catch wrapping entire async message handler
  ws.on('message', async (data) => {
    try {
      const raw = data.toString()

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        sendError(ws, 'Invalid JSON')
        return
      }

      if (!isWebSocketMessage(parsed)) {
        sendError(ws, 'Invalid message format: missing id, type, or timestamp')
        return
      }

      // Auth flow for pending connections
      if (hasPending(connectionId)) {
        if (!isAuthConnect(parsed)) {
          sendError(ws, 'First message must be type: auth', parsed.id)
          ws.close(4001, 'First message must be auth')
          removePending(connectionId)
          return
        }

        const result = await authenticateConnection(parsed.payload.token)

        if (isAuthError(result)) {
          sendError(ws, result.reason, parsed.id)
          ws.close(result.code, result.reason)
          removePending(connectionId)
          return
        }

        // T2.5: Check socket is still open after async auth
        if (ws.readyState !== WebSocket.OPEN) {
          removePending(connectionId)
          return
        }

        removePending(connectionId)
        const conn: Connection = {
          id: connectionId,
          ws,
          userId: result.userId,
          spriteName: result.spriteName,
          spriteStatus: result.spriteStatus,
          connectedAt: Date.now(),
        }
        setConnection(connectionId, conn)

        ws.send(createSystemMessage('connected', `Authenticated as ${result.userId}`, parsed.id))

        console.log(
          `[${connectionId}] Authenticated: user=${result.userId} sprite=${result.spriteName ?? 'none'}`,
        )

        // T2.1: Wire provisioning for new users or failed/pending Sprites
        let spriteName = result.spriteName
        let spriteStatus = result.spriteStatus

        if (!spriteName || spriteStatus === 'pending' || spriteStatus === 'failed') {
          try {
            const provision = await ensureSpriteProvisioned(result.userId, spriteStatus, spriteName)
            spriteName = provision.spriteName
            spriteStatus = provision.spriteStatus
            conn.spriteName = spriteName
            conn.spriteStatus = spriteStatus

            if (provision.error) {
              sendError(ws, `Sprite provisioning failed: ${provision.error}`, parsed.id)
              return
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Provisioning failed'
            console.error(`[${connectionId}] Provisioning failed:`, msg)
            sendError(ws, `Sprite provisioning failed: ${msg}`, parsed.id)
            return
          }
        }

        // T2.3: Explicit error when SPRITES_TOKEN is missing
        const token = process.env.SPRITES_TOKEN
        if (!token) {
          sendError(ws, 'Server configuration error: missing SPRITES_TOKEN', parsed.id)
          return
        }

        // T2.5: Check socket still open after provisioning
        if (ws.readyState !== WebSocket.OPEN) return

        if (spriteName && spriteStatus === 'active') {
          try {
            await ensureSpriteConnection(result.userId, spriteName, token)
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(createSystemMessage('sprite_ready', `Sprite ${spriteName} connected`, parsed.id))
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Sprite connection failed'
            console.error(`[${connectionId}] Sprite connection failed:`, msg)
            sendError(ws, `Sprite connection failed: ${msg}`, parsed.id)
          }
        } else if (spriteName) {
          console.error(`[${connectionId}] Unexpected sprite_status='${spriteStatus}' for sprite=${spriteName}`)
          sendError(ws, `Unexpected sprite status: ${spriteStatus}. Please contact support.`, parsed.id)
        }
        return
      }

      // Authenticated connection -- forward messages to Sprite
      const conn = getConnection(connectionId)
      if (!conn) {
        sendError(ws, 'Connection not found')
        return
      }

      if (!forwardToSprite(conn.userId, raw)) {
        sendError(ws, 'Sprite not connected', parsed.request_id ?? parsed.id)
      }
    } catch (err) {
      console.error(`[${connectionId}] Unhandled message handler error:`, err)
      sendError(ws, 'Internal error')
    }
  })
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      connections: getConnectionCount(),
      pending: getPendingCount(),
      uptime: process.uptime(),
    }))
    return
  }

  if (req.url?.startsWith('/v1/proxy/')) {
    handleApiProxy(req, res)
    return
  }

  res.writeHead(426, { 'Content-Type': 'text/plain' })
  res.end('WebSocket connections only. Connect to /ws')
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request: IncomingMessage, socket, head) => {
  const url = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`)

  if (url.pathname !== '/ws') {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    handleConnection(ws)
  })
})

const PORT = parseInt(process.env.PORT ?? '8080', 10)

export function startServer(port: number = PORT): ReturnType<typeof server.listen> {
  // T2.2: Validate env before starting (skip in test)
  if (process.env.NODE_ENV !== 'test') {
    validateEnv()
  }
  return server.listen(port, () => {
    console.log(`Bridge listening on port ${port}`)
    console.log(`WebSocket endpoint: ws://localhost:${port}/ws`)
  })
}

// Only auto-start when run directly (not imported in tests)
if (process.env.NODE_ENV !== 'test') {
  startServer()
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...')

  // Force exit if graceful shutdown takes too long
  const forceExit = setTimeout(() => {
    console.error('Forced exit after timeout')
    process.exit(1)
  }, 5_000)
  forceExit.unref()

  resetKeepalives()
  resetReconnectState()
  resetSpriteConnections()

  for (const conn of allConnections()) {
    conn.ws.close(1001, 'Server shutting down')
  }
  for (const pending of allPending()) {
    pending.ws.close(1001, 'Server shutting down')
  }
  server.close(() => {
    console.log('Bridge shut down')
    process.exit(0)
  })
})

// T2.6: Catch unhandled promise rejections (log only, don't crash)
process.on('unhandledRejection', (reason) => {
  console.error('[bridge] Unhandled rejection:', reason)
})

// Export for testing
export { server, wss }
