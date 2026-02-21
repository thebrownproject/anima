import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketManager, type ConnectionStatus } from '../websocket'

// Mock WebSocket for jsdom (not available by default)
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null

  url: string
  sentMessages: string[] = []
  closeCode?: number
  closeReason?: string

  constructor(url: string) {
    this.url = url
    // Simulate async connection
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN
        this.onopen?.()
      }
    }, 0)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close(code?: number, reason?: string) {
    this.closeCode = code
    this.closeReason = reason
    this.readyState = MockWebSocket.CLOSED
    // Fire onclose synchronously for test predictability
    this.onclose?.({ code: code ?? 1000, reason: reason ?? '' })
  }

  // Test helpers
  simulateMessage(data: string) {
    this.onmessage?.({ data })
  }

  simulateClose(code: number, reason = '') {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason })
  }

  simulateError() {
    this.onerror?.()
  }
}

// Track created instances for test inspection
let wsInstances: MockWebSocket[] = []
const originalWebSocket = globalThis.WebSocket

function installMockWebSocket() {
  wsInstances = []
  ;(globalThis as any).WebSocket = class extends MockWebSocket {
    constructor(url: string) {
      super(url)
      wsInstances.push(this)
    }
  }
  // Copy static properties
  ;(globalThis as any).WebSocket.OPEN = MockWebSocket.OPEN
  ;(globalThis as any).WebSocket.CONNECTING = MockWebSocket.CONNECTING
  ;(globalThis as any).WebSocket.CLOSING = MockWebSocket.CLOSING
  ;(globalThis as any).WebSocket.CLOSED = MockWebSocket.CLOSED
}

function getLastWs(): MockWebSocket {
  return wsInstances[wsInstances.length - 1]
}

function createManager(overrides: Partial<Parameters<typeof WebSocketManager.prototype.connect>[0]> = {}) {
  const statuses: Array<{ status: ConnectionStatus; error?: string }> = []
  const messages: unknown[] = []

  const manager = new WebSocketManager({
    getToken: vi.fn().mockResolvedValue('test-token'),
    onStatusChange: (status, error) => statuses.push({ status, error }),
    onMessage: (msg) => messages.push(msg),
    url: 'wss://test.example.com',
    ...overrides,
  })

  return { manager, statuses, messages }
}

