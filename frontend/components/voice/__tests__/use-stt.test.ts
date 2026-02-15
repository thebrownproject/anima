import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useVoiceStore } from '@/lib/stores/voice-store'

// --- Mocks (hoisted above imports per Vitest pattern) ---

const { mockListenLive, mockConnection, mockFetch, mockMediaRecorder, mockGetUserMedia } =
  vi.hoisted(() => {
    const mockConnection = {
      addListener: vi.fn(),
      send: vi.fn(),
      requestClose: vi.fn(),
      keepAlive: vi.fn(),
    }
    const mockListenLive = vi.fn(() => mockConnection)

    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      state: 'inactive' as string,
    }

    const mockGetUserMedia = vi.fn()

    return {
      mockConnection,
      mockListenLive,
      mockFetch: vi.fn(),
      mockMediaRecorder,
      mockGetUserMedia,
    }
  })

vi.mock('@deepgram/sdk', () => ({
  createClient: () => ({ listen: { live: mockListenLive } }),
  LiveConnectionState: { OPEN: 1, CLOSED: 0 },
  LiveTranscriptionEvents: {
    Open: 'open',
    Close: 'close',
    Error: 'error',
    Transcript: 'Results',
  },
}))

// Mock browser APIs not available in jsdom
beforeEach(() => {
  globalThis.fetch = mockFetch
  globalThis.MediaRecorder = vi.fn(() => mockMediaRecorder) as unknown as typeof MediaRecorder
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
  })
})

import { useSTT } from '../use-stt'

// --- Helpers ---

function mockTokenResponse(token = 'tmp-tok-123') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ token, expires_in: 120 }),
  })
}

function mockMicStream() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track], active: true }
  mockGetUserMedia.mockResolvedValueOnce(stream)
  return { stream, track }
}

/** Render hook and flush the pre-fetch useEffect so token is cached */
async function renderSTTHook() {
  mockTokenResponse('prefetch-tok')
  const hook = renderHook(() => useSTT())
  await act(async () => {}) // flush pre-fetch
  mockFetch.mockClear() // reset call count so tests only see startListening calls
  return hook
}

function triggerOpen() {
  const openCall = mockConnection.addListener.mock.calls.find(
    (call: unknown[]) => call[0] === 'open'
  )
  expect(openCall).toBeDefined()
  act(() => openCall![1]())
}

function getEventHandler(event: string) {
  const call = mockConnection.addListener.mock.calls.find(
    (c: unknown[]) => c[0] === event
  )
  return call?.[1]
}

function getRecorderHandler(event: string) {
  const call = mockMediaRecorder.addEventListener.mock.calls.find(
    (c: unknown[]) => c[0] === event
  )
  return call?.[1]
}

// --- Tests ---

