import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { type ReactNode } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'
import { TooltipProvider } from '@/components/ui/tooltip'

// jsdom lacks scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

vi.mock('@/lib/voice-config', () => ({
  isVoiceEnabled: () => false,
}))

vi.mock('../../voice/voice-provider', () => ({
  useVoiceMaybe: () => null,
  useVoice: () => { throw new Error('no voice') },
}))

vi.mock('next/dynamic', () => ({
  default: () => {
    const Mock = () => <div data-testid="persona" />
    Mock.displayName = 'Mock'
    return Mock
  },
}))

vi.mock('../ws-provider', () => ({
  useWebSocket: () => ({
    status: 'connected',
    send: vi.fn(() => 'sent'),
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    debugLog: { current: [] },
  }),
}))

vi.mock('../../voice/voice-bars', () => ({
  VoiceBars: () => <div data-testid="voice-bars" />,
}))

import { ChatPanel } from '../chat-panel'

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}

function addMessage(role: 'user' | 'agent' | 'system', content: string) {
  useChatStore.setState((s) => ({
    messages: [...s.messages, { id: crypto.randomUUID(), role, content, timestamp: Date.now() }],
  }))
}

describe('ChatPanel markdown rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.setState({ messages: [], mode: 'panel', isAgentStreaming: false, draft: '', inputActive: false, chips: [] })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders **bold** as bold in agent messages', () => {
    addMessage('agent', 'This is **bold** text')
    render(<ChatPanel />, { wrapper: Wrapper })
    const strong = screen.getByText('bold')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders # Heading as heading in agent messages', () => {
    addMessage('agent', '# My Heading')
    render(<ChatPanel />, { wrapper: Wrapper })
    const heading = screen.getByText('My Heading')
    expect(heading.tagName).toBe('H1')
  })

  it('renders code blocks with monospace font', () => {
    addMessage('agent', '```\nconst x = 1\n```')
    render(<ChatPanel />, { wrapper: Wrapper })
    const code = screen.getByText('const x = 1')
    expect(code.tagName).toBe('CODE')
  })

  it('renders - list items as bullets', () => {
    addMessage('agent', '- item one\n- item two')
    render(<ChatPanel />, { wrapper: Wrapper })
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)
  })

  it('does not overflow the chat panel (prose has max-w-none)', () => {
    addMessage('agent', 'Some markdown content')
    render(<ChatPanel />, { wrapper: Wrapper })
    const prose = document.querySelector('.prose')
    expect(prose).toBeTruthy()
    expect(prose!.classList.contains('max-w-none')).toBe(true)
  })

  it('keeps user messages as plain text (no prose wrapper)', () => {
    addMessage('user', 'This is **not bold** for users')
    render(<ChatPanel />, { wrapper: Wrapper })
    const el = screen.getByText('This is **not bold** for users')
    expect(el.tagName).toBe('P')
    expect(el.closest('.prose')).toBeNull()
  })
})
