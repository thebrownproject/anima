import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

// --- Mocks (hoisted above imports per Vitest pattern) ---

const { mockAudioContext, mockSource, mockFetch } = vi.hoisted(() => {
  const mockSource = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
    buffer: null as unknown,
  }

  const mockAudioContext = {
    decodeAudioData: vi.fn(),
    createBufferSource: vi.fn(() => mockSource),
    destination: {},
  }

  return {
    mockAudioContext,
    mockSource,
    mockFetch: vi.fn(),
  }
})

beforeEach(() => {
  globalThis.AudioContext = vi.fn(() => mockAudioContext) as unknown as typeof AudioContext
  globalThis.fetch = mockFetch
})

import { useTTS } from '../use-tts'

// --- Helpers ---

function mockTTSResponse() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })
  mockAudioContext.decodeAudioData.mockResolvedValueOnce('decoded-buffer')
}

// --- Tests ---

describe('useTTS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSource.onended = null
    mockSource.buffer = null
  })

  afterEach(() => {
    cleanup()
  })

  it('speak() calls /api/voice/tts with text', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(() => result.current.speak('hello world'))

    expect(mockFetch).toHaveBeenCalledWith('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello world' }),
    })
  })

  it('speak() sets isSpeaking true', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(() => result.current.speak('hello'))

    expect(result.current.isSpeaking).toBe(true)
  })

  it('multiple speak() calls queue sequentially', async () => {
    mockTTSResponse()
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(() => {
      result.current.speak('first')
      result.current.speak('second')
    })

    // First fetch fires immediately, second waits in queue
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/voice/tts', expect.objectContaining({
      body: JSON.stringify({ text: 'first' }),
    }))

    // Trigger onended to process next in queue
    await act(async () => {
      mockSource.onended?.()
      // Allow microtask queue to flush
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenLastCalledWith('/api/voice/tts', expect.objectContaining({
      body: JSON.stringify({ text: 'second' }),
    }))
  })

  it('interrupt() stops audio and clears queue', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(() => {
      result.current.speak('first')
      result.current.speak('second')
    })

    act(() => result.current.interrupt())

    expect(mockSource.stop).toHaveBeenCalled()
  })

  it('after interrupt, isSpeaking is false', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(() => result.current.speak('hello'))

    expect(result.current.isSpeaking).toBe(true)

    act(() => result.current.interrupt())

    expect(result.current.isSpeaking).toBe(false)
  })

  it('AudioContext created lazily on first speak()', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())

    // Not created on mount
    expect(globalThis.AudioContext).not.toHaveBeenCalled()

    await act(() => result.current.speak('hello'))

    expect(globalThis.AudioContext).toHaveBeenCalledTimes(1)
  })
})
