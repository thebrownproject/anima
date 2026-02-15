import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { useVoiceStore } from '@/lib/stores/voice-store'
import { GlassTooltipProvider } from '@/components/ui/glass-tooltip'
import type { ReactNode } from 'react'

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

function Wrapper({ children }: { children: ReactNode }) {
  return <GlassTooltipProvider>{children}</GlassTooltipProvider>
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

  // --- Rive state mapping ---

  it('maps voice state to visible Rive animation state', () => {
    renderOrb()
    // idle passes through as idle
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('idle')

    cleanup()
    useVoiceStore.setState({ personaState: 'listening' })
    renderOrb()
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('listening')

    cleanup()
    useVoiceStore.setState({ personaState: 'speaking' })
    renderOrb()
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('speaking')

    cleanup()
    useVoiceStore.setState({ personaState: 'thinking' })
    renderOrb()
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('thinking')
  })

  // --- Tap actions ---

  it('tap when idle calls startVoice', () => {
    useVoiceStore.setState({ personaState: 'idle' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStartVoice).toHaveBeenCalledOnce()
  })

  it('tap when listening calls stopVoice', () => {
    useVoiceStore.setState({ personaState: 'listening' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStopVoice).toHaveBeenCalledOnce()
  })

  it('tap when speaking calls interruptTTS', () => {
    useVoiceStore.setState({ personaState: 'speaking' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockInterruptTTS).toHaveBeenCalledOnce()
  })

  it('tap when asleep does nothing', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    renderOrb()
    fireEvent.click(screen.getByTestId('persona-orb'))
    expect(mockStartVoice).not.toHaveBeenCalled()
    expect(mockStopVoice).not.toHaveBeenCalled()
    expect(mockInterruptTTS).not.toHaveBeenCalled()
  })

  // --- Transcript preview ---

  it('shows transcript preview when listening with non-empty transcript', () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: 'hello world' })
    renderOrb()
    expect(screen.getByText('hello world')).toBeTruthy()
  })

  it('hides transcript preview when not listening', () => {
    useVoiceStore.setState({ personaState: 'idle', transcript: 'hello world' })
    renderOrb()
    expect(screen.queryByText('hello world')).toBeNull()
  })

  it('hides transcript preview when transcript is empty', () => {
    useVoiceStore.setState({ personaState: 'listening', transcript: '' })
    renderOrb()
    expect(screen.queryByTestId('transcript-preview')).toBeNull()
  })

  // --- Asleep state ---

  it('blocks pointer events when asleep but stays fully visible', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    renderOrb()
    const orb = screen.getByTestId('persona-orb')
    expect(orb.className).toContain('pointer-events-none')
    expect(orb.className).not.toContain('opacity')
  })

  it('maps asleep to idle Rive state', () => {
    useVoiceStore.setState({ personaState: 'asleep' })
    renderOrb()
    // toRiveState('asleep') returns 'idle'
    expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('idle')
  })
})
