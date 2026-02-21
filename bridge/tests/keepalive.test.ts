import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  startKeepalive,
  stopKeepalive,
  resetKeepalives,
  KEEPALIVE_INTERVAL_MS,
} from '../src/keepalive.js'

function mockConn(send: ReturnType<typeof vi.fn>) {
  return { state: 'connected', spriteName: 'test-sprite', send, close: vi.fn() } as any
}

describe('keepalive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetKeepalives()
  })

  afterEach(() => {
    resetKeepalives()
    vi.useRealTimers()
  })

  it('sends keepalive pings every 15s while browser connected', () => {
    const mockSend = vi.fn().mockReturnValue(true)
    startKeepalive('user-1', () => mockConn(mockSend))

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(mockSend).toHaveBeenCalledTimes(1)
    const ping = JSON.parse(mockSend.mock.calls[0][0])
    expect(ping.type).toBe('ping')
    expect(typeof ping.id).toBe('string')
    expect(ping.id.length).toBeGreaterThan(0)

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(mockSend).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS * 2)
    expect(mockSend).toHaveBeenCalledTimes(4)
  })

  it('stops keepalive when browser disconnects', () => {
    const mockSend = vi.fn().mockReturnValue(true)
    startKeepalive('user-1', () => mockConn(mockSend))

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(mockSend).toHaveBeenCalledTimes(1)

    stopKeepalive('user-1')

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS * 3)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('does not start duplicate keepalives for same user', () => {
    const mockSend = vi.fn().mockReturnValue(true)
    const getter = () => mockConn(mockSend)
    startKeepalive('user-1', getter)
    startKeepalive('user-1', getter) // duplicate call

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('skips ping when sprite connection is not connected', () => {
    startKeepalive('user-1', () => undefined)
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    // No error thrown — verifies graceful handling of missing connection
  })

  it('manages multiple users independently', () => {
    const send1 = vi.fn().mockReturnValue(true)
    const send2 = vi.fn().mockReturnValue(true)

    startKeepalive('user-1', () => mockConn(send1))
    startKeepalive('user-2', () => mockConn(send2))

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(send1).toHaveBeenCalledTimes(1)
    expect(send2).toHaveBeenCalledTimes(1)

    stopKeepalive('user-1')
    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS)
    expect(send1).toHaveBeenCalledTimes(1) // stopped
    expect(send2).toHaveBeenCalledTimes(2) // still running
  })
})
