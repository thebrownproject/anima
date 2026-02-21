import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { type ReactNode } from 'react'
import { useVoiceStore } from '@/lib/stores/voice-store'
import { TooltipProvider } from '@/components/ui/tooltip'

const { mockStartVoice, mockStopRecordingOnly, mockInterruptTTS } = vi.hoisted(() => ({
  mockStartVoice: vi.fn(),
  mockStopRecordingOnly: vi.fn(),
  mockInterruptTTS: vi.fn(),
}))

let capturedOnReady: (() => void) | undefined

vi.mock('next/dynamic', () => ({
  default: (_loader: () => Promise<any>) => {
    function MockPersona(props: any) {
      capturedOnReady = props.onReady
      return <div data-testid="persona" data-state={props.state} className={props.className} />
    }
    MockPersona.displayName = 'MockPersona'
    return MockPersona
  },
}))

vi.mock('../voice-provider', () => ({
  useVoice: () => ({
    startVoice: mockStartVoice,
    stopRecordingOnly: mockStopRecordingOnly,
    interruptTTS: mockInterruptTTS,
  }),
}))

import { PersonaOrb, orbTooltip } from '../persona-orb'

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}

function renderOrb(props?: Parameters<typeof PersonaOrb>[0]) {
  return render(<PersonaOrb {...props} />, { wrapper: Wrapper })
}

const DEFAULTS = {
  personaState: 'idle' as const,
  micEnabled: true,
  ttsEnabled: true,
  transcript: '',
}

// In test env, requestAnimationFrame is async — stub to fire sync so Rive mounts immediately
const origRAF = globalThis.requestAnimationFrame
beforeAll(() => {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0 }
})
afterAll(() => {
  globalThis.requestAnimationFrame = origRAF
})

describe('PersonaOrb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnReady = undefined
    useVoiceStore.setState(DEFAULTS)
  })

  afterEach(() => {
    cleanup()
  })

  // --- Placeholder ---

  it('shows placeholder before Rive is ready', () => {
    renderOrb()
    expect(screen.getByTestId('persona-placeholder')).toBeTruthy()
  })

  it('hides placeholder after Rive fires onReady', () => {
    renderOrb()
    expect(screen.getByTestId('persona-placeholder')).toBeTruthy()
    act(() => capturedOnReady?.())
    expect(screen.queryByTestId('persona-placeholder')).toBeNull()
  })

  // --- No inline UI ---

  it('does not render inline controls or transcript text', () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: 'hello world' })
    renderOrb()
    expect(screen.queryByText('hello world')).toBeNull()
    expect(screen.queryByText('Listening...')).toBeNull()
  })

  // --- Tap actions ---

  it('tap when idle + no text calls startVoice', () => {
    useVoiceStore.setState({ personaState: 'idle' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStartVoice).toHaveBeenCalledOnce()
  })

  it('tap when idle + hasText calls onSendMessage', () => {
    useVoiceStore.setState({ personaState: 'idle' })
    const mockSend = vi.fn()
    renderOrb({ hasText: true, onSendMessage: mockSend })
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockStartVoice).not.toHaveBeenCalled()
  })

  it('tap when listening + no text calls stopRecordingOnly', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStopRecordingOnly).toHaveBeenCalledOnce()
  })

  it('tap when listening + hasText calls onSendMessage', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    const mockSend = vi.fn()
    renderOrb({ hasText: true, onSendMessage: mockSend })
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockStopRecordingOnly).not.toHaveBeenCalled()
  })

  it('tap when speaking calls interruptTTS', () => {
    useVoiceStore.setState({ personaState: 'speaking' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockInterruptTTS).toHaveBeenCalledOnce()
  })

  it('tap when asleep does nothing (pointer-events-none)', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStartVoice).not.toHaveBeenCalled()
    expect(mockStopRecordingOnly).not.toHaveBeenCalled()
    expect(mockInterruptTTS).not.toHaveBeenCalled()
  })

  // --- Asleep state ---

  it('blocks pointer events when asleep', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    renderOrb()
    const orb = screen.getByTestId('persona-orb')
    expect(orb.className).toContain('pointer-events-none')
  })

  it('maps asleep to idle Rive state', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    renderOrb()
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('idle')
  })

  // --- Connecting state ---

  it('maps connecting to listening Rive state', () => {
    useVoiceStore.setState({ personaState: 'connecting' })
    renderOrb()
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('listening')
  })

  it('shows Connecting... tooltip for connecting state', () => {
    expect(orbTooltip('connecting')).toBe('Connecting...')
  })

  it('tap when connecting + no text calls stopRecordingOnly', () => {
    useVoiceStore.setState({ personaState: 'connecting' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStopRecordingOnly).toHaveBeenCalledOnce()
  })

  it('tap when connecting + hasText calls onSendMessage', () => {
    useVoiceStore.setState({ personaState: 'connecting' })
    const mockSend = vi.fn()
    renderOrb({ hasText: true, onSendMessage: mockSend })
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockStopRecordingOnly).not.toHaveBeenCalled()
  })

  it('orb is interactive during connecting (no pointer-events-none)', () => {
    useVoiceStore.setState({ personaState: 'connecting' })
    renderOrb()
    const orb = screen.getByTestId('persona-orb')
    expect(orb.className).not.toContain('pointer-events-none')
  })
})
