import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock proxy module to control getSpriteConnection
vi.mock('../src/proxy.js', () => ({
  getSpriteConnection: vi.fn(),
}))

import { getSpriteConnection } from '../src/proxy.js'
import {
  startKeepalive,
  stopKeepalive,
  resetKeepalives,
  KEEPALIVE_INTERVAL_MS,
} from '../src/keepalive.js'

const mockGetSpriteConnection = vi.mocked(getSpriteConnection)

describe('keepalive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetKeepalives()
  })

  afterEach(() => {
    resetKeepalives()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sends keepalive pings every 15s while browser connected', () => {
    const mockSend = vi.fn().mockReturnValue(true)
    mockGetSpriteConnection.mockReturnValue({
      state: 'connected',
      spriteName: 'test-sprite',
      send: mockSend,
      close: vi.fn(),
    } as any)

    startKeepalive('stack-1')

    // Advance by 15s — should trigger one ping
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(mockSend).toHaveBeenCalledTimes(1)
    const ping = JSON.parse(mockSend.mock.calls[0][0])
    expect(ping.type).toBe('ping')

    // Advance another 15s — second ping
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(mockSend).toHaveBeenCalledTimes(2)

    // Advance 30 more seconds — 2 more pings
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS * 2)
    expect(mockSend).toHaveBeenCalledTimes(4)
  })

  it('stops keepalive when browser disconnects', () => {
    const mockSend = vi.fn().mockReturnValue(true)
    mockGetSpriteConnection.mockReturnValue({
      state: 'connected',
      spriteName: 'test-sprite',
      send: mockSend,
      close: vi.fn(),
    } as any)

    startKeepalive('stack-1')
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(mockSend).toHaveBeenCalledTimes(1)

    // Stop keepalive (simulating last browser disconnect)
    stopKeepalive('stack-1')

    // Advance more time — no additional pings
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS * 3)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('does not start duplicate keepalives for same stack', () => {
    const mockSend = vi.fn().mockReturnValue(true)
    mockGetSpriteConnection.mockReturnValue({
      state: 'connected',
      spriteName: 'test-sprite',
      send: mockSend,
      close: vi.fn(),
    } as any)

    startKeepalive('stack-1')
    startKeepalive('stack-1') // duplicate call

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    // Should only have 1 ping, not 2
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('skips ping when sprite connection is not connected', () => {
    mockGetSpriteConnection.mockReturnValue(undefined)

    startKeepalive('stack-1')
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)

    // No connection, so no send call
    // (getSpriteConnection returned undefined)
    // This just verifies no error is thrown and no crash occurs
  })

  it('manages multiple stacks independently', () => {
    const send1 = vi.fn().mockReturnValue(true)
    const send2 = vi.fn().mockReturnValue(true)

    mockGetSpriteConnection.mockImplementation((stackId: string) => {
      const sends: Record<string, ReturnType<typeof vi.fn>> = { 'stack-1': send1, 'stack-2': send2 }
      const s = sends[stackId]
      if (!s) return undefined
      return { state: 'connected', spriteName: `sprite-${stackId}`, send: s, close: vi.fn() } as any
    })

    startKeepalive('stack-1')
    startKeepalive('stack-2')

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(send1).toHaveBeenCalledTimes(1)
    expect(send2).toHaveBeenCalledTimes(1)

    stopKeepalive('stack-1')
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(send1).toHaveBeenCalledTimes(1) // stopped
    expect(send2).toHaveBeenCalledTimes(2) // still running
  })
})
