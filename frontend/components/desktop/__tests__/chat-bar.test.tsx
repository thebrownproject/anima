import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { type ReactNode } from 'react'
import { useVoiceStore } from '@/lib/stores/voice-store'
import { useChatStore } from '@/lib/stores/chat-store'
import { GlassTooltipProvider } from '@/components/ui/glass-tooltip'

const { mockStopRecordingOnly } = vi.hoisted(() => ({
  mockStopRecordingOnly: vi.fn(),
}))

let mockVoiceEnabled = false

vi.mock('@/lib/voice-config', () => ({
  isVoiceEnabled: () => mockVoiceEnabled,
}))

const mockVoiceCtx = () => mockVoiceEnabled
  ? { startVoice: vi.fn(), stopVoice: vi.fn(), stopRecordingOnly: mockStopRecordingOnly, interruptTTS: vi.fn(), analyser: null }
  : null

vi.mock('../../voice/voice-provider', () => ({
  useVoiceMaybe: () => mockVoiceCtx(),
  useVoice: () => {
    const ctx = mockVoiceCtx()
    if (!ctx) throw new Error('useVoice must be used within VoiceProvider')
    return ctx
  },
}))

vi.mock('next/dynamic', () => ({
  default: (_loader: () => Promise<any>) => {
    const MockPersona = (props: any) => (
      <div data-testid="persona" data-state={props.state} className={props.className} />
    )
    MockPersona.displayName = 'MockPersona'
    return MockPersona
  },
}))

vi.mock('../ws-provider', () => ({
  useWebSocket: () => ({
    status: 'connected',
    send: vi.fn(() => true),
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    debugLog: { current: [] },
  }),
}))

import { ChatBar } from '../chat-bar'

function Wrapper({ children }: { children: ReactNode }) {
  return <GlassTooltipProvider>{children}</GlassTooltipProvider>
}

const VOICE_STORE_DEFAULTS = {
  personaState: 'asleep' as const,
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

describe('ChatBar voice integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVoiceEnabled = false
    useVoiceStore.setState(VOICE_STORE_DEFAULTS)
    useChatStore.setState(CHAT_STORE_DEFAULTS)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders PersonaOrb when voice enabled', () => {
    mockVoiceEnabled = true
    render(<ChatBar />, { wrapper: Wrapper })
    expect(screen.getByTestId('persona-orb')).toBeTruthy()
  })

  it('renders mic button when voice disabled', () => {
    mockVoiceEnabled = false
    render(<ChatBar />, { wrapper: Wrapper })
    expect(screen.queryByTestId('persona-orb')).toBeNull()
    expect(screen.queryByTestId('mic-button')).toBeTruthy()
  })

  it('typing during listening calls stopRecordingOnly', () => {
    mockVoiceEnabled = true
    useVoiceStore.setState({ personaState: 'listening' })
    render(<ChatBar />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'hello' } })

    expect(mockStopRecordingOnly).toHaveBeenCalledOnce()
  })

  it('typing when not listening does not call stopRecordingOnly', () => {
    mockVoiceEnabled = true
    useVoiceStore.setState({ personaState: 'idle' })
    render(<ChatBar />, { wrapper: Wrapper })

    const placeholder = screen.getByText('Ask anything...')
    fireEvent.click(placeholder)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'hello' } })

    expect(mockStopRecordingOnly).not.toHaveBeenCalled()
  })

  it('typing when voice disabled does not throw', () => {
    mockVoiceEnabled = false
    render(<ChatBar />, { wrapper: Wrapper })

    const placeholder = screen.getByText('Ask anything...')
    fireEvent.click(placeholder)

    const textarea = screen.getByRole('textbox')
    expect(() => {
      fireEvent.change(textarea, { target: { value: 'hello' } })
    }).not.toThrow()
  })

  it('Enter key sends message', () => {
    render(<ChatBar />, { wrapper: Wrapper })

    const placeholder = screen.getByText('Ask anything...')
    fireEvent.click(placeholder)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('test message')
  })

  it('Shift+Enter does not send message', () => {
    render(<ChatBar />, { wrapper: Wrapper })

    const placeholder = screen.getByText('Ask anything...')
    fireEvent.click(placeholder)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(0)
  })
})

