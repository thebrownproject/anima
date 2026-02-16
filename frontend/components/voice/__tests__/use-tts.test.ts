import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

const { mockAudioContext, mockAnalyser, mockWorkletNode, mockFetch, mockEnsureResumed, mockLoadWorkletModule, mockDestroy } = vi.hoisted(() => {
  const mockPort = {
    postMessage: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
  }

  const mockWorkletNode = {
    port: mockPort,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const mockAnalyser = {
    fftSize: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const mockAudioContext = {
    destination: {},
    state: 'running' as AudioContextState,
    createAnalyser: vi.fn(() => mockAnalyser),
  }

  const mockEnsureResumed = vi.fn().mockResolvedValue(mockAudioContext)
  const mockLoadWorkletModule = vi.fn().mockResolvedValue(undefined)
  const mockDestroy = vi.fn()

  return {
    mockAudioContext,
    mockAnalyser,
    mockWorkletNode,
    mockFetch: vi.fn(),
    mockEnsureResumed,
    mockLoadWorkletModule,
    mockDestroy,
  }
})

vi.mock('../audio-engine', () => ({
  ensureResumed: (...args: unknown[]) => mockEnsureResumed(...args),
  loadWorkletModule: (...args: unknown[]) => mockLoadWorkletModule(...args),
  destroy: (...args: unknown[]) => mockDestroy(...args),
  getOrCreateContext: () => mockAudioContext,
}))

beforeEach(() => {
  globalThis.AudioWorkletNode = vi.fn(() => mockWorkletNode) as unknown as typeof AudioWorkletNode
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
    mockAudioContext.createAnalyser.mockReturnValue(mockAnalyser)
  })

  afterEach(() => {
    cleanup()
  })

  it('does NOT create AudioContext on mount (lazy init)', async () => {
    renderHook(() => useTTS())
    await act(async () => {}) // flush mount

    expect(mockLoadWorkletModule).not.toHaveBeenCalled()
    expect(mockEnsureResumed).not.toHaveBeenCalled()
  })

  it('speak() lazily inits engine and starts streaming', async () => {
    mockTTSResponse()

    const { result } = renderHook(() => useTTS())
    await act(async () => {
      result.current.speak('hello world')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    })

    expect(mockLoadWorkletModule).toHaveBeenCalledTimes(1)
    expect(mockEnsureResumed).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/voice/tts', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello world' }),
    }))
    expect(result.current.isSpeaking).toBe(true)
    expect(mockWorkletNode.connect).toHaveBeenCalledWith(mockAnalyser)
    expect(mockAnalyser.connect).toHaveBeenCalledWith(mockAudioContext.destination)
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

    await act(async () => {
      mockWorkletNode.port.onmessage?.({ data: { type: 'done' } } as MessageEvent)
    })

    expect(result.current.isSpeaking).toBe(false)
  })

  it('error is initially null', () => {
    const { result } = renderHook(() => useTTS())
    expect(result.current.error).toBeNull()
  })

  it('non-ok fetch response sets error and isSpeaking false', async () => {
    const { result } = renderHook(() => useTTS())

    mockFetch.mockResolvedValueOnce({ ok: false, body: null })
    await act(async () => {
      result.current.speak('hello')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    })

    expect(result.current.error).toBe('Speech generation failed')
    expect(result.current.isSpeaking).toBe(false)
  })

  it('error resets to null on next speak() call', async () => {
    const { result } = renderHook(() => useTTS())

    // First call fails
    mockFetch.mockResolvedValueOnce({ ok: false, body: null })
    await act(async () => {
      result.current.speak('hello')
    })
    await vi.waitFor(() => expect(result.current.error).toBe('Speech generation failed'))

    // Second call should reset error
    mockTTSResponse()
    await act(async () => {
      result.current.speak('world')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    })

    expect(result.current.error).toBeNull()
  })

  it('unmount calls destroy() on audio engine', () => {
    const { unmount } = renderHook(() => useTTS())

    unmount()

    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })
})
