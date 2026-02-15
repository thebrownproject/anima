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

  it('startListening fetches temp token', async () => {
    mockTokenResponse()
    mockMicStream()

    const { result } = renderHook(() => useSTT())
    await act(() => result.current.startListening())

    expect(mockFetch).toHaveBeenCalledWith('/api/voice/deepgram-token', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('startListening requests microphone access', async () => {
    mockTokenResponse()
    mockMicStream()

    const { result } = renderHook(() => useSTT())
    await act(() => result.current.startListening())

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: { noiseSuppression: true, echoCancellation: true },
    })
  })

  it('mic permission denied sets error message', async () => {
    mockTokenResponse()
    const permError = new DOMException('Permission denied', 'NotAllowedError')
    mockGetUserMedia.mockRejectedValueOnce(permError)

    const { result } = renderHook(() => useSTT())
    await act(() => result.current.startListening())

    expect(result.current.error).toMatch(/microphone/i)
  })

  it('transcript events update voice-store.transcript', async () => {
    mockTokenResponse()
    mockMicStream()

    const { result } = renderHook(() => useSTT())
    await act(() => result.current.startListening())

    // Find the Transcript event handler registered via addListener
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
    mockTokenResponse()
    const { track } = mockMicStream()

    const { result } = renderHook(() => useSTT())
    await act(() => result.current.startListening())

    // Trigger Open handler to set up MediaRecorder
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    act(() => result.current.stopListening())

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(mockConnection.requestClose).toHaveBeenCalled()
  })

  it('cleanup on unmount stops active session', async () => {
    mockTokenResponse()
    const { track } = mockMicStream()

    const { result, unmount } = renderHook(() => useSTT())
    await act(() => result.current.startListening())

    // Trigger Open handler to set up MediaRecorder
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    unmount()

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(mockConnection.requestClose).toHaveBeenCalled()
  })

  // --- New tests for Task A fixes ---

  it('double-invocation guard: second startListening returns immediately', async () => {
    mockTokenResponse()
    mockMicStream()

    const { result } = renderHook(() => useSTT())
    await act(() => result.current.startListening())

    // Second call should be a no-op (no second fetch)
    await act(() => result.current.startListening())

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('token fetch timeout sets error', async () => {
    vi.useFakeTimers()
    // Mock fetch that never resolves
    mockFetch.mockImplementationOnce((_url: string, opts: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })

    const { result } = renderHook(() => useSTT())
    const startPromise = act(() => result.current.startListening())

    // Advance past the 10s timeout
    await act(async () => { vi.advanceTimersByTime(10_000) })
    await startPromise

    expect(result.current.error).toBe('Voice connection timed out')
    vi.useRealTimers()
  })

  it('Deepgram error event triggers full cleanup', async () => {
    mockTokenResponse()
    const { track } = mockMicStream()

    const { result } = renderHook(() => useSTT())
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
    mockTokenResponse()
    const { track } = mockMicStream()

    const { result } = renderHook(() => useSTT())
    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    const closeHandler = getEventHandler('close')
    expect(closeHandler).toBeDefined()

    act(() => closeHandler())

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
    // requestClose should NOT be called (connection already closed)
    expect(mockConnection.requestClose).not.toHaveBeenCalled()
  })
})