describe('ChatBar transcript wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVoiceEnabled = true
    useVoiceStore.setState({ ...VOICE_STORE_DEFAULTS, personaState: 'idle' })
    useChatStore.setState(CHAT_STORE_DEFAULTS)
  })

  afterEach(() => {
    cleanup()
  })

  it('transcript appears in textarea during recording', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    render(<ChatBar />, { wrapper: Wrapper })

    // Simulate STT producing text
    act(() => {
      useVoiceStore.setState({ transcript: 'hello' })
    })

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('hello')

    // More text arrives
    act(() => {
      useVoiceStore.setState({ transcript: 'hello world' })
    })

    expect(textarea.value).toBe('hello world')
  })

  it('Escape during recording calls stopRecordingOnly', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    render(<ChatBar />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(mockStopRecordingOnly).toHaveBeenCalledOnce()
  })

  it('handleSend during recording stops STT first', () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: 'voice text' })
    render(<ChatBar />, { wrapper: Wrapper })

    // Transcript populates textarea
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('voice text')

    // Send message
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(mockStopRecordingOnly).toHaveBeenCalled()
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('voice text')
  })
})

describe('ChatBar inline pill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVoiceEnabled = true
    useVoiceStore.setState({ ...VOICE_STORE_DEFAULTS, personaState: 'idle' })
    useChatStore.setState(CHAT_STORE_DEFAULTS)
  })

  afterEach(() => {
    cleanup()
  })

  it('pill hidden when not hovered and not recording', () => {
    render(<ChatBar />, { wrapper: Wrapper })
    const pill = screen.getByTestId('voice-pill')
    expect(pill.className).toContain('opacity-0')
  })

  it('pill shows speaker+stop+bars during recording', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    render(<ChatBar />, { wrapper: Wrapper })

    const pill = screen.getByTestId('voice-pill')
    expect(pill.className).toContain('opacity-100')
    expect(screen.getByTestId('stop-recording-button')).toBeTruthy()
  })

  it('stop button calls stopRecordingOnly', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    render(<ChatBar />, { wrapper: Wrapper })

    const stopBtn = screen.getByTestId('stop-recording-button')
    fireEvent.click(stopBtn.querySelector('button')!)

    expect(mockStopRecordingOnly).toHaveBeenCalledOnce()
  })

  it('pill becomes visible on hover after delay', () => {
    vi.useFakeTimers()
    render(<ChatBar />, { wrapper: Wrapper })

    const pill = screen.getByTestId('voice-pill')
    expect(pill.className).toContain('opacity-0')

    // Hover over the pill area
    fireEvent.mouseEnter(pill.parentElement!)

    // Not visible yet (400ms delay)
    expect(pill.className).toContain('opacity-0')

    // Advance past delay
    act(() => { vi.advanceTimersByTime(400) })

    expect(pill.className).toContain('opacity-100')

    // Mouse leave + delay hides it
    fireEvent.mouseLeave(pill.parentElement!)
    act(() => { vi.advanceTimersByTime(400) })

    expect(pill.className).toContain('opacity-0')

    vi.useRealTimers()
  })

  it('no mic toggle rendered in pill', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    render(<ChatBar />, { wrapper: Wrapper })

    // Check no microphone icons exist inside pill
    const pill = screen.getByTestId('voice-pill')
    expect(pill.querySelector('[data-testid="mic-button"]')).toBeNull()
  })

  it('embedded mode renders correctly', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    render(<ChatBar embedded />, { wrapper: Wrapper })

    const pill = screen.getByTestId('voice-pill')
    expect(pill.className).toContain('opacity-100')
  })
})
