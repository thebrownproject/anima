/**
 * Tests for Bridge TCP Proxy and message forwarding.
 *
 * Uses a mock Sprite WS server to test the full flow:
 * browser -> Bridge -> mock Sprite -> Bridge -> browser
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { SpriteConnection } from '../src/sprite-connection.js'

// -- Mock Sprite WS Server --

let mockSpriteServer: WebSocketServer
let mockSpritePort: number
let mockSpriteClients: WebSocket[]

function startMockSpriteProxy(port: number): Promise<void> {
  return new Promise((resolve) => {
    mockSpriteClients = []
    mockSpriteServer = new WebSocketServer({ port })

    mockSpriteServer.on('connection', (ws) => {
      let initDone = false

      ws.on('message', (raw) => {
        const data = raw.toString()

        // Handle init handshake
        if (!initDone) {
          const msg = JSON.parse(data)
          if (msg.host && msg.port) {
            initDone = true
            ws.send(JSON.stringify({ status: 'connected', target: `10.0.0.1:${msg.port}` }))
            mockSpriteClients.push(ws)
          }
          return
        }

        // After init: echo back to test bidirectional forwarding
        // Tests can override this by replacing the message handler
      })
    })

    mockSpriteServer.on('listening', () => resolve())
  })
}

function stopMockSpriteProxy(): Promise<void> {
  return new Promise((resolve) => {
    for (const client of mockSpriteClients) {
      if (client.readyState === WebSocket.OPEN) client.close()
    }
    mockSpriteServer.close(() => resolve())
  })
}

// -- Helpers --

function nextMessage(ws: WebSocket, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
    ws.once('message', (data) => {
      clearTimeout(timer)
      resolve(data.toString())
    })
  })
}

function waitForClose(ws: WebSocket, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Close timeout')), timeoutMs)
    ws.once('close', (code) => {
      clearTimeout(timer)
      resolve(code)
    })
  })
}

// -- Tests --

describe('SpriteConnection', () => {
  beforeAll(async () => {
    mockSpritePort = 19876
    await startMockSpriteProxy(mockSpritePort)
  })

  afterAll(async () => {
    await stopMockSpriteProxy()
  })

  it('completes TCP Proxy init handshake', async () => {
    const onMessage = vi.fn()
    const onClose = vi.fn()

    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      targetPort: 8765,
      onMessage,
      onClose,
    })

    // Override buildProxyUrl to point at our mock server
    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockSpritePort}`)

    await conn.connect()
    expect(conn.state).toBe('connected')

    conn.close()
    vi.restoreAllMocks()
  })

  it('forwards messages from Sprite to onMessage callback', async () => {
    const messages: string[] = []
    const onClose = vi.fn()

    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockSpritePort}`)

    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      onMessage: (data) => messages.push(data),
      onClose,
    })

    await conn.connect()

    // Send a message from mock Sprite to Bridge
    const spriteWs = mockSpriteClients[mockSpriteClients.length - 1]
    const testMsg = JSON.stringify({ type: 'agent_event', id: uuidv4(), timestamp: Date.now(), payload: { event_type: 'text', content: 'hello' } })
    spriteWs.send(testMsg)

    // Wait for callback
    await new Promise((r) => setTimeout(r, 100))
    expect(messages).toContain(testMsg)

    conn.close()
    vi.restoreAllMocks()
  })

  it('sends messages to Sprite via send()', async () => {
    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockSpritePort}`)

    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      onMessage: vi.fn(),
      onClose: vi.fn(),
    })

    await conn.connect()

    // Listen on mock Sprite for the message
    const spriteWs = mockSpriteClients[mockSpriteClients.length - 1]
    const msgPromise = nextMessage(spriteWs)

    const testMsg = JSON.stringify({ type: 'mission', id: uuidv4(), timestamp: Date.now(), payload: { text: 'do stuff' } })
    const sent = conn.send(testMsg)
    expect(sent).toBe(true)

    const received = await msgPromise
    expect(received).toBe(testMsg + '\n')

    conn.close()
    vi.restoreAllMocks()
  })

  it('returns false from send() when not connected', () => {
    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      onMessage: vi.fn(),
      onClose: vi.fn(),
    })

    // Never called connect()
    expect(conn.send('anything')).toBe(false)
  })

  it('calls onClose when Sprite closes connection', async () => {
    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockSpritePort}`)

    const onClose = vi.fn()
    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      onMessage: vi.fn(),
      onClose,
    })

    await conn.connect()

    // Close from Sprite side
    const spriteWs = mockSpriteClients[mockSpriteClients.length - 1]
    spriteWs.close(1000, 'done')

    await new Promise((r) => setTimeout(r, 200))
    expect(onClose).toHaveBeenCalled()
    expect(conn.state).toBe('closed')

    vi.restoreAllMocks()
  })
})

describe('proxy module', () => {
  let proxyModule: typeof import('../src/proxy.js')

  beforeAll(async () => {
    mockSpritePort = 19877
    await startMockSpriteProxy(mockSpritePort)
  })

  afterAll(async () => {
    await stopMockSpriteProxy()
  })

  beforeEach(async () => {
    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockSpritePort}`)

    proxyModule = await import('../src/proxy.js')
  })

  afterEach(() => {
    proxyModule.resetSpriteConnections()
    vi.restoreAllMocks()
  })

  it('tracks stack_id to active Sprite connection', async () => {
    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')

    const conn = proxyModule.getSpriteConnection('stack-1')
    expect(conn).toBeDefined()
    expect(conn!.spriteName).toBe('sprite-a')
    expect(conn!.state).toBe('connected')
  })

  it('reuses existing connection for same stack', async () => {
    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')
    const first = proxyModule.getSpriteConnection('stack-1')

    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')
    const second = proxyModule.getSpriteConnection('stack-1')

    // Same object reference
    expect(second).toBe(first)
  })

  it('forwards messages from browser to Sprite via forwardToSprite', async () => {
    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')

    const spriteWs = mockSpriteClients[mockSpriteClients.length - 1]
    const msgPromise = nextMessage(spriteWs)

    const testMsg = JSON.stringify({ type: 'mission', id: uuidv4(), timestamp: Date.now(), payload: { text: 'hello' } })
    const sent = proxyModule.forwardToSprite('stack-1', testMsg)
    expect(sent).toBe(true)

    const received = await msgPromise
    expect(received).toBe(testMsg + '\n')
  })

  it('returns false when forwarding to non-existent stack', () => {
    const sent = proxyModule.forwardToSprite('nonexistent', '{}')
    expect(sent).toBe(false)
  })

  it('cleans up on disconnectSprite', async () => {
    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')

    proxyModule.disconnectSprite('stack-1')
    expect(proxyModule.getSpriteConnection('stack-1')).toBeUndefined()
  })
})

// Mock updater module before proxy imports it
vi.mock('../src/updater.js', () => ({
  checkAndUpdate: vi.fn().mockResolvedValue(false),
}))

describe('proxy updater integration', () => {
  let proxyModule: typeof import('../src/proxy.js')
  let checkAndUpdateMock: ReturnType<typeof vi.fn>

  beforeAll(async () => {
    mockSpritePort = 19878
    await startMockSpriteProxy(mockSpritePort)
  })

  afterAll(async () => {
    await stopMockSpriteProxy()
  })

  beforeEach(async () => {
    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockSpritePort}`)

    const { checkAndUpdate } = await import('../src/updater.js')
    checkAndUpdateMock = vi.mocked(checkAndUpdate)
    checkAndUpdateMock.mockClear()
    checkAndUpdateMock.mockResolvedValue(false)

    proxyModule = await import('../src/proxy.js')
  })

  afterEach(() => {
    proxyModule.resetSpriteConnections()
    vi.restoreAllMocks()
  })

  it('calls checkAndUpdate when establishing new connection', async () => {
    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')
    expect(checkAndUpdateMock).toHaveBeenCalledWith('sprite-a')
    expect(proxyModule.getSpriteConnection('stack-1')?.state).toBe('connected')
  })

  it('proceeds normally when update was applied', async () => {
    checkAndUpdateMock.mockResolvedValue(true)
    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')
    expect(checkAndUpdateMock).toHaveBeenCalledWith('sprite-a')
    expect(proxyModule.getSpriteConnection('stack-1')?.state).toBe('connected')
  })

  it('proceeds when checkAndUpdate throws', async () => {
    checkAndUpdateMock.mockRejectedValue(new Error('FS API unreachable'))
    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')
    expect(checkAndUpdateMock).toHaveBeenCalledWith('sprite-a')
    expect(proxyModule.getSpriteConnection('stack-1')?.state).toBe('connected')
  })

  it('skips checkAndUpdate when reusing existing connection', async () => {
    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')
    expect(checkAndUpdateMock).toHaveBeenCalledTimes(1)

    await proxyModule.ensureSpriteConnection('stack-1', 'sprite-a', 'token')
    // Still 1 — reused existing, no second update check
    expect(checkAndUpdateMock).toHaveBeenCalledTimes(1)
  })
})
