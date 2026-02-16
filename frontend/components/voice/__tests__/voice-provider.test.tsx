import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { type ReactNode } from 'react'
import { useVoiceStore } from '@/lib/stores/voice-store'
import { useChatStore } from '@/lib/stores/chat-store'

// --- Mocks (hoisted above imports) ---

const { mockStartListening, mockStopListening, mockSpeak, mockInterrupt, mockSend } =
  vi.hoisted(() => ({
    mockStartListening: vi.fn(),
    mockStopListening: vi.fn(),
    mockSpeak: vi.fn(),
    mockInterrupt: vi.fn(),
    mockSend: vi.fn(() => true),
    mockIsSpeaking: false,
  }))

let mockStatus = 'connected' as string
let mockIsSpeaking = false

vi.mock('../use-stt', () => ({
  useSTT: () => ({
    startListening: mockStartListening,
    stopListening: mockStopListening,
    isListening: false,
    error: null,
  }),
}))

vi.mock('../use-tts', () => ({
  useTTS: () => ({
    speak: mockSpeak,
    interrupt: mockInterrupt,
    get isSpeaking() { return mockIsSpeaking },
  }),
}))

vi.mock('../../desktop/ws-provider', () => ({
  useWebSocket: () => ({
    status: mockStatus,
    send: mockSend,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    debugLog: { current: [] },
  }),
}))

vi.mock('@/lib/voice-config', () => ({
  isVoiceEnabled: () => true,
}))

import { VoiceProvider, useVoice } from '../voice-provider'

// --- Helpers ---

function wrapper({ children }: { children: ReactNode }) {
  return <VoiceProvider>{children}</VoiceProvider>
}

const VOICE_STORE_DEFAULTS = {
  personaState: 'idle' as const,
  micEnabled: false,
  ttsEnabled: false,
  transcript: '',
}

const CHAT_STORE_DEFAULTS = {
  messages: [],
  chips: [],
  mode: 'bar' as const,
  isAgentStreaming: false,
}

// --- Tests ---