describe('WebSocketManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    installMockWebSocket()
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.WebSocket = originalWebSocket
  })

  describe('send() return type', () => {
    it('returns "sent" when WebSocket is open', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0) // trigger onopen + authenticate

      // Simulate auth success + sprite_ready
      const ws = getLastWs()
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'sprite_ready' },
      }))

      const result = manager.send({ type: 'mission', payload: { text: 'hello' } })
      expect(result).toBe('sent')
      manager.destroy()
    })

    it('returns "queued" when disconnected but recoverable', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'sprite_ready' },
      }))

      // Simulate disconnect (recoverable)
      ws.simulateClose(1006)
      await vi.advanceTimersByTimeAsync(0)

      const result = manager.send({ type: 'mission', payload: { text: 'hello' } })
      expect(result).toBe('queued')
      manager.destroy()
    })

    it('returns "dropped" when in terminal error state', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      // 4001 = terminal auth rejection
      ws.simulateClose(4001)
      await vi.advanceTimersByTimeAsync(0)

      const result = manager.send({ type: 'mission', payload: { text: 'hello' } })
      expect(result).toBe('dropped')
      manager.destroy()
    })
  })

  describe('message queue', () => {
    it('queues messages up to MAX_QUEUE (100)', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'sprite_waking' },
      }))

      // Queue 100 messages during sprite_waking
      for (let i = 0; i < 100; i++) {
        const result = manager.send({ type: 'mission', payload: { text: `msg-${i}` } })
        expect(result).toBe('queued')
      }

      // 101st message should drop oldest and still be queued
      const result = manager.send({ type: 'mission', payload: { text: 'overflow' } })
      expect(result).toBe('queued')

      manager.destroy()
    })

    it('flushes queue on sprite_ready', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'sprite_waking' },
      }))

      // Queue messages during sprite_waking
      manager.send({ type: 'mission', payload: { text: 'queued-1' } })
      manager.send({ type: 'mission', payload: { text: 'queued-2' } })

      // Count sent messages before flush (auth message is first)
      const sentBefore = ws.sentMessages.length

      // Sprite becomes ready
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '3', timestamp: Date.now(),
        payload: { event: 'sprite_ready' },
      }))

      // Queued messages should have been sent
      expect(ws.sentMessages.length).toBe(sentBefore + 2)
      manager.destroy()
    })

    it('evicts messages older than TTL (60s) on flush', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'sprite_waking' },
      }))

      // Queue a message
      manager.send({ type: 'mission', payload: { text: 'old-message' } })
      const sentBefore = ws.sentMessages.length

      // Advance past TTL
      await vi.advanceTimersByTimeAsync(61000)

      // Queue a fresh message
      manager.send({ type: 'mission', payload: { text: 'fresh-message' } })

      // Sprite becomes ready - old message should be evicted, fresh sent
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '3', timestamp: Date.now(),
        payload: { event: 'sprite_ready' },
      }))

      // Only the fresh message should have been sent (not the expired one)
      const sentAfter = ws.sentMessages.length - sentBefore
      expect(sentAfter).toBe(1)
      const lastSent = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1])
      expect(lastSent.payload.text).toBe('fresh-message')
      manager.destroy()
    })

    it('drops oldest when queue is full', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'sprite_waking' },
      }))

      // Fill queue to max
      for (let i = 0; i < 100; i++) {
        manager.send({ type: 'mission', payload: { text: `msg-${i}` } })
      }

      // Add one more - should drop msg-0
      manager.send({ type: 'mission', payload: { text: 'overflow' } })

      const sentBefore = ws.sentMessages.length

      // Flush
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '3', timestamp: Date.now(),
        payload: { event: 'sprite_ready' },
      }))

      // 100 messages flushed (msg-1 through msg-99 + overflow)
      const flushed = ws.sentMessages.slice(sentBefore)
      expect(flushed.length).toBe(100)
      const first = JSON.parse(flushed[0])
      expect(first.payload.text).toBe('msg-1')
      const last = JSON.parse(flushed[flushed.length - 1])
      expect(last.payload.text).toBe('overflow')
      manager.destroy()
    })

    it('does not cause duplicate delivery on rapid reconnect', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0) // WS1 constructor setTimeout
      await vi.advanceTimersByTimeAsync(0) // authenticate microtask

      const ws1 = getLastWs()
      ws1.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws1.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'sprite_waking' },
      }))

      // Queue a message during sprite_waking
      manager.send({ type: 'mission', payload: { text: 'should-send-once' } })

      // Disconnect
      ws1.simulateClose(1006)

      // Advance past backoff (1000ms) to trigger connect()
      await vi.advanceTimersByTimeAsync(1000)
      // Advance to trigger WS2 constructor setTimeout onopen
      await vi.advanceTimersByTimeAsync(1)
      // Flush microtasks for authenticate + getToken
      await vi.advanceTimersByTimeAsync(1)

      const ws2 = getLastWs()
      expect(wsInstances.length).toBe(2)

      // Simulate auth success on ws2
      ws2.simulateMessage(JSON.stringify({
        type: 'system', id: '3', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws2.simulateMessage(JSON.stringify({
        type: 'system', id: '4', timestamp: Date.now(),
        payload: { event: 'sprite_ready' },
      }))

      // Check all WS instances for the queued message (should appear exactly once total)
      let totalMatches = 0
      for (const ws of wsInstances) {
        totalMatches += ws.sentMessages.filter(m => {
          try { return JSON.parse(m).payload?.text === 'should-send-once' } catch { return false }
        }).length
      }
      expect(totalMatches).toBe(1)
      manager.destroy()
    })

    it('messages queued during sprite_waking are held until sprite_ready', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'sprite_waking' },
      }))

      const sentBeforeQueue = ws.sentMessages.length
      manager.send({ type: 'mission', payload: { text: 'during-wake' } })

      // Not sent yet (WS is open but Sprite isn't ready)
      expect(ws.sentMessages.length).toBe(sentBeforeQueue)

      // Sprite ready -> flush
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '3', timestamp: Date.now(),
        payload: { event: 'sprite_ready' },
      }))

      expect(ws.sentMessages.length).toBe(sentBeforeQueue + 1)
      manager.destroy()
    })
  })

  describe('close code handling', () => {
    it('4001 close is terminal - no reconnect', async () => {
      const { manager, statuses } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      ws.simulateClose(4001, 'Auth rejected')

      const errorStatus = statuses.find(s => s.status === 'error')
      expect(errorStatus).toBeTruthy()

      // Advance past any backoff - should NOT create new connection
      const instanceCount = wsInstances.length
      await vi.advanceTimersByTimeAsync(60000)
      expect(wsInstances.length).toBe(instanceCount)
      manager.destroy()
    })

    it('normal close (1006) triggers reconnect', async () => {
      const { manager } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      const instanceCount = wsInstances.length
      ws.simulateClose(1006)

      // Advance past backoff
      await vi.advanceTimersByTimeAsync(2000)
      expect(wsInstances.length).toBeGreaterThan(instanceCount)
      manager.destroy()
    })
  })

  describe('reconnect_failed handling', () => {
    it('transitions to error on reconnect_failed', async () => {
      const { manager, statuses } = createManager()
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const ws = getLastWs()
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '1', timestamp: Date.now(),
        payload: { event: 'connected' },
      }))
      ws.simulateMessage(JSON.stringify({
        type: 'system', id: '2', timestamp: Date.now(),
        payload: { event: 'reconnect_failed', message: 'Sprite could not wake' },
      }))

      const errorStatus = statuses.find(s => s.status === 'error' && s.error === 'Sprite could not wake')
      expect(errorStatus).toBeTruthy()
      manager.destroy()
    })
  })

  describe('authenticate() error handling', () => {
    it('catches getToken() exception and sets error status', async () => {
      const getToken = vi.fn().mockRejectedValue(new Error('Clerk unavailable'))
      const { manager, statuses } = createManager({ getToken })
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      // getToken() throws - should be caught
      const errorStatus = statuses.find(s => s.status === 'error')
      expect(errorStatus).toBeTruthy()
      expect(errorStatus?.error).toContain('auth token')
      manager.destroy()
    })

    it('handles null token return', async () => {
      const getToken = vi.fn().mockResolvedValue(null)
      const { manager, statuses } = createManager({ getToken })
      manager.connect()
      await vi.advanceTimersByTimeAsync(0)

      const errorStatus = statuses.find(s => s.status === 'error')
      expect(errorStatus).toBeTruthy()
      manager.destroy()
    })
  })
})
