/**
 * E2E smoke test: Browser -> Bridge -> mock Sprite -> Bridge -> Browser.
 *
 * Starts a real Bridge server and a mock Sprite WS server that mimics
 * the TCP Proxy handshake + gateway echo behavior. Validates the full
 * message round-trip for mission messages, multiple message types, and
 * error handling for unknown types.
 *
 * Each test uses a unique stack ID to avoid reconnect interference.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'

// -- Mocks (must be before imports that use them) --

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

vi.mock('../src/updater.js', () => ({
  checkAndUpdate: vi.fn().mockResolvedValue(false),
}))

import { verifyToken } from '@clerk/backend'
import { resetSupabaseClient } from '../src/auth.js'

// -- Env --

process.env.NODE_ENV = 'test'
process.env.CLERK_JWT_KEY = 'test-jwt-key'
process.env.CLERK_SECRET_KEY = 'test-secret-key'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
process.env.SPRITES_TOKEN = 'test-sprites-token'

import { startServer, server } from '../src/index.js'
import { resetSpriteConnections } from '../src/proxy.js'

// -- Ports --

const MOCK_SPRITE_PORT = 19900
const BRIDGE_PORT = 9900
const BRIDGE_WS = `ws://localhost:${BRIDGE_PORT}`

// -- Mock Sprite Gateway --

let mockSpriteServer: WebSocketServer

/**
 * Mock Sprite behind a TCP Proxy facade.
 * Handles init handshake, then mimics gateway echo:
 * - known types (mission, file_upload, canvas_interaction) -> ack with request_id
 * - unknown type -> error response
 */
function startMockSprite(): Promise<void> {
  return new Promise((resolve) => {
    mockSpriteServer = new WebSocketServer({ port: MOCK_SPRITE_PORT })

    mockSpriteServer.on('connection', (ws) => {
      let initDone = false

      ws.on('message', (raw) => {
        const data = raw.toString()

        if (!initDone) {
          try {
            const msg = JSON.parse(data)
            if (msg.host && msg.port) {
              initDone = true
              ws.send(JSON.stringify({ status: 'connected', target: `10.0.0.1:${msg.port}` }))
            }
          } catch { /* ignore malformed init */ }
          return
        }

        try {
          const msg = JSON.parse(data)
          const knownTypes = ['mission', 'file_upload', 'canvas_interaction']

          if (knownTypes.includes(msg.type)) {
            ws.send(JSON.stringify({
              type: 'system',
              id: uuidv4(),
              timestamp: Date.now(),
              payload: { event: 'connected', message: `${msg.type}_received` },
              request_id: msg.id,
            }))
          } else {
            ws.send(JSON.stringify({
              type: 'system',
              id: uuidv4(),
              timestamp: Date.now(),
              payload: { event: 'error', message: `unknown message type: ${msg.type}` },
            }))
          }
        } catch {
          ws.send(JSON.stringify({
            type: 'system',
            id: uuidv4(),
            timestamp: Date.now(),
            payload: { event: 'error', message: 'invalid JSON from browser' },
          }))
        }
      })
    })

    mockSpriteServer.on('listening', () => resolve())
  })
}

function stopMockSprite(): Promise<void> {
  return new Promise((resolve) => {
    for (const client of mockSpriteServer.clients) {
      if (client.readyState === WebSocket.OPEN) client.close()
    }
    mockSpriteServer.close(() => resolve())
  })
}

// -- Helpers --

let testCounter = 0

/** Generate a unique stack ID per test to prevent reconnect interference. */
function uniqueStackId(): string {
  return `stack-e2e-${++testCounter}`
}

function connectBrowser(stackId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BRIDGE_WS}/ws/${stackId}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function nextMessage(ws: WebSocket, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
    ws.once('message', (data) => {
      clearTimeout(timer)
      resolve(JSON.parse(data.toString()))
    })
  })
}

function createAuthMsg(token = 'valid-token'): string {
  return JSON.stringify({
    type: 'auth',
    id: uuidv4(),
    timestamp: Date.now(),
    payload: { token },
  })
}

function createMissionMsg(text: string): { raw: string; id: string } {
  const id = uuidv4()
  return {
    id,
    raw: JSON.stringify({ type: 'mission', id, timestamp: Date.now(), payload: { text } }),
  }
}

function createCanvasInteractionMsg(): { raw: string; id: string } {
  const id = uuidv4()
  return {
    id,
    raw: JSON.stringify({
      type: 'canvas_interaction',
      id,
      timestamp: Date.now(),
      payload: { card_id: 'card-1', action: 'edit_cell', data: { row: 0, col: 1, value: 'test' } },
    }),
  }
}

