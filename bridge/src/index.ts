/**
 * Bridge Service — WebSocket proxy between browsers and Sprites.
 *
 * Lightweight Node.js server on Fly.io (~300 lines). Accepts browser
 * WebSocket connections on /ws/{stack_id}, validates Clerk JWT on
 * first message, looks up stack ownership in Supabase, and tracks
 * authenticated connections.
 *
 * Later tasks add: Sprite TCP Proxy connection, message forwarding,
 * sleep/wake reconnection, keepalive pings.
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import {
  authenticateConnection,
  isAuthError,
  type AuthResult,
} from './auth.js'
import { handleApiProxy } from './api-proxy.js'
import {
  isAuthConnect,
  isWebSocketMessage,
  type SystemMessage,
} from './protocol.js'
import {
  ensureSpriteConnection,
  forwardToSprite,
  disconnectSprite,
} from './proxy.js'
import {
  type Connection,
  getConnection,
  setConnection,
  getConnectionsByStack,
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
export { type Connection, getConnection, getConnectionsByStack, getConnectionCount, getPendingCount } from './connection-store.js'

/** How long a client has to send an auth message after connecting. */
const AUTH_TIMEOUT_MS = 10_000

// =============================================================================
// Message Helpers
// =============================================================================

function createSystemMessage(
  event: 'connected' | 'sprite_waking' | 'sprite_ready' | 'error',
  message?: string,
  requestId?: string,
): string {
  const msg: SystemMessage = {
    type: 'system',
    id: uuidv4(),
    timestamp: Date.now(),
    payload: { event, message },
    ...(requestId ? { request_id: requestId } : {}),
  }
  return JSON.stringify(msg)
}

function sendError(ws: WebSocket, message: string, requestId?: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(createSystemMessage('error', message, requestId))
  }
}

// =============================================================================
// WebSocket Connection Handler
// =============================================================================

function handleConnection(ws: WebSocket, stackId: string): void {
  const connectionId = uuidv4()

  // Set up auth timeout — client must send auth message within AUTH_TIMEOUT_MS
  const timer = setTimeout(() => {
    sendError(ws, 'Auth timeout: no auth message received')
    ws.close(4001, 'Auth timeout')
    removePending(connectionId)
  }, AUTH_TIMEOUT_MS)

  setPending(connectionId, { ws, stackId, timer })

  ws.on('error', (err) => {
    console.error(`[${connectionId}] WebSocket error:`, err.message)
  })

  ws.on('close', () => {
    const conn = getConnection(connectionId)
    removePending(connectionId)
    removeConnection(connectionId)
    // Disconnect Sprite if this was the last browser for the stack
    if (conn && getConnectionsByStack(conn.stackId).length === 0) {
      disconnectSprite(conn.stackId)
    }
  })

  // Handle incoming messages
  ws.on('message', async (data) => {
    const raw = data.toString()

    // Parse as JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      sendError(ws, 'Invalid JSON')
      return
    }

    // Validate base message structure
    if (!isWebSocketMessage(parsed)) {
      sendError(ws, 'Invalid message format: missing id, type, or timestamp')
      return
    }

    // If not yet authenticated, first message MUST be auth
    if (hasPending(connectionId)) {
      if (!isAuthConnect(parsed)) {
        sendError(ws, 'First message must be type: auth', parsed.id)
        ws.close(4001, 'First message must be auth')
        removePending(connectionId)
        return
      }

      // Authenticate
      const result = await authenticateConnection(parsed.payload.token, stackId)

      if (isAuthError(result)) {
        sendError(ws, result.reason, parsed.id)
        ws.close(result.code, result.reason)
        removePending(connectionId)
        return
      }

      // Auth successful — promote to authenticated connection
      removePending(connectionId)
      const conn: Connection = {
        id: connectionId,
        ws,
        userId: result.userId,
        stackId: result.stackId,
        spriteName: result.spriteName,
        spriteStatus: result.spriteStatus,
        connectedAt: Date.now(),
      }
      setConnection(connectionId, conn)

      // Send connected confirmation
      ws.send(createSystemMessage('connected', `Authenticated as ${result.userId}`, parsed.id))

      console.log(
        `[${connectionId}] Authenticated: user=${result.userId} stack=${result.stackId} sprite=${result.spriteName ?? 'none'}`,
      )

      // Establish Sprite connection if a sprite is assigned
      if (result.spriteName) {
        const token = process.env.SPRITES_TOKEN
        if (token) {
          try {
            await ensureSpriteConnection(result.stackId, result.spriteName, token)
            ws.send(createSystemMessage('sprite_ready', `Sprite ${result.spriteName} connected`, parsed.id))
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Sprite connection failed'
            console.error(`[${connectionId}] Sprite connection failed:`, msg)
            ws.send(createSystemMessage('error', `Sprite connection failed: ${msg}`, parsed.id))
          }
        }
      }
      return
    }

    // Authenticated connection — forward messages to Sprite
    const conn = getConnection(connectionId)
    if (!conn) {
      sendError(ws, 'Connection not found')
      return
    }

    if (!forwardToSprite(conn.stackId, raw)) {
      sendError(ws, 'Sprite not connected', parsed.request_id ?? parsed.id)
    }
  })
}

// =============================================================================
// HTTP Server + WebSocket Upgrade
// =============================================================================

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Health check endpoint for Fly.io
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

  // API proxy for Sprites (Anthropic, Mistral)
  if (req.url?.startsWith('/v1/proxy/')) {
    handleApiProxy(req, res)
    return
  }

  // All other HTTP requests get 426 Upgrade Required
  res.writeHead(426, { 'Content-Type': 'text/plain' })
  res.end('WebSocket connections only. Connect to /ws/{stack_id}')
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request: IncomingMessage, socket, head) => {
  // Extract stack_id from path: /ws/{stack_id}
  const url = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`)
  const match = url.pathname.match(/^\/ws\/([a-zA-Z0-9_-]+)$/)

  if (!match) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
    socket.destroy()
    return
  }

  const stackId = match[1]

  wss.handleUpgrade(request, socket, head, (ws) => {
    handleConnection(ws, stackId)
  })
})

// =============================================================================
// Server Startup
// =============================================================================

const PORT = parseInt(process.env.PORT ?? '8080', 10)

export function startServer(port: number = PORT): ReturnType<typeof server.listen> {
  return server.listen(port, () => {
    console.log(`Bridge listening on port ${port}`)
    console.log(`WebSocket endpoint: ws://localhost:${port}/ws/{stack_id}`)
  })
}

// Only auto-start when run directly (not imported in tests)
if (process.env.NODE_ENV !== 'test') {
  startServer()
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...')
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

// Export for testing
export { server, wss }
