import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import { SpriteConnection } from '../src/sprite-connection.js'

let mockServer: WebSocketServer
let mockPort: number
let mockClients: WebSocket[]

function startMockProxy(port: number): Promise<void> {
  return new Promise((resolve) => {
    mockClients = []
    mockServer = new WebSocketServer({ port })

    mockServer.on('connection', (ws) => {
      let initDone = false

      ws.on('message', (raw) => {
        const data = raw.toString()
        if (!initDone) {
          const msg = JSON.parse(data)
          if (msg.host && msg.port) {
            initDone = true
            ws.send(JSON.stringify({ status: 'connected', target: `10.0.0.1:${msg.port}` }))
            mockClients.push(ws)
          }
        }
      })
    })

    mockServer.on('listening', () => resolve())
  })
}

function stopMockProxy(): Promise<void> {
  return new Promise((resolve) => {
    for (const client of mockClients) {
      if (client.readyState === WebSocket.OPEN) client.close()
    }
    mockServer.close(() => resolve())
  })
}

describe('SpriteConnection: partial-line buffering', () => {
  beforeAll(async () => {
    mockPort = 19879
    await startMockProxy(mockPort)
  })

  afterAll(async () => {
    await stopMockProxy()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reassembles partial JSON split across TCP frames', async () => {
    const messages: string[] = []

    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockPort}`)

    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      onMessage: (data) => messages.push(data),
      onClose: vi.fn(),
    })

    await conn.connect()

    const spriteWs = mockClients[mockClients.length - 1]
    const fullMsg = '{"type":"agent_event","id":"abc","timestamp":123}'

    // Split the message across two frames (no newline in first frame)
    spriteWs.send(fullMsg.slice(0, 20))
    await new Promise((r) => setTimeout(r, 50))
    // No message delivered yet -- waiting for newline
    expect(messages).toHaveLength(0)

    // Second frame completes the line
    spriteWs.send(fullMsg.slice(20) + '\n')
    await new Promise((r) => setTimeout(r, 50))

    expect(messages).toHaveLength(1)
    expect(messages[0]).toBe(fullMsg)

    conn.close()
  })

  it('delivers multiple complete messages in one frame', async () => {
    const messages: string[] = []

    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockPort}`)

    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      onMessage: (data) => messages.push(data),
      onClose: vi.fn(),
    })

    await conn.connect()

    const spriteWs = mockClients[mockClients.length - 1]
    const msg1 = '{"type":"event1","id":"1","timestamp":1}'
    const msg2 = '{"type":"event2","id":"2","timestamp":2}'

    // Both messages in one frame, newline-delimited
    spriteWs.send(msg1 + '\n' + msg2 + '\n')
    await new Promise((r) => setTimeout(r, 50))

    expect(messages).toHaveLength(2)
    expect(messages[0]).toBe(msg1)
    expect(messages[1]).toBe(msg2)

    conn.close()
  })

  it('handles three-way split across frames', async () => {
    const messages: string[] = []

    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockPort}`)

    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      onMessage: (data) => messages.push(data),
      onClose: vi.fn(),
    })

    await conn.connect()

    const spriteWs = mockClients[mockClients.length - 1]
    const fullMsg = '{"type":"test","id":"x","timestamp":999}'

    // Split into three frames
    spriteWs.send(fullMsg.slice(0, 10))
    await new Promise((r) => setTimeout(r, 30))
    expect(messages).toHaveLength(0)

    spriteWs.send(fullMsg.slice(10, 25))
    await new Promise((r) => setTimeout(r, 30))
    expect(messages).toHaveLength(0)

    spriteWs.send(fullMsg.slice(25) + '\n')
    await new Promise((r) => setTimeout(r, 30))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toBe(fullMsg)

    conn.close()
  })
})

describe('SpriteConnection: post-init error handling', () => {
  beforeAll(async () => {
    // Reuse port from the previous describe if it was cleaned up
    mockPort = 19880
    await startMockProxy(mockPort)
  })

  afterAll(async () => {
    await stopMockProxy()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls close() on post-init error so zombie sockets are cleaned up', async () => {
    vi.spyOn(await import('../src/sprites-client.js'), 'buildProxyUrl')
      .mockReturnValue(`ws://localhost:${mockPort}`)

    const onClose = vi.fn()
    const onError = vi.fn()
    const conn = new SpriteConnection({
      spriteName: 'test-sprite',
      token: 'test-token',
      onMessage: vi.fn(),
      onClose,
      onError,
    })

    await conn.connect()
    expect(conn.state).toBe('connected')

    // Simulate a post-init error by emitting error on the internal WebSocket.
    // Access the private ws via bracket notation.
    const ws = (conn as any).ws as WebSocket
    ws.emit('error', new Error('simulated post-init error'))

    // close() should have been called, setting state to 'closed'
    await new Promise((r) => setTimeout(r, 100))
    expect(conn.state).toBe('closed')
    expect(onError).toHaveBeenCalled()
  })
})