describe('useSTT', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMediaRecorder.state = 'inactive'
    mockMediaRecorder.addEventListener.mockReset()
    useVoiceStore.setState({ transcript: '' })
  })

  afterEach(() => {
    cleanup()
  })

  it('pre-fetches token on mount', async () => {
    mockTokenResponse()

    renderHook(() => useSTT())
    await act(async () => {}) // flush pre-fetch

    expect(mockFetch).toHaveBeenCalledWith('/api/voice/deepgram-token', expect.any(Object))
  })

  it('uses cached token — no fetch during startListening', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    // startListening should NOT have called fetch (used cache)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('startListening requests microphone access', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: { noiseSuppression: true, echoCancellation: true },
    })
  })

  it('mic permission denied sets error message', async () => {
    const { result } = await renderSTTHook()
    mockGetUserMedia.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))

    await act(() => result.current.startListening())

    expect(result.current.error).toMatch(/microphone/i)
  })

  it('transcript events update voice-store.transcript', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    const transcriptCall = mockConnection.addListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'Results'
    )
    expect(transcriptCall).toBeDefined()

    const handler = transcriptCall![1]
    act(() => {
      handler({
        is_final: true,
        channel: { alternatives: [{ transcript: 'hello world' }] },
      })
    })

    expect(useVoiceStore.getState().transcript).toBe('hello world')
  })

  it('stopListening stops tracks and closes connection', async () => {
    const { result } = await renderSTTHook()
    const { track } = mockMicStream()

    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    act(() => result.current.stopListening())

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(mockConnection.requestClose).toHaveBeenCalled()
  })

  it('cleanup on unmount stops active session', async () => {
    const { result, unmount } = await renderSTTHook()
    const { track } = mockMicStream()

    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    unmount()

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(mockConnection.requestClose).toHaveBeenCalled()
  })

  it('double-invocation guard: second startListening returns immediately', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    // Second call should be a no-op (no second getUserMedia)
    await act(() => result.current.startListening())

    expect(mockGetUserMedia).toHaveBeenCalledTimes(1)
  })

  it('fetches fresh token when cache is missing', async () => {
    // Don't use renderSTTHook — let pre-fetch fail so cache is empty
    mockFetch.mockResolvedValueOnce({ ok: false }) // pre-fetch fails
    const hook = renderHook(() => useSTT())
    await act(async () => {})
    mockFetch.mockClear()

    // Now startListening should fetch fresh
    mockTokenResponse()
    mockMicStream()
    await act(() => hook.result.current.startListening())

    expect(mockFetch).toHaveBeenCalledWith('/api/voice/deepgram-token', expect.any(Object))
  })

  it('token fetch fails — mic stream tracks are stopped', async () => {
    // Pre-fetch fails, then startListening fetch also fails
    mockFetch.mockResolvedValueOnce({ ok: false }) // pre-fetch
    const hook = renderHook(() => useSTT())
    await act(async () => {})
    mockFetch.mockClear()

    mockFetch.mockResolvedValueOnce({ ok: false }) // startListening fetch
    const { track } = mockMicStream()

    await act(() => hook.result.current.startListening())

    expect(hook.result.current.error).toBe('Failed to get voice token')
    expect(track.stop).toHaveBeenCalled()
  })

  it('mic fails — sets microphone error (token result unused)', async () => {
    const { result } = await renderSTTHook()
    mockGetUserMedia.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))

    await act(() => result.current.startListening())

    expect(result.current.error).toBe('Microphone access denied')
  })

  it('token fetch timeout sets error and stops mic tracks', async () => {
    vi.useFakeTimers()
    // Pre-fetch: make it hang (won't resolve during test)
    mockFetch.mockImplementationOnce(() => new Promise(() => {}))
    const hook = renderHook(() => useSTT())
    await act(async () => { vi.advanceTimersByTime(100) })
    mockFetch.mockClear()

    // startListening fetch: hangs until abort
    mockFetch.mockImplementationOnce((_url: string, opts: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    const { track } = mockMicStream()

    const startPromise = act(() => hook.result.current.startListening())
    await act(async () => { vi.advanceTimersByTime(10_000) })
    await startPromise

    expect(hook.result.current.error).toBe('Voice connection timed out')
    expect(track.stop).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('Deepgram error event triggers full cleanup', async () => {
    const { result } = await renderSTTHook()
    const { track } = mockMicStream()

    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    const errorHandler = getEventHandler('error')
    expect(errorHandler).toBeDefined()

    act(() => errorHandler(new Error('connection failed')))

    expect(result.current.error).toBe('Voice transcription error')
    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
  })

  it('Deepgram close event releases mic and recorder', async () => {
    const { result } = await renderSTTHook()
    const { track } = mockMicStream()

    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    const closeHandler = getEventHandler('close')
    expect(closeHandler).toBeDefined()

    act(() => closeHandler())

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
    expect(mockConnection.requestClose).not.toHaveBeenCalled()
  })

  // --- Audio buffering tests ---

  it('buffers audio chunks before WebSocket opens and flushes on open', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    // Recorder starts immediately with 100ms timeslice
    expect(mockMediaRecorder.start).toHaveBeenCalledWith(100)
    const dataHandler = getRecorderHandler('dataavailable')
    expect(dataHandler).toBeDefined()

    // Simulate audio chunks arriving before WS opens
    const chunk1 = new Blob(['audio1'], { type: 'audio/webm' })
    const chunk2 = new Blob(['audio2'], { type: 'audio/webm' })
    act(() => {
      dataHandler({ data: chunk1 })
      dataHandler({ data: chunk2 })
    })

    // Chunks should NOT have been sent yet (WS not open)
    expect(mockConnection.send).not.toHaveBeenCalled()

    // Now trigger Open — should flush buffered chunks
    triggerOpen()

    expect(mockConnection.send).toHaveBeenCalledTimes(2)
    expect(mockConnection.send).toHaveBeenNthCalledWith(1, chunk1)
    expect(mockConnection.send).toHaveBeenNthCalledWith(2, chunk2)

    // After Open, new chunks should be sent directly
    mockConnection.send.mockClear()
    const chunk3 = new Blob(['audio3'], { type: 'audio/webm' })
    act(() => dataHandler({ data: chunk3 }))
    expect(mockConnection.send).toHaveBeenCalledWith(chunk3)
  })

  it('stops listening if audio buffer overflows', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    const dataHandler = getRecorderHandler('dataavailable')
    expect(dataHandler).toBeDefined()

    // Push 101 chunks (exceeds 100-chunk limit at 100ms timeslice = 10s)
    act(() => {
      for (let i = 0; i <= 100; i++) {
        dataHandler({ data: new Blob([`chunk-${i}`]) })
      }
    })

    expect(result.current.error).toBe('Voice connection took too long')
    expect(result.current.isListening).toBe(false)
  })
})
