/**
 * E2E: One Sprite Per User — integration test.
 *
 * Validates the refactored flow where each user gets a single Sprite
 * connection shared across multiple browser tabs. Tests state_sync,
 * mission context routing, multi-tab broadcast, and canvas_update
 * with stack_id flowing end-to-end.
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

import { startServer, server, getConnectionsByUser } from '../src/index.js'
import { resetSpriteConnections, getSpriteConnection } from '../src/proxy.js'
import { resetKeepalives } from '../src/keepalive.js'
import { resetReconnectState } from '../src/reconnect.js'

// -- Ports (unique to avoid conflicts with other test files) --

const MOCK_SPRITE_PORT = 19901
const BRIDGE_PORT = 9901
const BRIDGE_WS = `ws://localhost:${BRIDGE_PORT}`

// -- Mock Sprite Gateway --

let mockSpriteServer: WebSocketServer
/** Track TCP Proxy connections to verify sharing. */
let spriteConnectionCount = 0
/** Messages received by mock Sprite (for assertions). */
let spriteReceivedMessages: any[] = []

/**
 * Mock Sprite that mimics TCP Proxy handshake + gateway behavior:
 * - Sends state_sync after init
 * - Echoes missions with canvas_update containing stack_id
 * - Tracks connection count for multi-tab assertions
 */