function mockAuth(stackId: string, userId = 'user_e2e'): void {
  vi.mocked(verifyToken).mockResolvedValue({ sub: userId } as any)
  mockSingle.mockResolvedValue({
    data: {
      id: stackId,
      user_id: userId,
      sprite_name: `sprite-${stackId}`,
      sprite_status: 'active',
    },
    error: null,
  })
}

/** Authenticate and wait for connected + sprite_ready. */
async function authenticateBrowser(ws: WebSocket): Promise<void> {
  ws.send(createAuthMsg())

  const msg1 = await nextMessage(ws)
  expect(msg1.type).toBe('system')
  expect(msg1.payload.event).toBe('connected')

  const msg2 = await nextMessage(ws)
  expect(msg2.type).toBe('system')
  expect(msg2.payload.event).toBe('sprite_ready')
}

// -- Lifecycle --

let httpServer: ReturnType<typeof startServer>

beforeAll(async () => {
  vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
    .mockReturnValue(`ws://localhost:${MOCK_SPRITE_PORT}`)

  await startMockSprite()

  httpServer = startServer(BRIDGE_PORT)
  await new Promise<void>((resolve) => {
    if (httpServer.listening) return resolve()
    httpServer.on('listening', resolve)
  })
})

afterAll(async () => {
  resetSpriteConnections()
  await new Promise((r) => setTimeout(r, 50))
  await stopMockSprite()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.mocked(verifyToken).mockReset()
  resetSupabaseClient()
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ single: mockSingle })
})

// -- Tests --

describe('E2E: Browser -> Bridge -> Sprite round-trip', () => {
  it('sends mission message and receives echo ack from Sprite', async () => {
    const stackId = uniqueStackId()
    mockAuth(stackId)
    const ws = await connectBrowser(stackId)
    await authenticateBrowser(ws)

    const mission = createMissionMsg('hello agent')
    ws.send(mission.raw)

    const ack = await nextMessage(ws)
    expect(ack.type).toBe('system')
    expect(ack.payload.message).toBe('mission_received')
    expect(ack.request_id).toBe(mission.id)

    ws.close()
  })

  it('sends canvas_interaction and receives echo ack', async () => {
    const stackId = uniqueStackId()
    mockAuth(stackId)
    const ws = await connectBrowser(stackId)
    await authenticateBrowser(ws)

    const interaction = createCanvasInteractionMsg()
    ws.send(interaction.raw)

    const ack = await nextMessage(ws)
    expect(ack.type).toBe('system')
    expect(ack.payload.message).toBe('canvas_interaction_received')
    expect(ack.request_id).toBe(interaction.id)

    ws.close()
  })

  it('receives error for unknown message type from Sprite', async () => {
    const stackId = uniqueStackId()
    mockAuth(stackId)
    const ws = await connectBrowser(stackId)
    await authenticateBrowser(ws)

    const unknownMsg = JSON.stringify({
      type: 'bogus_type',
      id: uuidv4(),
      timestamp: Date.now(),
      payload: { foo: 'bar' },
    })
    ws.send(unknownMsg)

    const response = await nextMessage(ws)
    expect(response.type).toBe('system')
    expect(response.payload.message).toContain('unknown message type: bogus_type')

    ws.close()
  })

  it('round-trip latency is under 500ms', async () => {
    const stackId = uniqueStackId()
    mockAuth(stackId)
    const ws = await connectBrowser(stackId)
    await authenticateBrowser(ws)

    const mission = createMissionMsg('latency test')
    const start = performance.now()
    ws.send(mission.raw)

    const ack = await nextMessage(ws)
    const elapsed = performance.now() - start

    expect(ack.request_id).toBe(mission.id)
    expect(elapsed).toBeLessThan(500)

    ws.close()
  })

  it('handles multiple sequential messages correctly', async () => {
    const stackId = uniqueStackId()
    mockAuth(stackId)
    const ws = await connectBrowser(stackId)
    await authenticateBrowser(ws)

    const m1 = createMissionMsg('first')
    const m2 = createMissionMsg('second')
    const m3 = createCanvasInteractionMsg()

    ws.send(m1.raw)
    const ack1 = await nextMessage(ws)
    expect(ack1.request_id).toBe(m1.id)
    expect(ack1.payload.message).toBe('mission_received')

    ws.send(m2.raw)
    const ack2 = await nextMessage(ws)
    expect(ack2.request_id).toBe(m2.id)
    expect(ack2.payload.message).toBe('mission_received')

    ws.send(m3.raw)
    const ack3 = await nextMessage(ws)
    expect(ack3.request_id).toBe(m3.id)
    expect(ack3.payload.message).toBe('canvas_interaction_received')

    ws.close()
  })
})
