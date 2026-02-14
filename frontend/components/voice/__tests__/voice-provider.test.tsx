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

import { VoiceProvider, useVoice, MaybeVoiceProvider } from '../voice-provider'

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

  it('agent completion triggers TTS when ttsEnabled', () => {
    useVoiceStore.setState({ ttsEnabled: true, personaState: 'thinking' })
    useChatStore.setState({
      messages: [{ id: '1', role: 'agent', content: 'Here is the answer', timestamp: Date.now() }],
      isAgentStreaming: true,
    })

    renderHook(() => useVoice(), { wrapper })

    // Simulate agent completion: isAgentStreaming true -> false
    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })

    expect(mockSpeak).toHaveBeenCalledWith('Here is the answer')
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

  it('personaState transitions correctly through full flow', async () => {
    useVoiceStore.setState({ personaState: 'idle' })

    const { result } = renderHook(() => useVoice(), { wrapper })

    // idle -> listening
    await act(() => result.current.startVoice())
    expect(useVoiceStore.getState().personaState).toBe('listening')

    // listening -> thinking (via stopVoice with transcript)
    useVoiceStore.setState({ transcript: 'test message', personaState: 'listening' })
    await act(() => result.current.stopVoice())
    expect(useVoiceStore.getState().personaState).toBe('thinking')

    // thinking -> speaking (via agent completion with tts)
    useVoiceStore.setState({ ttsEnabled: true })
    // Set streaming true first so prevRef captures it
    act(() => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'agent', content: 'response', timestamp: Date.now() }],
        isAgentStreaming: true,
      })
    })
    // Then flip to false -- prevRef was true, now false triggers TTS
    act(() => {
      useChatStore.setState({ isAgentStreaming: false })
    })
    expect(useVoiceStore.getState().personaState).toBe('speaking')

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

  it('cleanup on unmount stops listening and interrupts TTS', async () => {
    useVoiceStore.setState({ personaState: 'listening' })

    const { unmount } = renderHook(() => useVoice(), { wrapper })

    unmount()

    expect(mockStopListening).toHaveBeenCalled()
    expect(mockInterrupt).toHaveBeenCalled()
  })
})
