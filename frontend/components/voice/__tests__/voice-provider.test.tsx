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
    mockStatus = 'connected'
    mockIsSpeaking = false
    useVoiceStore.setState(VOICE_STORE_DEFAULTS)
    useChatStore.setState(CHAT_STORE_DEFAULTS)
  })

  afterEach(() => {
    cleanup()
  })

  it('STT transcript sent as chat message via WebSocket', async () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: 'hello agent' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    await act(() => result.current.stopVoice())

    // Should add user message to chat store
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].content).toBe('hello agent')

    // Should send via WS
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'mission',
        payload: expect.objectContaining({ text: 'hello agent' }),
      })
    )
  })

  it('agent completion triggers TTS with full text when ttsEnabled and voice session active', async () => {
    useVoiceStore.setState({ ttsEnabled: true, personaState: 'idle' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // Start a voice session so voiceSessionRef is true
    await act(() => result.current.startVoice())
    // Simulate stopVoice with transcript (sets thinking, keeps voiceSessionRef true)
    useVoiceStore.setState({ transcript: 'hello', personaState: 'listening' })
    await act(() => result.current.stopVoice())

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

    // idle -> listening (starts voice session)
    await act(() => result.current.startVoice())
    expect(useVoiceStore.getState().personaState).toBe('listening')

    // listening -> thinking (via stopVoice with transcript, voiceSessionRef stays true)
    useVoiceStore.setState({ transcript: 'test message', personaState: 'listening' })
    await act(() => result.current.stopVoice())
    expect(useVoiceStore.getState().personaState).toBe('thinking')

    // thinking -> speaking (via agent completion with tts + voice session active)
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

  it('TTS does NOT trigger for text-typed messages (no voice session)', () => {
    // Simulate agent completing response to a typed message (voiceSessionRef is false)
    useVoiceStore.setState({ ttsEnabled: true, personaState: 'thinking' })
    useChatStore.setState({
      messages: [{ id: '1', role: 'agent', content: 'Response to typed message', timestamp: Date.now() }],
      isAgentStreaming: true,
    })

    renderHook(() => useVoice(), { wrapper })

    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).not.toHaveBeenCalled()
    // Should still transition thinking -> idle
    expect(useVoiceStore.getState().personaState).toBe('idle')
  })

  it('TTS DOES trigger for voice-initiated messages', async () => {
    useVoiceStore.setState({ personaState: 'idle', ttsEnabled: true })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // Start voice session (sets voiceSessionRef = true)
    await act(() => result.current.startVoice())

    // stopVoice sends transcript, transitions to thinking, keeps voiceSessionRef true
    useVoiceStore.setState({ transcript: 'hello', personaState: 'listening' })
    await act(() => result.current.stopVoice())
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

  it('voiceSessionRef resets after stopRecordingOnly (no TTS fires)', async () => {
    useVoiceStore.setState({ personaState: 'idle', ttsEnabled: true })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // Start voice -> stopRecordingOnly -> voiceSessionRef is false
    await act(() => result.current.startVoice())
    act(() => result.current.stopRecordingOnly())

    // Simulate agent completing — TTS should NOT fire (voiceSessionRef is false)
    act(() => {
      useVoiceStore.setState({ personaState: 'thinking', ttsEnabled: true })
    })
    act(() => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'agent', content: 'Should not speak', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })
    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).not.toHaveBeenCalled()
  })

  it('voiceSessionRef resets when agent completes without TTS (thinking->idle)', async () => {
    useVoiceStore.setState({ personaState: 'idle', ttsEnabled: false })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // Start voice session, send message, but TTS is disabled
    await act(() => result.current.startVoice())
    useVoiceStore.setState({ transcript: 'test', personaState: 'listening' })
    await act(() => result.current.stopVoice())
    expect(useVoiceStore.getState().personaState).toBe('thinking')

    // Agent completes — TTS disabled, so thinking->idle resets voiceSessionRef
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
    expect(useVoiceStore.getState().personaState).toBe('idle')

    // Now enable TTS and start another agent cycle — should NOT speak
    // because voiceSessionRef was reset by the thinking->idle transition
    vi.clearAllMocks()
    act(() => {
      useVoiceStore.setState({ personaState: 'thinking', ttsEnabled: true })
    })
    act(() => {
      useChatStore.setState({
        messages: [{ id: '2', role: 'agent', content: 'Should not speak', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })
    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).not.toHaveBeenCalled()
  })

  it('cleanup on unmount stops listening and interrupts TTS', async () => {
    useVoiceStore.setState({ personaState: 'listening' })

    const { unmount } = renderHook(() => useVoice(), { wrapper })

    unmount()

    expect(mockStopListening).toHaveBeenCalled()
    expect(mockInterrupt).toHaveBeenCalled()
  })
})
