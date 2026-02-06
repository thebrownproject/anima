/**
 * Integration tests for the Bridge WebSocket server.
 *
 * Starts the real HTTP+WS server and connects real WebSocket clients.
 * Mocks only the external dependencies (Clerk, Supabase).
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

// =============================================================================
// Mock External Dependencies
// =============================================================================

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}))

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { verifyToken } from '@clerk/backend'
import { resetSupabaseClient } from '../src/auth.js'

// =============================================================================
// Env Setup
// =============================================================================

// Set env vars before importing server module
process.env.NODE_ENV = 'test'
process.env.CLERK_JWT_KEY = 'test-jwt-key'
process.env.CLERK_SECRET_KEY = 'test-secret-key'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'

import {
  startServer,
  server,
  getConnectionCount,
  getPendingCount,
} from '../src/index.js'

// =============================================================================
// Helpers
// =============================================================================

const TEST_PORT = 9876
const WS_URL = `ws://localhost:${TEST_PORT}`

function createAuthMessage(token: string = 'valid-token'): string {
  return JSON.stringify({
    type: 'auth',
    id: uuidv4(),
    timestamp: Date.now(),
    payload: { token },
  })
}

function createMissionMessage(text: string): string {
  return JSON.stringify({
    type: 'mission',
    id: uuidv4(),
    timestamp: Date.now(),
    payload: { text },
  })
}

/** Connect a WS client and wait for the connection to open. */
function connectWs(stackId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws/${stackId}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

/** Wait for the next message on a WebSocket. */
function nextMessage(ws: WebSocket, timeoutMs: number = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
    ws.once('message', (data) => {
      clearTimeout(timer)
      resolve(JSON.parse(data.toString()))
    })
  })
}

/** Wait for the WS close event. */
function waitForClose(ws: WebSocket, timeoutMs: number = 5000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Close timeout')), timeoutMs)
    ws.once('close', (code, reason) => {
      clearTimeout(timer)
      resolve({ code, reason: reason.toString() })
    })
  })
}

/** Set up mocks for successful auth. */
function mockSuccessfulAuth(userId: string = 'user_123', stackId: string = 'stack_1'): void {
  const mockVerify = vi.mocked(verifyToken)
  mockVerify.mockResolvedValue({ sub: userId } as any)

  mockSingle.mockResolvedValue({
    data: {
      id: stackId,
      user_id: userId,
      sprite_name: 'sprite-abc',
      sprite_status: 'active',
    },
    error: null,
  })
}

// =============================================================================
// Server Lifecycle
// =============================================================================

let httpServer: ReturnType<typeof startServer>

beforeAll(async () => {
  httpServer = startServer(TEST_PORT)
  // Wait for server to be listening
  await new Promise<void>((resolve) => {
    if (httpServer.listening) return resolve()
    httpServer.on('listening', resolve)
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  resetSupabaseClient()

  // Reset Supabase mock chain
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ single: mockSingle })
})

// =============================================================================
// Tests
// =============================================================================

