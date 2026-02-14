import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { useVoiceStore } from '@/lib/stores/voice-store'

const { mockStartVoice, mockStopVoice, mockInterruptTTS } = vi.hoisted(() => ({
  mockStartVoice: vi.fn(),
  mockStopVoice: vi.fn(),
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
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona-placeholder')).toBeTruthy()
  })

  it('hides placeholder after Rive fires onReady', () => {
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona-placeholder')).toBeTruthy()
    act(() => capturedOnReady?.())
    expect(screen.queryByTestId('persona-placeholder')).toBeNull()
  })

  // --- Rive state mapping ---

  it('maps voice state to visible Rive animation state', () => {
    render(<PersonaOrb />)
    // idle maps to thinking (idle is invisible in Rive)
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('thinking')

    cleanup()
    useVoiceStore.setState({ personaState: 'listening' })
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('listening')

    cleanup()
    useVoiceStore.setState({ personaState: 'speaking' })
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('speaking')

    cleanup()
    useVoiceStore.setState({ personaState: 'thinking' })
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('thinking')
  })

  // --- Tap actions ---

  it('tap when idle calls startVoice', () => {
    useVoiceStore.setState({ personaState: 'idle' })
    render(<PersonaOrb />)
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStartVoice).toHaveBeenCalledOnce()
  })

  it('tap when listening calls stopVoice', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    render(<PersonaOrb />)
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStopVoice).toHaveBeenCalledOnce()
  })

  it('tap when speaking calls interruptTTS', () => {
    useVoiceStore.setState({ personaState: 'speaking' })
    render(<PersonaOrb />)
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockInterruptTTS).toHaveBeenCalledOnce()
  })

  it('tap when asleep does nothing', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    render(<PersonaOrb />)
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStartVoice).not.toHaveBeenCalled()
    expect(mockStopVoice).not.toHaveBeenCalled()
    expect(mockInterruptTTS).not.toHaveBeenCalled()
  })

  // --- Transcript preview ---

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

  // --- Asleep state ---

  it('blocks pointer events when asleep but stays fully visible', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    render(<PersonaOrb />)
    const orb = screen.getByTestId('persona-orb')
    expect(orb.className).toContain('pointer-events-none')
    expect(orb.className).not.toContain('opacity')
  })

  it('shows thinking animation when asleep', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    render(<PersonaOrb />)
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('thinking')
  })
})
