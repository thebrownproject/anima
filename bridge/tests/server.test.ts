/**
 * Integration tests for the Bridge WebSocket server.
 *
 * Starts the real HTTP+WS server and connects real WebSocket clients.
 * Mocks only the external dependencies (Clerk, Supabase).
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

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

function connectWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function nextMessage(ws: WebSocket, timeoutMs: number = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
    ws.once('message', (data) => {
      clearTimeout(timer)
      resolve(JSON.parse(data.toString()))
    })
  })
}

function waitForClose(ws: WebSocket, timeoutMs: number = 5000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Close timeout')), timeoutMs)
    ws.once('close', (code, reason) => {
      clearTimeout(timer)
      resolve({ code, reason: reason.toString() })
    })
  })
}

/** Mock successful auth — queries users table for sprite mapping. */
function mockSuccessfulAuth(userId: string = 'user_123'): void {
  const mockVerify = vi.mocked(verifyToken)
  mockVerify.mockResolvedValue({ sub: userId } as any)

  mockSingle.mockResolvedValue({
    data: {
      id: userId,
      sprite_name: 'sprite-abc',
      sprite_status: 'active',
    },
    error: null,
  })
}

let httpServer: ReturnType<typeof startServer>

beforeAll(async () => {
  httpServer = startServer(TEST_PORT)
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

  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ single: mockSingle })
})

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
      const res = await fetch(`http://localhost:${TEST_PORT}/ws`)
      expect(res.status).toBe(426)
    })
  })

  describe('WebSocket upgrade', () => {
    it('upgrades connection on /ws', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs()
      expect(ws.readyState).toBe(WebSocket.OPEN)

      ws.close()
    })

    it('rejects upgrade on /ws/{anything}', async () => {
      await expect(
        new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`${WS_URL}/ws/stack_1`)
          ws.on('open', () => reject(new Error('Should not connect')))
          ws.on('error', () => resolve())
          ws.on('close', () => resolve())
        }),
      ).resolves.toBeUndefined()
    })

    it('rejects upgrade on invalid paths', async () => {
      await expect(
        new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`${WS_URL}/invalid`)
          ws.on('open', () => reject(new Error('Should not connect')))
          ws.on('error', () => resolve())
          ws.on('close', () => resolve())
        }),
      ).resolves.toBeUndefined()
    })
  })

  describe('auth flow', () => {
    it('authenticates with valid JWT and stores connection', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs()
      ws.send(createAuthMessage('valid-token'))

      const msg = await nextMessage(ws)
      expect(msg.type).toBe('system')
      expect(msg.payload.event).toBe('connected')
      expect(msg.payload.message).toContain('user_123')

      expect(getConnectionCount()).toBeGreaterThanOrEqual(1)

      ws.close()
    })

    it('closes with 4001 on invalid JWT', async () => {
      const mockVerify = vi.mocked(verifyToken)
      mockVerify.mockRejectedValue(new Error('Invalid token'))

      const ws = await connectWs()
      const closePromise = waitForClose(ws)

      ws.send(createAuthMessage('bad-token'))

      const { code } = await closePromise
      expect(code).toBe(4001)
    })

    it('closes with 4003 when user not found', async () => {
      const mockVerify = vi.mocked(verifyToken)
      mockVerify.mockResolvedValue({ sub: 'user_123' } as any)

      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

      const ws = await connectWs()
      const closePromise = waitForClose(ws)

      ws.send(createAuthMessage('valid-token'))

      const { code } = await closePromise
      expect(code).toBe(4003)
    })

    it('closes with 4001 when first message is not auth', async () => {
      const ws = await connectWs()
      const closePromise = waitForClose(ws)

      ws.send(createMissionMessage('hello'))

      const { code } = await closePromise
      expect(code).toBe(4001)
    })

    it('rejects invalid JSON', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs()
      ws.send('not json at all')

      const msg = await nextMessage(ws)
      expect(msg.type).toBe('system')
      expect(msg.payload.event).toBe('error')
      expect(msg.payload.message).toContain('Invalid JSON')

      ws.close()
    })

    it('rejects messages with missing required fields', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs()
      ws.send(JSON.stringify({ type: 'auth' }))

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

      const ws = await connectWs()

      ws.send(createAuthMessage('valid-token'))
      const authReply = await nextMessage(ws)
      expect(authReply.payload.event).toBe('connected')

      ws.send(createMissionMessage('hello agent'))

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(ws.readyState).toBe(WebSocket.OPEN)

      ws.close()
    })
  })

  describe('connection cleanup', () => {
    it('removes connection from map on close', async () => {
      mockSuccessfulAuth()

      const ws = await connectWs()
      ws.send(createAuthMessage('valid-token'))
      await nextMessage(ws)

      const countBefore = getConnectionCount()

      ws.close()
      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(getConnectionCount()).toBeLessThanOrEqual(countBefore)
    })
  })
})