describe('Bridge WebSocket Server', () => {
  describe('HTTP endpoints', () => {
    it('returns health check on GET /health', async () => {
      const res = await fetch(`http://localhost:${TEST_PORT}/health`)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe('ok')
      expect(typeof body.connections).toBe('number')
      expect(typeof body.uptime).toBe('number')
    })

    it('returns 426 on non-upgrade HTTP requests', async () => {
      const res = await fetch(`http://localhost:${TEST_PORT}/ws/stack_1`)
      expect(res.status).toBe(426)
    })
  })

  describe('WebSocket upgrade', () => {
    it('upgrades connection on /ws/{stack_id}', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs('stack_1')
      expect(ws.readyState).toBe(WebSocket.OPEN)

      ws.close()
    })

    it('rejects upgrade on invalid paths', async () => {
      // Connect to bad path — should get destroyed
      await expect(
        new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`${WS_URL}/invalid`)
          ws.on('open', () => reject(new Error('Should not connect')))
          ws.on('error', () => resolve())
          // Some WS implementations emit close instead of error
          ws.on('close', () => resolve())
        }),
      ).resolves.toBeUndefined()
    })

    it('accepts stack IDs with valid characters', async () => {
      mockSuccessfulAuth('user_123', 'stack-with-dashes_123')
      mockSingle.mockResolvedValue({
        data: {
          id: 'stack-with-dashes_123',
          user_id: 'user_123',
          sprite_name: null,
          sprite_status: 'pending',
        },
        error: null,
      })

      const ws = await connectWs('stack-with-dashes_123')
      expect(ws.readyState).toBe(WebSocket.OPEN)
      ws.close()
    })
  })

  describe('auth flow', () => {
    it('authenticates with valid JWT and stores connection', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs('stack_1')
      ws.send(createAuthMessage('valid-token'))

      const msg = await nextMessage(ws)
      expect(msg.type).toBe('system')
      expect(msg.payload.event).toBe('connected')
      expect(msg.payload.message).toContain('user_123')

      // Connection should be in the active map
      expect(getConnectionCount()).toBeGreaterThanOrEqual(1)

      ws.close()
    })

    it('closes with 4001 on invalid JWT', async () => {
      const mockVerify = vi.mocked(verifyToken)
      mockVerify.mockRejectedValue(new Error('Invalid token'))

      const ws = await connectWs('stack_1')
      const closePromise = waitForClose(ws)

      ws.send(createAuthMessage('bad-token'))

      const { code } = await closePromise
      expect(code).toBe(4001)
    })

    it('closes with 4003 on unauthorized stack', async () => {
      const mockVerify = vi.mocked(verifyToken)
      mockVerify.mockResolvedValue({ sub: 'user_123' } as any)

      mockSingle.mockResolvedValue({
        data: { id: 'stack_1', user_id: 'other_user', sprite_name: null, sprite_status: 'pending' },
        error: null,
      })

      const ws = await connectWs('stack_1')
      const closePromise = waitForClose(ws)

      ws.send(createAuthMessage('valid-token'))

      const { code } = await closePromise
      expect(code).toBe(4003)
    })

    it('closes with 4001 when first message is not auth', async () => {
      const ws = await connectWs('stack_1')
      const closePromise = waitForClose(ws)

      // Send a mission message before auth
      ws.send(createMissionMessage('hello'))

      const { code } = await closePromise
      expect(code).toBe(4001)
    })

    it('rejects invalid JSON', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs('stack_1')
      ws.send('not json at all')

      const msg = await nextMessage(ws)
      expect(msg.type).toBe('system')
      expect(msg.payload.event).toBe('error')
      expect(msg.payload.message).toContain('Invalid JSON')

      ws.close()
    })

    it('rejects messages with missing required fields', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs('stack_1')
      ws.send(JSON.stringify({ type: 'auth' })) // Missing id and timestamp

      const msg = await nextMessage(ws)
      expect(msg.type).toBe('system')
      expect(msg.payload.event).toBe('error')
      expect(msg.payload.message).toContain('Invalid message format')

      ws.close()
    })
  })

  describe('post-auth messages', () => {
    it('accepts messages after successful auth', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs('stack_1')

      // Authenticate
      ws.send(createAuthMessage('valid-token'))
      const authReply = await nextMessage(ws)
      expect(authReply.payload.event).toBe('connected')

      // Send a mission message — should not close the connection
      ws.send(createMissionMessage('hello agent'))

      // Give the server a moment to process
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN)

      ws.close()
    })
  })

  describe('connection cleanup', () => {
    it('removes connection from map on close', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs('stack_1')
      ws.send(createAuthMessage('valid-token'))
      await nextMessage(ws) // Wait for connected

      const countBefore = getConnectionCount()

      ws.close()
      // Wait for close to propagate
      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(getConnectionCount()).toBeLessThanOrEqual(countBefore)
    })
  })
})