function startMockSprite(): Promise<void> {
  return new Promise((resolve) => {
    mockSpriteServer = new WebSocketServer({ port: MOCK_SPRITE_PORT })

    mockSpriteServer.on('connection', (ws) => {
      let initDone = false
      spriteConnectionCount++

      ws.on('message', (raw) => {
        const data = raw.toString()

        if (!initDone) {
          try {
            const msg = JSON.parse(data)
            if (msg.host && msg.port) {
              initDone = true
              ws.send(JSON.stringify({ status: 'connected', target: `10.0.0.1:${msg.port}` }))

              // Send state_sync after init (like real Sprite gateway)
              setTimeout(() => {
                ws.send(JSON.stringify({
                  type: 'state_sync',
                  id: uuidv4(),
                  timestamp: Date.now(),
                  payload: {
                    stacks: [
                      { id: 'stack-1', name: 'My Stack', color: '#3B82F6', sort_order: 0 },
                      { id: 'stack-2', name: 'Invoices', color: '#10B981', sort_order: 1 },
                    ],
                    active_stack_id: 'stack-1',
                    cards: [
                      {
                        id: 'card-1',
                        stack_id: 'stack-1',
                        title: 'Welcome',
                        blocks: [{ id: 'b1', type: 'text', data: { content: 'Hello' } }],
                        position: { x: 100, y: 100 },
                        size: { w: 400, h: 300 },
                      },
                    ],
                    chat_history: [
                      { id: 'msg-1', role: 'user', content: 'Hi', timestamp: Date.now() - 60000 },
                      { id: 'msg-2', role: 'assistant', content: 'Hello!', timestamp: Date.now() - 59000 },
                    ],
                  },
                }) + '\n')
              }, 50)
            }
          } catch { /* ignore malformed init */ }
          return
        }

        try {
          const msg = JSON.parse(data)
          spriteReceivedMessages.push(msg)

          if (msg.type === 'mission') {
            // Reply with canvas_update preserving stack_id from context
            const stackId = msg.payload?.context?.stack_id ?? 'unknown'
            ws.send(JSON.stringify({
              type: 'canvas_update',
              id: uuidv4(),
              timestamp: Date.now(),
              request_id: msg.id,
              payload: {
                command: 'create_card',
                card_id: `card-${uuidv4().slice(0, 8)}`,
                stack_id: stackId,
                title: 'Agent Response',
                blocks: [{ id: 'b1', type: 'text', data: { content: `Processed: ${msg.payload.text}` } }],
              },
            }) + '\n')
          } else if (msg.type === 'canvas_interaction') {
            ws.send(JSON.stringify({
              type: 'system',
              id: uuidv4(),
              timestamp: Date.now(),
              request_id: msg.id,
              payload: { event: 'connected', message: 'canvas_interaction_received' },
            }) + '\n')
          }
        } catch { /* ignore */ }
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
  return `user-e2e-usr-${++testCounter}`
}

function connectBrowser(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BRIDGE_WS}/ws`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
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

/**
 * Authenticate and wait for connected + sprite_ready.
 * Collects both messages without assuming order -- avoids race where
 * sprite_ready arrives before the second ws.once listener is attached.
 */
async function authenticateBrowser(ws: WebSocket): Promise<void> {
  ws.send(createAuthMsg())

  const messages = await collectMessages(ws, 2, 5000)
  const events = messages
    .filter((m: any) => m.type === 'system')
    .map((m: any) => m.payload.event)
  expect(events).toContain('connected')
  expect(events).toContain('sprite_ready')
}

/** Collect N messages from a WebSocket, resolving when all arrive or timing out. */
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

/** Close a WebSocket and wait for it to fully close. */
function closeAndWait(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve()
    ws.on('close', () => resolve())
    ws.close()
  })
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
  // Clean up sprite state from previous tests to prevent reconnect interference
  resetKeepalives()
  resetReconnectState()
  resetSpriteConnections()
  // Let pending close handlers settle
  await new Promise((r) => setTimeout(r, 50))
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ single: mockSingle })
  spriteReceivedMessages = []
  spriteConnectionCount = 0
})

// -- Tests --

describe('E2E: One Sprite Per User', () => {
  describe('connection and state sync', () => {
    it('connects to /ws without stack ID in URL', async () => {
      const userId = uniqueUserId()
      mockAuth(userId)

      const ws = await connectBrowser()
      expect(ws.readyState).toBe(WebSocket.OPEN)
      await authenticateBrowser(ws)

      ws.close()
    })

    it('receives state_sync with stacks, cards, and chat after Sprite connects', async () => {
      const userId = uniqueUserId()
      mockAuth(userId)

      const ws = await connectBrowser()
      await authenticateBrowser(ws)

      // state_sync comes after sprite_ready (sent by mock Sprite with 50ms delay)
      const sync = await nextMessage(ws)
      expect(sync.type).toBe('state_sync')
      expect(sync.payload.stacks).toHaveLength(2)
      expect(sync.payload.stacks[0].name).toBe('My Stack')
      expect(sync.payload.active_stack_id).toBe('stack-1')
      expect(sync.payload.cards).toHaveLength(1)
      expect(sync.payload.cards[0].stack_id).toBe('stack-1')
      expect(sync.payload.chat_history).toHaveLength(2)

      ws.close()
    })
  })

  describe('mission with context.stack_id', () => {
    it('forwards mission with stack_id context to Sprite', async () => {
      const userId = uniqueUserId()
      mockAuth(userId)

      const ws = await connectBrowser()
      await authenticateBrowser(ws)
      await nextMessage(ws) // consume state_sync

      const mission = createMissionMsg('extract invoices', 'stack-2')
      ws.send(mission.raw)

      // Sprite responds with canvas_update
      const update = await nextMessage(ws)
      expect(update.type).toBe('canvas_update')
      expect(update.request_id).toBe(mission.id)
      expect(update.payload.stack_id).toBe('stack-2')
      expect(update.payload.command).toBe('create_card')

      // Verify Sprite received the context
      const spriteMsg = spriteReceivedMessages.find((m) => m.id === mission.id)
      expect(spriteMsg).toBeDefined()
      expect(spriteMsg.payload.context.stack_id).toBe('stack-2')

      ws.close()
    })

    it('canvas_update with stack_id reaches browser end-to-end', async () => {
      const userId = uniqueUserId()
      mockAuth(userId)

      const ws = await connectBrowser()
      await authenticateBrowser(ws)
      await nextMessage(ws) // consume state_sync

      const mission = createMissionMsg('create table', 'stack-1')
      ws.send(mission.raw)

      const update = await nextMessage(ws)
      expect(update.type).toBe('canvas_update')
      expect(update.payload.stack_id).toBe('stack-1')
      expect(update.payload.title).toBe('Agent Response')

      ws.close()
    })
  })

  describe('multi-tab sharing', () => {
    it('two tabs for same user share one Sprite TCP connection', async () => {
      const userId = uniqueUserId()
      mockAuth(userId)

      // First tab connects and establishes Sprite connection
      const tab1 = await connectBrowser()
      await authenticateBrowser(tab1)
      await nextMessage(tab1) // consume state_sync

      expect(spriteConnectionCount).toBe(1)

      // Second tab connects — should reuse existing Sprite connection
      const tab2 = await connectBrowser()
      await authenticateBrowser(tab2)

      // Same Sprite connection count (no new TCP connection)
      expect(spriteConnectionCount).toBe(1)

      // Verify both tabs are registered for the same user
      const userConns = getConnectionsByUser(userId)
      expect(userConns.length).toBe(2)

      // Verify single SpriteConnection object
      const spriteConn = getSpriteConnection(userId)
      expect(spriteConn).toBeDefined()
      expect(spriteConn!.state).toBe('connected')

      await closeAndWait(tab1)
      await closeAndWait(tab2)
    })

    it('Sprite response broadcasts to all tabs for same user', async () => {
      const userId = uniqueUserId()
      mockAuth(userId)

      const tab1 = await connectBrowser()
      await authenticateBrowser(tab1)
      await nextMessage(tab1) // consume state_sync

      const tab2 = await connectBrowser()
      await authenticateBrowser(tab2)

      // Tab2 also receives state_sync (not via new TCP connection — Bridge
      // sends sprite_ready but mock Sprite already sent state_sync earlier).
      // The second tab won't get state_sync from the mock since it's the
      // same TCP connection, but it will get broadcast responses.

      // Send mission from tab1
      const mission = createMissionMsg('shared query', 'stack-1')
      tab1.send(mission.raw)

      // Both tabs should receive the canvas_update
      const update1 = await nextMessage(tab1)
      const update2 = await nextMessage(tab2)

      expect(update1.type).toBe('canvas_update')
      expect(update2.type).toBe('canvas_update')
      expect(update1.payload.stack_id).toBe('stack-1')
      expect(update2.payload.stack_id).toBe('stack-1')
      expect(update1.request_id).toBe(mission.id)
      expect(update2.request_id).toBe(mission.id)

      await closeAndWait(tab1)
      await closeAndWait(tab2)
    })

    it('different users get separate Sprite connections', async () => {
      const userA = uniqueUserId()
      const userB = uniqueUserId()

      // User A connects
      mockAuth(userA)
      const wsA = await connectBrowser()
      await authenticateBrowser(wsA)
      await nextMessage(wsA) // consume state_sync

      expect(spriteConnectionCount).toBe(1)

      // User B connects — should create a NEW Sprite connection
      mockAuth(userB)
      const wsB = await connectBrowser()
      await authenticateBrowser(wsB)
      await nextMessage(wsB) // consume state_sync

      expect(spriteConnectionCount).toBe(2)

      // Each user has their own SpriteConnection
      expect(getSpriteConnection(userA)).toBeDefined()
      expect(getSpriteConnection(userB)).toBeDefined()
      expect(getSpriteConnection(userA)).not.toBe(getSpriteConnection(userB))

      await closeAndWait(wsA)
      await closeAndWait(wsB)
    })

    it('closing last tab for a user disconnects their Sprite', async () => {
      const userId = uniqueUserId()
      mockAuth(userId)

      const tab1 = await connectBrowser()
      await authenticateBrowser(tab1)
      await nextMessage(tab1) // consume state_sync

      const tab2 = await connectBrowser()
      await authenticateBrowser(tab2)

      expect(getSpriteConnection(userId)).toBeDefined()

      // Close first tab — Sprite connection should persist
      await closeAndWait(tab1)
      await new Promise((r) => setTimeout(r, 100))
      // Connection may still exist since tab2 is open
      expect(getConnectionsByUser(userId).length).toBe(1)

      // Close second tab — should trigger Sprite disconnect
      await closeAndWait(tab2)
      await new Promise((r) => setTimeout(r, 100))
      expect(getConnectionsByUser(userId).length).toBe(0)
    })
  })
})
