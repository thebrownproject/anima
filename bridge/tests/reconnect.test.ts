import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocket } from 'ws'
import {
  handleDisconnect,
  isReconnecting,
  bufferMessage,
  resetReconnectState,
  type ReconnectDeps,
} from '../src/reconnect.js'

vi.mock('../src/sprites-client.js', () => ({
  getSprite: vi.fn(),
  buildExecUrl: vi.fn().mockReturnValue('ws://localhost:19999/exec'),
  buildProxyUrl: vi.fn().mockReturnValue('ws://localhost:19999/proxy'),
}))

const mockBrowsers: Array<{ ws: { readyState: number; send: ReturnType<typeof vi.fn> } }> = []

vi.mock('../src/connection-store.js', () => ({
  getConnectionsByStack: vi.fn(() => mockBrowsers),
}))

import { getSprite } from '../src/sprites-client.js'

const mockGetSprite = vi.mocked(getSprite)

function makeMockBrowser() {
  return { ws: { readyState: WebSocket.OPEN, send: vi.fn() } }
}

function makeDeps(overrides?: Partial<ReconnectDeps>): ReconnectDeps {
  return {
    spriteName: 'test-sprite',
    token: 'test-token',
    createConnection: vi.fn().mockResolvedValue({
      state: 'connected' as const,
      spriteName: 'test-sprite',
      send: vi.fn().mockReturnValue(true),
      close: vi.fn(),
    }),
    sendToSprite: vi.fn().mockReturnValue(true),
    verifyServer: vi.fn().mockResolvedValue(true),
    restartServer: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const spriteRunning = {
  id: 'sp-1',
  name: 'test-sprite',
  status: 'running' as const,
  organization: 'org',
  created_at: '2026-01-01',
}

describe('reconnect', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetReconnectState()
    mockGetSprite.mockResolvedValue(spriteRunning)
    mockBrowsers.length = 0
    mockBrowsers.push(makeMockBrowser())
  })

  afterEach(() => {
    resetReconnectState()
  })

  it('sends sprite_waking system message on connection drop', async () => {
    await handleDisconnect('stack-1', makeDeps())

    const wakingCall = mockBrowsers[0].ws.send.mock.calls[0][0]
    const wakingMsg = JSON.parse(wakingCall)
    expect(wakingMsg.type).toBe('system')
    expect(wakingMsg.payload.event).toBe('sprite_waking')
  })

  it('sends sprite_ready after reconnect', async () => {
    await handleDisconnect('stack-1', makeDeps())

    const calls = mockBrowsers[0].ws.send.mock.calls
    const readyCall = calls[calls.length - 1][0]
    const readyMsg = JSON.parse(readyCall)
    expect(readyMsg.type).toBe('system')
    expect(readyMsg.payload.event).toBe('sprite_ready')
  })

  it('replays buffered messages (up to 50, within 60s TTL) after reconnect', async () => {
    const sendToSprite = vi.fn().mockReturnValue(true)

    // Slow wake so we can buffer messages before reconnect completes
    let resolveWake!: () => void
    mockGetSprite.mockImplementation(async () => {
      await new Promise<void>((r) => { resolveWake = r })
      return spriteRunning
    })

    const deps = makeDeps({ sendToSprite })
    const reconnectPromise = handleDisconnect('stack-1', deps)

    expect(isReconnecting('stack-1')).toBe(true)
    bufferMessage('stack-1', '{"type":"mission","id":"m1"}')
    bufferMessage('stack-1', '{"type":"mission","id":"m2"}')
    bufferMessage('stack-1', '{"type":"mission","id":"m3"}')

    resolveWake()
    await reconnectPromise

    expect(sendToSprite).toHaveBeenCalledTimes(3)
    expect(sendToSprite).toHaveBeenCalledWith('{"type":"mission","id":"m1"}')
    expect(sendToSprite).toHaveBeenCalledWith('{"type":"mission","id":"m2"}')
    expect(sendToSprite).toHaveBeenCalledWith('{"type":"mission","id":"m3"}')
  })

  it('enforces max 50 buffer limit', async () => {
    let resolveWake!: () => void
    mockGetSprite.mockImplementation(() =>
      new Promise((r) => { resolveWake = r as any }),
    )

    const promise = handleDisconnect('stack-1', makeDeps())

    for (let i = 0; i < 50; i++) {
      expect(bufferMessage('stack-1', `msg-${i}`)).toBe(true)
    }
    expect(bufferMessage('stack-1', 'overflow')).toBe(false)

    resolveWake()
    await promise.catch(() => {})
  })

  it('coalesces concurrent wake attempts (no duplicate wake calls)', async () => {
    const deps = makeDeps()

    const first = handleDisconnect('stack-1', deps)
    const second = handleDisconnect('stack-1', deps)

    const [firstResult, secondResult] = await Promise.all([first, second])
    expect(firstResult).toBe(true)
    expect(secondResult).toBe(false)
    expect(deps.createConnection).toHaveBeenCalledTimes(1)
  })

  it('attempts exec restart when server is unresponsive after wake', async () => {
    const restartServer = vi.fn().mockResolvedValue(undefined)
    const createConnection = vi.fn().mockResolvedValue({
      state: 'connected' as const,
      spriteName: 'test-sprite',
      send: vi.fn().mockReturnValue(true),
      close: vi.fn(),
    })

    const deps = makeDeps({
      createConnection,
      restartServer,
      verifyServer: vi.fn().mockResolvedValue(false), // server unresponsive
    })

    const result = await handleDisconnect('stack-1', deps)
    expect(result).toBe(true)
    expect(restartServer).toHaveBeenCalledWith('test-sprite', 'test-token')
    // createConnection called twice: initial reconnect + retry after restart
    expect(createConnection).toHaveBeenCalledTimes(2)
  })
})
