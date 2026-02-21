import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

let mockStatus = 'disconnected' as string
let mockError: string | null = null

vi.mock('../ws-provider', () => ({
  useWebSocket: () => ({
    status: mockStatus,
    error: mockError,
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(() => 'sent'),
    debugLog: { current: [] },
  }),
}))

import { ConnectionStatus } from '../connection-status'

describe('ConnectionStatus indicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockStatus = 'connected'
    mockError = null
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('hidden when connected', () => {
    render(<ConnectionStatus />)
    expect(screen.queryByTestId('connection-status')).toBeNull()
  })

  it('visible during connecting', () => {
    mockStatus = 'connecting'
    render(<ConnectionStatus />)
    expect(screen.getByTestId('connection-status')).toBeTruthy()
    expect(screen.getByText('Connecting...')).toBeTruthy()
  })

  it('visible during authenticating', () => {
    mockStatus = 'authenticating'
    render(<ConnectionStatus />)
    expect(screen.getByTestId('connection-status')).toBeTruthy()
    expect(screen.getByText('Authenticating...')).toBeTruthy()
  })

  it('visible during sprite_waking with cold-start message', () => {
    mockStatus = 'sprite_waking'
    render(<ConnectionStatus />)
    expect(screen.getByTestId('connection-status')).toBeTruthy()
    expect(screen.getByText('Connecting to your workspace...')).toBeTruthy()
  })

  it('visible during error with error message', () => {
    mockStatus = 'error'
    mockError = 'Auth failed'
    render(<ConnectionStatus />)
    expect(screen.getByTestId('connection-status')).toBeTruthy()
    expect(screen.getByText('Auth failed')).toBeTruthy()
  })

  it('suppresses transient disconnects <5s', () => {
    // Start connected
    const { rerender } = render(<ConnectionStatus />)
    expect(screen.queryByTestId('connection-status')).toBeNull()

    // Disconnect
    mockStatus = 'disconnected'
    rerender(<ConnectionStatus />)

    // Should still be hidden (transient suppress)
    expect(screen.queryByTestId('connection-status')).toBeNull()

    // Reconnect within 5s
    mockStatus = 'connected'
    rerender(<ConnectionStatus />)

    // Advance past threshold - should still be hidden
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.queryByTestId('connection-status')).toBeNull()
  })

  it('shows reconnecting after 5s disconnect', () => {
    // Start connected
    const { rerender } = render(<ConnectionStatus />)

    // Disconnect
    mockStatus = 'disconnected'
    rerender(<ConnectionStatus />)
    expect(screen.queryByTestId('connection-status')).toBeNull()

    // 5s passes, still disconnected
    act(() => { vi.advanceTimersByTime(5000) })
    // Force re-render to pick up state change from timer
    rerender(<ConnectionStatus />)
    expect(screen.getByTestId('connection-status')).toBeTruthy()
    expect(screen.getByText('Reconnecting...')).toBeTruthy()
  })
})