describe('VoiceProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: simulate instant WS open so existing tests pass through connecting -> listening
    mockStartListening.mockImplementation((onOpen?: () => void) => { onOpen?.() })
    mockStatus = 'connected'
    mockIsSpeaking = false
    useVoiceStore.setState(VOICE_STORE_DEFAULTS)
    useChatStore.setState(CHAT_STORE_DEFAULTS)
  })

  afterEach(() => {
    cleanup()
  })

  it('agent completion triggers TTS with full text when ttsEnabled and voice session active', async () => {
    useVoiceStore.setState({ ttsEnabled: true, personaState: 'idle' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // Start a voice session so voiceSessionRef is true
    await act(() => result.current.startVoice())
    // Simulate user sending message while voice session active (listening -> thinking)
    act(() => { useVoiceStore.getState().setPersonaState('thinking') })

    act(() => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'agent', content: 'First sentence. Second sentence! Third?', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })

    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).toHaveBeenCalledTimes(1)
    expect(mockSpeak).toHaveBeenCalledWith('First sentence. Second sentence! Third?')
  })

  it('agent completion does NOT trigger TTS when ttsEnabled false', () => {
    useVoiceStore.setState({ ttsEnabled: false, personaState: 'thinking' })
    useChatStore.setState({
      messages: [{ id: '1', role: 'agent', content: 'Here is the answer', timestamp: Date.now() }],
      isAgentStreaming: true,
    })

    renderHook(() => useVoice(), { wrapper })

    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).not.toHaveBeenCalled()
  })

  it('personaState transitions correctly through full voice flow', async () => {
    useVoiceStore.setState({ personaState: 'idle', ttsEnabled: true })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // idle -> connecting -> listening (onOpen fires synchronously in default mock)
    await act(() => result.current.startVoice())
    expect(useVoiceStore.getState().personaState).toBe('listening')

    // listening -> thinking (user sends message while voice session active)
    act(() => { useVoiceStore.getState().setPersonaState('thinking') })
    expect(useVoiceStore.getState().personaState).toBe('thinking')

    // thinking -> speaking (agent completion with tts + voice session active)
    act(() => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'agent', content: 'response', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })
    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })
    expect(useVoiceStore.getState().personaState).toBe('speaking')
    expect(mockSpeak).toHaveBeenCalledWith('response')

    // speaking -> idle (via interruptTTS)
    act(() => result.current.interruptTTS())
    expect(useVoiceStore.getState().personaState).toBe('idle')
  })

  it('WS disconnected sets personaState asleep', () => {
    useVoiceStore.setState({ personaState: 'idle' })

    renderHook(() => useVoice(), { wrapper })

    // Simulate disconnect
    act(() => {
      mockStatus = 'disconnected'
      // Re-render with new status -- force re-render by setting store
      useVoiceStore.setState({ micEnabled: useVoiceStore.getState().micEnabled })
    })

    // The effect runs on status change, but since we're mocking useWebSocket
    // we need to trigger a re-render that picks up the new status.
    // Let's use a different approach: unmount and remount with new status.
    cleanup()

    const { unmount } = renderHook(() => useVoice(), { wrapper })
    expect(useVoiceStore.getState().personaState).toBe('asleep')
    unmount()
  })

  it('stopRecordingOnly calls stopListening, sets idle, does NOT send message', () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: 'partial input' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    act(() => result.current.stopRecordingOnly())

    expect(mockStopListening).toHaveBeenCalled()
    expect(useVoiceStore.getState().personaState).toBe('idle')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('stopRecordingOnly does NOT clear voiceStore transcript', () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: 'keep this' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    act(() => result.current.stopRecordingOnly())

    expect(useVoiceStore.getState().transcript).toBe('keep this')
  })

  it('TTS triggers for typed messages when speaker is on', () => {
    // Speaker toggle on = TTS for ALL agent responses, regardless of input method
    useVoiceStore.setState({ ttsEnabled: true, personaState: 'thinking' })
    useChatStore.setState({
      messages: [{ id: '1', role: 'agent', content: 'Response to typed message', timestamp: Date.now() }],
      isAgentStreaming: true,
    })

    renderHook(() => useVoice(), { wrapper })

    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).toHaveBeenCalledWith('Response to typed message')
    expect(useVoiceStore.getState().personaState).toBe('speaking')
  })

  it('TTS DOES trigger for voice-initiated messages', async () => {
    useVoiceStore.setState({ personaState: 'idle', ttsEnabled: true })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // Start voice session (sets voiceSessionRef = true)
    await act(() => result.current.startVoice())

    // User sends message while voice session active (listening -> thinking)
    act(() => { useVoiceStore.getState().setPersonaState('thinking') })
    expect(useVoiceStore.getState().personaState).toBe('thinking')

    // Agent responds and completes streaming — TTS should fire
    act(() => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'agent', content: 'Voice response', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })

    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).toHaveBeenCalledWith('Voice response')
  })

  it('WS disconnect calls stopListening', () => {
    useVoiceStore.setState({ personaState: 'listening' })

    renderHook(() => useVoice(), { wrapper })

    cleanup()
    mockStatus = 'disconnected'

    renderHook(() => useVoice(), { wrapper })

    expect(mockStopListening).toHaveBeenCalled()
    expect(useVoiceStore.getState().personaState).toBe('asleep')
  })

  it('stopRecordingOnly does not prevent TTS when speaker is on', async () => {
    useVoiceStore.setState({ personaState: 'idle', ttsEnabled: true })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // Start voice -> stopRecordingOnly (cancel flow)
    await act(() => result.current.startVoice())
    act(() => result.current.stopRecordingOnly())

    // Simulate agent completing — TTS fires because speaker toggle is on
    act(() => {
      useVoiceStore.setState({ personaState: 'thinking', ttsEnabled: true })
    })
    act(() => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'agent', content: 'Should speak', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })
    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).toHaveBeenCalledWith('Should speak')
  })

  it('visual speaking when TTS disabled, real TTS when enabled mid-session', async () => {
    vi.useFakeTimers()
    useVoiceStore.setState({ personaState: 'idle', ttsEnabled: false })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // Start voice session, transition to thinking
    await act(() => result.current.startVoice())
    act(() => { useVoiceStore.getState().setPersonaState('thinking') })
    expect(useVoiceStore.getState().personaState).toBe('thinking')

    // Agent completes — TTS disabled, so thinking->speaking (visual) then idle after timer
    act(() => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'agent', content: 'Response', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })
    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).not.toHaveBeenCalled()
    expect(useVoiceStore.getState().personaState).toBe('speaking')
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(useVoiceStore.getState().personaState).toBe('idle')

    // Now enable TTS and start another agent cycle — SHOULD speak (speaker toggle is on)
    vi.clearAllMocks()
    act(() => {
      useVoiceStore.setState({ personaState: 'thinking', ttsEnabled: true })
    })
    act(() => {
      useChatStore.setState({
        messages: [{ id: '2', role: 'agent', content: 'Now with audio', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })
    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).toHaveBeenCalledWith('Now with audio')
    vi.useRealTimers()
  })

  it('cleanup on unmount stops listening and interrupts TTS', async () => {
    useVoiceStore.setState({ personaState: 'listening' })

    const { unmount } = renderHook(() => useVoice(), { wrapper })

    unmount()

    expect(mockStopListening).toHaveBeenCalled()
    expect(mockInterrupt).toHaveBeenCalled()
  })

  // --- Connecting state tests (m7b.4.15.15) ---

  it('startVoice() sets personaState to connecting', async () => {
    mockStartListening.mockImplementation(() => {}) // no onOpen
    useVoiceStore.setState({ personaState: 'idle' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    await act(() => result.current.startVoice())
    expect(useVoiceStore.getState().personaState).toBe('connecting')
  })

  it('after WS opens (onOpen), personaState transitions to listening', async () => {
    let capturedOnOpen: (() => void) | undefined
    mockStartListening.mockImplementation((onOpen?: () => void) => { capturedOnOpen = onOpen })
    useVoiceStore.setState({ personaState: 'idle' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    await act(() => result.current.startVoice())
    expect(useVoiceStore.getState().personaState).toBe('connecting')

    act(() => { capturedOnOpen?.() })
    expect(useVoiceStore.getState().personaState).toBe('listening')
  })

  it('stopRecordingOnly() from connecting transitions to idle', async () => {
    mockStartListening.mockImplementation(() => {}) // no onOpen — stay in connecting
    useVoiceStore.setState({ personaState: 'idle' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    await act(() => result.current.startVoice())
    expect(useVoiceStore.getState().personaState).toBe('connecting')

    act(() => result.current.stopRecordingOnly())
    expect(useVoiceStore.getState().personaState).toBe('idle')
  })

  it('full flow: idle -> connecting -> listening -> thinking -> speaking -> idle', async () => {
    let capturedOnOpen: (() => void) | undefined
    mockStartListening.mockImplementation((onOpen?: () => void) => { capturedOnOpen = onOpen })
    useVoiceStore.setState({ personaState: 'idle', ttsEnabled: true })

    const { result } = renderHook(() => useVoice(), { wrapper })

    await act(() => result.current.startVoice())
    expect(useVoiceStore.getState().personaState).toBe('connecting')

    act(() => { capturedOnOpen?.() })
    expect(useVoiceStore.getState().personaState).toBe('listening')

    act(() => { useVoiceStore.getState().setPersonaState('thinking') })
    expect(useVoiceStore.getState().personaState).toBe('thinking')

    act(() => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'agent', content: 'response', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })
    act(() => { useChatStore.setState({ isAgentStreaming: false }) })
    expect(useVoiceStore.getState().personaState).toBe('speaking')

    act(() => result.current.interruptTTS())
    expect(useVoiceStore.getState().personaState).toBe('idle')
  })
})
