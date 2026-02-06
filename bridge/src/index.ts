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
import {
  isAuthConnect,
  isWebSocketMessage,
  type SystemMessage,
} from './protocol.js'

// =============================================================================
// Types
// =============================================================================

export interface Connection {
  id: string
  ws: WebSocket
  userId: string
  stackId: string
  spriteName: string | null
  spriteStatus: string
  connectedAt: number
}

// =============================================================================
// Connection Store
// =============================================================================

/** Active authenticated connections indexed by connection ID. */
const connections = new Map<string, Connection>()

/** Pending connections awaiting auth (timeout after AUTH_TIMEOUT_MS). */
const pendingAuth = new Map<string, { ws: WebSocket; stackId: string; timer: ReturnType<typeof setTimeout> }>()

/** How long a client has to send an auth message after connecting. */
const AUTH_TIMEOUT_MS = 10_000

// =============================================================================
// Public Accessors (for testing and future modules)
// =============================================================================

export function getConnection(id: string): Connection | undefined {
  return connections.get(id)
}

export function getConnectionsByStack(stackId: string): Connection[] {
  const result: Connection[] = []
  for (const conn of connections.values()) {
    if (conn.stackId === stackId) result.push(conn)
  }
  return result
}

export function getConnectionCount(): number {
  return connections.size
}

export function getPendingCount(): number {
  return pendingAuth.size
}

/** Remove a connection and clean up. */
function removeConnection(connectionId: string): void {
  connections.delete(connectionId)
}

/** Remove a pending auth entry and clean up timer. */
function removePending(connectionId: string): void {
  const pending = pendingAuth.get(connectionId)
  if (pending) {
    clearTimeout(pending.timer)
    pendingAuth.delete(connectionId)
  }
}

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
    pendingAuth.delete(connectionId)
  }, AUTH_TIMEOUT_MS)

  pendingAuth.set(connectionId, { ws, stackId, timer })

  ws.on('error', (err) => {
    console.error(`[${connectionId}] WebSocket error:`, err.message)
  })

  ws.on('close', () => {
    removePending(connectionId)
    removeConnection(connectionId)
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
    if (pendingAuth.has(connectionId)) {
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
      connections.set(connectionId, conn)

      // Send connected confirmation
      ws.send(createSystemMessage('connected', `Authenticated as ${result.userId}`, parsed.id))

      console.log(
        `[${connectionId}] Authenticated: user=${result.userId} stack=${result.stackId} sprite=${result.spriteName ?? 'none'}`,
      )
      return
    }

    // Authenticated connection — forward messages to Sprite (added in task 2.6)
    // For now, acknowledge receipt
    const conn = connections.get(connectionId)
    if (!conn) {
      sendError(ws, 'Connection not found')
      return
    }

    // TODO (task 2.6): Forward message to Sprite via TCP Proxy
    console.log(`[${connectionId}] Message from user=${conn.userId}: type=${parsed.type}`)
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
      connections: connections.size,
      pending: pendingAuth.size,
      uptime: process.uptime(),
    }))
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
  // Close all WebSocket connections
  for (const conn of connections.values()) {
    conn.ws.close(1001, 'Server shutting down')
  }
  for (const pending of pendingAuth.values()) {
    pending.ws.close(1001, 'Server shutting down')
  }
  server.close(() => {
    console.log('Bridge shut down')
    process.exit(0)
  })
})

// Export for testing
export { server, wss }
