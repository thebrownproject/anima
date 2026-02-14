import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { useVoiceStore } from '@/lib/stores/voice-store'

const { mockStartVoice, mockStopVoice, mockInterruptTTS } = vi.hoisted(() => ({
  mockStartVoice: vi.fn(),
  mockStopVoice: vi.fn(),
  mockInterruptTTS: vi.fn(),
}))

// Mock next/dynamic to render the component synchronously
vi.mock('next/dynamic', () => ({
  default: (_loader: () => Promise<any>) => {
    // Return a component that renders a div with the state prop as data attr
    const MockPersona = (props: any) => (
      <div data-testid="persona" data-state={props.state} className={props.className} />
    )
    MockPersona.displayName = 'MockPersona'
    return MockPersona
  },
}))

vi.mock('../voice-provider', () => ({
  useVoice: () => ({
    startVoice: mockStartVoice,
    stopVoice: mockStopVoice,
    interruptTTS: mockInterruptTTS,
  }),
}))

import { PersonaOrb } from '../persona-orb'

const DEFAULTS = {
  personaState: 'idle' as const,
  micEnabled: true,
  ttsEnabled: true,
  transcript: '',
}

describe('PersonaOrb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useVoiceStore.setState(DEFAULTS)
  })

  afterEach(() => {
    cleanup()
  })

  // Test: Persona animation reflects personaState
  it('passes personaState to Persona component', () => {
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('idle')

    cleanup()
    useVoiceStore.setState({ personaState: 'listening' })
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('listening')

    cleanup()
    useVoiceStore.setState({ personaState: 'speaking' })
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('speaking')
  })

  // Test: Tap idle -> starts voice
  it('tap when idle calls startVoice', () => {
    useVoiceStore.setState({ personaState: 'idle' })
    render(<PersonaOrb />)
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStartVoice).toHaveBeenCalledOnce()
  })

  // Test: Tap listening -> stops voice
  it('tap when listening calls stopVoice', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    render(<PersonaOrb />)
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStopVoice).toHaveBeenCalledOnce()
  })

  // Test: Tap speaking -> interrupts TTS
  it('tap when speaking calls interruptTTS', () => {
    useVoiceStore.setState({ personaState: 'speaking' })
    render(<PersonaOrb />)
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockInterruptTTS).toHaveBeenCalledOnce()
  })

  // Test: Tap asleep -> does nothing (disabled)
  it('tap when asleep does nothing', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    render(<PersonaOrb />)
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStartVoice).not.toHaveBeenCalled()
    expect(mockStopVoice).not.toHaveBeenCalled()
    expect(mockInterruptTTS).not.toHaveBeenCalled()
  })

  // Test: Mic and TTS toggles independent
  it('mic toggle flips micEnabled without affecting ttsEnabled', () => {
    useVoiceStore.setState({ micEnabled: true, ttsEnabled: true })
    render(<PersonaOrb />)

    fireEvent.click(screen.getByLabelText('Toggle microphone'))
    expect(useVoiceStore.getState().micEnabled).toBe(false)
    expect(useVoiceStore.getState().ttsEnabled).toBe(true)
  })

  it('tts toggle flips ttsEnabled without affecting micEnabled', () => {
    useVoiceStore.setState({ micEnabled: true, ttsEnabled: true })
    render(<PersonaOrb />)

    fireEvent.click(screen.getByLabelText('Toggle speaker'))
    expect(useVoiceStore.getState().ttsEnabled).toBe(false)
    expect(useVoiceStore.getState().micEnabled).toBe(true)
  })

  // Test: Transcript preview shows during listening
  it('shows transcript preview when listening with non-empty transcript', () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: 'hello world' })
    render(<PersonaOrb />)
    expect(screen.getByText('hello world')).toBeTruthy()
  })

  it('hides transcript preview when not listening', () => {
    useVoiceStore.setState({ personaState: 'idle', transcript: 'hello world' })
    render(<PersonaOrb />)
    expect(screen.queryByText('hello world')).toBeNull()
  })

  it('hides transcript preview when transcript is empty', () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: '' })
    render(<PersonaOrb />)
    expect(screen.queryByTestId('transcript-preview')).toBeNull()
  })

  it('renders as disabled/greyed when asleep', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    render(<PersonaOrb />)
    const orb = screen.getByTestId('persona-orb')
    expect(orb.className).toContain('opacity-50')
    expect(orb.className).toContain('pointer-events-none')
  })
})
