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
    json: async () => ({ token, expires_in: 30 }),
  })
}

function mockMicStream() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
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

    expect(mockFetch).toHaveBeenCalledWith('/api/voice/deepgram-token')
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
})
