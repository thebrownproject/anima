import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useVoiceStore } from '@/lib/stores/voice-store'

// --- Mocks (hoisted above imports per Vitest pattern) ---

const { mockListenLive, mockConnection, mockFetch, mockMediaRecorder, mockAcquireMic, mockReleaseMic, mockConnectAnalyser, mockDisconnectAnalyser } =
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

    return {
      mockConnection,
      mockListenLive,
      mockFetch: vi.fn(),
      mockMediaRecorder,
      mockAcquireMic: vi.fn(),
      mockReleaseMic: vi.fn(),
      mockConnectAnalyser: vi.fn(),
      mockDisconnectAnalyser: vi.fn(),
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

vi.mock('../audio-engine', () => ({
  acquireMic: (...args: unknown[]) => mockAcquireMic(...args),
  releaseMic: (...args: unknown[]) => mockReleaseMic(...args),
  connectAnalyser: (...args: unknown[]) => mockConnectAnalyser(...args),
  disconnectAnalyser: (...args: unknown[]) => mockDisconnectAnalyser(...args),
}))

// Mock browser APIs not available in jsdom
beforeEach(() => {
  globalThis.fetch = mockFetch
  globalThis.MediaRecorder = vi.fn(() => mockMediaRecorder) as unknown as typeof MediaRecorder
})

import { useSTT } from '../use-stt'

// --- Helpers ---

function mockTokenResponse(token = 'tmp-tok-123') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ token, expires_in: 120 }),
  })
}

const mockAnalyserNode = { fftSize: 256 }

function mockMicStream() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track], active: true }
  mockAcquireMic.mockResolvedValueOnce(stream)
  return { stream, track }
}

/** Render hook and flush the pre-fetch useEffect so token is cached */
async function renderSTTHook() {
  mockTokenResponse('prefetch-tok')
  const hook = renderHook(() => useSTT())
  await act(async () => {}) // flush pre-fetch
  mockFetch.mockClear()
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
    mockConnectAnalyser.mockReturnValue(mockAnalyserNode)
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

  it('uses cached token then pre-fetches replacement in background', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()
    mockTokenResponse('refresh-tok') // for the background refresh

    await act(() => result.current.startListening())

    // startListening used cache for Deepgram, then triggered background refresh
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/voice/deepgram-token', expect.any(Object))
  })

  it('startListening acquires mic via audio engine', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    expect(mockAcquireMic).toHaveBeenCalledTimes(1)
  })

  it('mic permission denied sets error message', async () => {
    const { result } = await renderSTTHook()
    mockAcquireMic.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))

    await act(() => result.current.startListening())

    expect(result.current.error).toMatch(/microphone/i)
  })

  it('connects analyser via audio engine for voice bars', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    expect(mockConnectAnalyser).toHaveBeenCalledTimes(1)
    expect(result.current.analyser).toBe(mockAnalyserNode)
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

  it('stopListening releases mic via engine (frees audio pipeline for TTS)', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    act(() => result.current.stopListening())

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(mockConnection.requestClose).toHaveBeenCalled()
    expect(mockReleaseMic).toHaveBeenCalled()
  })

  it('cleanup on unmount releases mic via engine', async () => {
    const { result, unmount } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    unmount()

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(mockConnection.requestClose).toHaveBeenCalled()
    expect(mockReleaseMic).toHaveBeenCalled()
  })

  it('double-invocation guard: second startListening returns immediately', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    await act(() => result.current.startListening())

    expect(mockAcquireMic).toHaveBeenCalledTimes(1)
  })

  it('fetches fresh token when cache is missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false }) // pre-fetch fails
    const hook = renderHook(() => useSTT())
    await act(async () => {})
    mockFetch.mockClear()

    mockTokenResponse()
    mockMicStream()
    await act(() => hook.result.current.startListening())

    expect(mockFetch).toHaveBeenCalledWith('/api/voice/deepgram-token', expect.any(Object))
  })

  it('token fetch fails — sets error (mic stays in engine)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false }) // pre-fetch
    const hook = renderHook(() => useSTT())
    await act(async () => {})
    mockFetch.mockClear()

    mockFetch.mockResolvedValueOnce({ ok: false }) // startListening fetch
    mockMicStream()

    await act(() => hook.result.current.startListening())

    expect(hook.result.current.error).toBe('Failed to get voice token')
    // Mic stays in engine for next attempt — not released
    expect(mockReleaseMic).not.toHaveBeenCalled()
  })

  it('mic fails — sets microphone error', async () => {
    const { result } = await renderSTTHook()
    mockAcquireMic.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))

    await act(() => result.current.startListening())

    expect(result.current.error).toBe('Microphone access denied')
  })

  it('token fetch timeout sets error', async () => {
    vi.useFakeTimers()
    mockFetch.mockImplementationOnce(() => new Promise(() => {})) // pre-fetch hangs
    const hook = renderHook(() => useSTT())
    await act(async () => { vi.advanceTimersByTime(100) })
    mockFetch.mockClear()

    mockFetch.mockImplementationOnce((_url: string, opts: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    mockMicStream()

    const startPromise = act(() => hook.result.current.startListening())
    await act(async () => { vi.advanceTimersByTime(10_000) })
    await startPromise

    expect(hook.result.current.error).toBe('Voice connection timed out')
    vi.useRealTimers()
  })

  it('Deepgram error event triggers cleanup', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    const errorHandler = getEventHandler('error')
    expect(errorHandler).toBeDefined()

    act(() => errorHandler(new Error('connection failed')))

    expect(result.current.error).toBe('Voice transcription error')
    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(mockReleaseMic).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
  })

  it('Deepgram close event cleans up recorder and connection', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())
    triggerOpen()
    mockMediaRecorder.state = 'recording'

    const closeHandler = getEventHandler('close')
    expect(closeHandler).toBeDefined()

    act(() => closeHandler())

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
    expect(mockConnection.requestClose).not.toHaveBeenCalled()
  })

  // --- Audio buffering tests ---

  it('buffers audio chunks before WebSocket opens and flushes on open', async () => {
    const { result } = await renderSTTHook()
    mockMicStream()

    await act(() => result.current.startListening())

    expect(mockMediaRecorder.start).toHaveBeenCalledWith(100)
    const dataHandler = getRecorderHandler('dataavailable')
    expect(dataHandler).toBeDefined()

    const chunk1 = new Blob(['audio1'], { type: 'audio/webm' })
    const chunk2 = new Blob(['audio2'], { type: 'audio/webm' })
    act(() => {
      dataHandler({ data: chunk1 })
      dataHandler({ data: chunk2 })
    })

    expect(mockConnection.send).not.toHaveBeenCalled()

    triggerOpen()

    expect(mockConnection.send).toHaveBeenCalledTimes(2)
    expect(mockConnection.send).toHaveBeenNthCalledWith(1, chunk1)
    expect(mockConnection.send).toHaveBeenNthCalledWith(2, chunk2)

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

    act(() => {
      for (let i = 0; i <= 100; i++) {
        dataHandler({ data: new Blob([`chunk-${i}`]) })
      }
    })

    expect(result.current.error).toBe('Voice connection took too long')
    expect(result.current.isListening).toBe(false)
  })
})
