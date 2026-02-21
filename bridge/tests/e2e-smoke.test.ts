/**
 * E2E Smoke Test: Full message flow validation.
 *
 * Tests the complete user journey: WS connect -> auth -> sprite_ready ->
 * send mission -> receive agent_event (text + complete) -> canvas_update.
 * Uses a mock Sprite that simulates realistic agent responses instead of
 * simple echo acks.
 *
 * Maps to task stackdocs-m7b.15.4 Tests checklist.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'

// -- Mocks (before imports that use them) --

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
import { resetKeepalives } from '../src/keepalive.js'
import { resetReconnectState } from '../src/reconnect.js'

// -- Ports (unique to avoid conflicts with other E2E test files) --

const MOCK_SPRITE_PORT = 19902
const BRIDGE_PORT = 9902
const BRIDGE_WS = `ws://localhost:${BRIDGE_PORT}`

// -- Mock Sprite: Simulates realistic agent behavior --

let mockSpriteServer: WebSocketServer

/**
 * Mock Sprite that simulates real agent behavior:
 * - TCP Proxy handshake (init message with host/port)
 * - state_sync after connect (empty workspace for new user)
 * - mission -> agent_event(text) + agent_event(complete)
 * - "create card" mission -> canvas_update(create_card) + agent_event(complete)
 */
