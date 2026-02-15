import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

const { mockAudioContext, mockWorkletNode, mockFetch } = vi.hoisted(() => {
  const mockPort = {
    postMessage: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
  }

  const mockWorkletNode = {
    port: mockPort,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const mockAudioContext = {
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    destination: {},
    close: vi.fn(),
  }

  return {
    mockAudioContext,
    mockWorkletNode,
    mockFetch: vi.fn(),
  }
})

beforeEach(() => {
  globalThis.AudioContext = vi.fn(() => mockAudioContext) as unknown as typeof AudioContext
  globalThis.AudioWorkletNode = vi.fn(() => mockWorkletNode) as unknown as typeof AudioWorkletNode
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  globalThis.URL.revokeObjectURL = vi.fn()
  globalThis.fetch = mockFetch
})

import { useTTS } from '../use-tts'

function createMockStream(chunks: Uint8Array[]) {
  let i = 0
  return {
    getReader: () => ({
      read: vi.fn(async () => {
        if (i < chunks.length) return { done: false, value: chunks[i++] }
        return { done: true, value: undefined }
      }),
    }),
  }
}

function mockTTSResponse(chunks: Uint8Array[] = [new Uint8Array([0, 0, 0, 0])]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    body: createMockStream(chunks),
  })
}

describe('useTTS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkletNode.port.onmessage = null
  })

  afterEach(() => {
    cleanup()
  })

  it('speak() starts streaming and sets isSpeaking true', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(async () => {
      result.current.speak('hello world')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/voice/tts', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello world' }),
    }))
    expect(result.current.isSpeaking).toBe(true)
    expect(mockWorkletNode.connect).toHaveBeenCalledWith(mockAudioContext.destination)
  })

  it('interrupt() aborts fetch and disconnects worklet', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(async () => {
      result.current.speak('hello')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    })

    act(() => result.current.interrupt())

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ type: 'clear' })
    expect(mockWorkletNode.disconnect).toHaveBeenCalled()
    expect(result.current.isSpeaking).toBe(false)
  })

  it('processor done message sets isSpeaking false', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(async () => {
      result.current.speak('hello')
      await vi.waitFor(() => expect(mockWorkletNode.port.onmessage).not.toBeNull())
    })

    expect(result.current.isSpeaking).toBe(true)

    // Simulate processor signaling playback complete
    await act(async () => {
      mockWorkletNode.port.onmessage?.({ data: { type: 'done' } } as MessageEvent)
    })

    expect(result.current.isSpeaking).toBe(false)
  })

  it('AudioContext created lazily on first speak()', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())

    expect(globalThis.AudioContext).not.toHaveBeenCalled()

    await act(async () => {
      result.current.speak('hello')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    })

    expect(globalThis.AudioContext).toHaveBeenCalledTimes(1)
    expect(globalThis.AudioContext).toHaveBeenCalledWith({ sampleRate: 24000 })
    expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledWith('blob:mock-url')
  })

  // --- Task B: error state tests ---

  it('error is initially null', () => {
    const { result } = renderHook(() => useTTS())
    expect(result.current.error).toBeNull()
  })

  it('non-ok fetch response sets error and isSpeaking false', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, body: null })

    const { result } = renderHook(() => useTTS())
    await act(async () => {
      result.current.speak('hello')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    })

    expect(result.current.error).toBe('Speech generation failed')
    expect(result.current.isSpeaking).toBe(false)
  })

  it('error resets to null on next speak() call', async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce({ ok: false, body: null })

    const { result } = renderHook(() => useTTS())
    await act(async () => {
      result.current.speak('hello')
    })
    // Wait for async IIFE to set error
    await vi.waitFor(() => expect(result.current.error).toBe('Speech generation failed'))

    // Second call should reset error synchronously before async work
    mockTTSResponse()
    await act(async () => {
      result.current.speak('world')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    })

    expect(result.current.error).toBeNull()
  })
})