function startMockSprite(): Promise<void> {
  return new Promise((resolve) => {
    mockSpriteServer = new WebSocketServer({ port: MOCK_SPRITE_PORT })

    mockSpriteServer.on('connection', (ws) => {
      let initDone = false

      ws.on('message', (raw) => {
        const data = raw.toString()

        // TCP Proxy init handshake
        if (!initDone) {
          try {
            const msg = JSON.parse(data)
            if (msg.host && msg.port) {
              initDone = true
              ws.send(JSON.stringify({ status: 'connected', target: `10.0.0.1:${msg.port}` }))

              // Send state_sync (empty workspace = new user, no demo data)
              setTimeout(() => {
                ws.send(JSON.stringify({
                  type: 'state_sync',
                  id: uuidv4(),
                  timestamp: Date.now(),
                  payload: {
                    stacks: [{ id: 'stack-default', name: 'My Workspace', color: '#3B82F6', sort_order: 0 }],
                    active_stack_id: 'stack-default',
                    cards: [],
                    chat_history: [],
                  },
                }) + '\n')
              }, 30)
            }
          } catch { /* ignore malformed init */ }
          return
        }

        // Handle messages after init
        try {
          const msg = JSON.parse(data)
          if (msg.type !== 'mission') return

          const text = msg.payload?.text ?? ''
          const stackId = msg.payload?.context?.stack_id ?? 'stack-default'

          // "create card" triggers canvas_update then complete
          if (text.toLowerCase().includes('create') && text.toLowerCase().includes('card')) {
            ws.send(JSON.stringify({
              type: 'canvas_update',
              id: uuidv4(),
              timestamp: Date.now(),
              request_id: msg.id,
              payload: {
                command: 'create_card',
                card_id: `card-${uuidv4().slice(0, 8)}`,
                stack_id: stackId,
                title: 'New Card',
                blocks: [{ id: 'b1', type: 'text', content: 'Created by agent' }],
              },
            }) + '\n')

            ws.send(JSON.stringify({
              type: 'agent_event',
              id: uuidv4(),
              timestamp: Date.now(),
              request_id: msg.id,
              payload: { event_type: 'complete', content: '' },
            }) + '\n')
            return
          }

          // Default: text response then complete (simulates agent chat)
          ws.send(JSON.stringify({
            type: 'agent_event',
            id: uuidv4(),
            timestamp: Date.now(),
            request_id: msg.id,
            payload: { event_type: 'text', content: `Hello! I received: "${text}"` },
          }) + '\n')

          ws.send(JSON.stringify({
            type: 'agent_event',
            id: uuidv4(),
            timestamp: Date.now(),
            request_id: msg.id,
            payload: { event_type: 'complete', content: '' },
          }) + '\n')
        } catch { /* ignore parse errors */ }
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

function uniqueUserId(): string {
  return `user-smoke-${++testCounter}`
}

function connectBrowser(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BRIDGE_WS}/ws`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function collectMessages(ws: WebSocket, count: number, timeoutMs: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const msgs: any[] = []
    const timer = setTimeout(() => reject(new Error(`Message timeout: got ${msgs.length}/${count}`)), timeoutMs)
    const handler = (data: any) => {
      msgs.push(JSON.parse(data.toString()))
      if (msgs.length >= count) {
        clearTimeout(timer)
        ws.off('message', handler)
        resolve(msgs)
      }
    }
    ws.on('message', handler)
  })
}

function nextMessage(ws: WebSocket, timeoutMs = 5000): Promise<any> {
  return collectMessages(ws, 1, timeoutMs).then((msgs) => msgs[0])
}

function createAuthMsg(token = 'valid-token'): string {
  return JSON.stringify({
    type: 'auth',
    id: uuidv4(),
    timestamp: Date.now(),
    payload: { token },
  })
}

function createMissionMsg(text: string, stackId?: string): { raw: string; id: string } {
  const id = uuidv4()
  return {
    id,
    raw: JSON.stringify({
      type: 'mission',
      id,
      timestamp: Date.now(),
      payload: {
        text,
        ...(stackId ? { context: { stack_id: stackId } } : {}),
      },
    }),
  }
}

function mockAuth(userId: string): void {
  vi.mocked(verifyToken).mockResolvedValue({ sub: userId } as any)
  mockSingle.mockResolvedValue({
    data: {
      id: userId,
      sprite_name: `sprite-${userId}`,
      sprite_status: 'active',
    },
    error: null,
  })
}

async function authenticateBrowser(ws: WebSocket): Promise<void> {
  ws.send(createAuthMsg())
  const messages = await collectMessages(ws, 2, 5000)
  const events = messages
    .filter((m: any) => m.type === 'system')
    .map((m: any) => m.payload.event)
  expect(events).toContain('connected')
  expect(events).toContain('sprite_ready')
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
  resetKeepalives()
  resetReconnectState()
  resetSpriteConnections()
  await new Promise((r) => setTimeout(r, 50))
  await stopMockSprite()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  vi.restoreAllMocks()
})

beforeEach(async () => {
  vi.mocked(verifyToken).mockReset()
  resetSupabaseClient()
  resetKeepalives()
  resetReconnectState()
  resetSpriteConnections()
  await new Promise((r) => setTimeout(r, 50))
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ single: mockSingle })
})

// -- Tests --

describe('E2E Smoke: Full message flow', () => {
  it('new user auth completes without errors (sign-up flow)', async () => {
    const userId = uniqueUserId()
    mockAuth(userId)

    const ws = await connectBrowser()
    expect(ws.readyState).toBe(WebSocket.OPEN)

    // Auth -> connected -> sprite_ready (no errors)
    await authenticateBrowser(ws)

    // Verify Clerk verifyToken was called
    expect(verifyToken).toHaveBeenCalled()

    ws.close()
  })

  it('agent responds to "hello" with agent_event within timeout', async () => {
    const userId = uniqueUserId()
    mockAuth(userId)

    const ws = await connectBrowser()
    await authenticateBrowser(ws)
    await nextMessage(ws) // consume state_sync

    const mission = createMissionMsg('hello')
    const start = performance.now()
    ws.send(mission.raw)

    // Expect agent_event(text) + agent_event(complete)
    const responses = await collectMessages(ws, 2, 10_000)
    const elapsed = performance.now() - start

    const textEvent = responses.find((m) => m.type === 'agent_event' && m.payload.event_type === 'text')
    const completeEvent = responses.find((m) => m.type === 'agent_event' && m.payload.event_type === 'complete')

    expect(textEvent).toBeDefined()
    expect(textEvent.payload.content).toContain('hello')
    expect(textEvent.request_id).toBe(mission.id)
    expect(completeEvent).toBeDefined()
    expect(completeEvent.request_id).toBe(mission.id)
    expect(elapsed).toBeLessThan(10_000)

    ws.close()
  })

  it('agent creates a Canvas card via tool call', async () => {
    const userId = uniqueUserId()
    mockAuth(userId)

    const ws = await connectBrowser()
    await authenticateBrowser(ws)
    await nextMessage(ws) // consume state_sync

    const mission = createMissionMsg('create a card for my invoices', 'stack-default')
    ws.send(mission.raw)

    // Expect canvas_update(create_card) + agent_event(complete)
    const responses = await collectMessages(ws, 2, 10_000)

    const canvasUpdate = responses.find((m) => m.type === 'canvas_update')
    expect(canvasUpdate).toBeDefined()
    expect(canvasUpdate.payload.command).toBe('create_card')
    expect(canvasUpdate.payload.card_id).toBeTruthy()
    expect(canvasUpdate.payload.stack_id).toBe('stack-default')
    expect(canvasUpdate.payload.title).toBeTruthy()
    expect(canvasUpdate.request_id).toBe(mission.id)

    const complete = responses.find((m) => m.type === 'agent_event' && m.payload.event_type === 'complete')
    expect(complete).toBeDefined()

    ws.close()
  })

  it('no hardcoded demo data in state_sync for new user', async () => {
    const userId = uniqueUserId()
    mockAuth(userId)

    const ws = await connectBrowser()
    await authenticateBrowser(ws)

    const stateSync = await nextMessage(ws)
    expect(stateSync.type).toBe('state_sync')

    // New user should have empty workspace (no pre-populated demo cards/chat)
    expect(stateSync.payload.cards).toHaveLength(0)
    expect(stateSync.payload.chat_history).toHaveLength(0)

    // Should have exactly one default stack, not demo stacks
    expect(stateSync.payload.stacks).toHaveLength(1)
    const stack = stateSync.payload.stacks[0]
    expect(stack.name).not.toContain('demo')
    expect(stack.name).not.toContain('Demo')
    expect(stack.name).not.toContain('sample')
    expect(stack.name).not.toContain('Sample')

    ws.close()
  })

  it('full round-trip: auth -> state_sync -> mission -> response -> canvas', async () => {
    const userId = uniqueUserId()
    mockAuth(userId)

    // 1. Connect and authenticate
    const ws = await connectBrowser()
    await authenticateBrowser(ws)

    // 2. Receive state_sync
    const stateSync = await nextMessage(ws)
    expect(stateSync.type).toBe('state_sync')

    // 3. Send a chat mission, get agent text response
    const chatMission = createMissionMsg('hello')
    ws.send(chatMission.raw)
    const chatResponses = await collectMessages(ws, 2, 10_000)
    expect(chatResponses.some((m) => m.type === 'agent_event' && m.payload.event_type === 'text')).toBe(true)
    expect(chatResponses.some((m) => m.type === 'agent_event' && m.payload.event_type === 'complete')).toBe(true)

    // 4. Send a card creation mission, get canvas_update
    const cardMission = createMissionMsg('create a card', 'stack-default')
    ws.send(cardMission.raw)
    const cardResponses = await collectMessages(ws, 2, 10_000)
    expect(cardResponses.some((m) => m.type === 'canvas_update' && m.payload.command === 'create_card')).toBe(true)
    expect(cardResponses.some((m) => m.type === 'agent_event' && m.payload.event_type === 'complete')).toBe(true)

    ws.close()
  })
})
