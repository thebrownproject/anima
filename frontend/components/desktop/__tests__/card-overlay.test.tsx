import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { useDesktopStore } from '@/lib/stores/desktop-store'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, ...rest } = props
      return <div {...rest}>{children}</div>
    },
  },
  AnimatePresence: ({ children }: any) => children,
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

vi.mock('@/hooks/use-momentum', () => ({
  useMomentum: () => ({
    trackVelocity: vi.fn(),
    releaseWithFlick: () => false,
    cancel: vi.fn(),
    isAnimating: () => false,
  }),
}))

import { CardOverlayProvider } from '../card-overlay'
import { DesktopCard } from '../desktop-card'
import { BlockRenderer } from '../block-renderer'

beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

const DOCUMENT_CARD = {
  id: 'card-doc-1',
  stackId: 'default',
  title: 'Q4 Report',
  blocks: [{ id: 'b1', type: 'text' as const, content: 'Full content here' }],
  size: 'medium' as const,
  position: { x: 0, y: 0 },
  zIndex: 1,
  cardType: 'document' as const,
}

const baseStoreState = {
  cards: { [DOCUMENT_CARD.id]: DOCUMENT_CARD },
  maxZIndex: 1,
  view: { x: 0, y: 0, scale: 1 },
  activeStackId: 'default',
  stacks: [],
  archivedStackIds: [],
  leftPanel: 'none' as const,
}

function TestHarness({ initialOpen = false }: { initialOpen?: boolean }) {
  const [overlayCardId, setOverlayCardId] = React.useState<string | null>(
    initialOpen ? DOCUMENT_CARD.id : null,
  )
  return (
    <CardOverlayProvider overlayCardId={overlayCardId} setOverlayCardId={setOverlayCardId}>
      <div data-testid="canvas">
        <DesktopCard card={DOCUMENT_CARD} onCardClick={() => setOverlayCardId(DOCUMENT_CARD.id)}>
          <BlockRenderer blocks={DOCUMENT_CARD.blocks} />
        </DesktopCard>
      </div>
    </CardOverlayProvider>
  )
}

import React from 'react'

describe('CardOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDesktopStore.setState(baseStoreState)
  })

  afterEach(() => {
    cleanup()
  })

  it('clicking template card opens overlay', () => {
    render(<TestHarness />)
    const overlay = screen.getByTestId('card-overlay')
    expect(overlay.className).toContain('opacity-0')

    // Click triggers onCardClick → sets overlayCardId
    act(() => {
      screen.getByTestId('card-drag-handle').dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 }),
      )
    })
    act(() => {
      screen.getByTestId('card-drag-handle').dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 11, clientY: 11 }),
      )
    })

    expect(screen.getByTestId('card-overlay').className).toContain('opacity-100')
  })

  it('close button closes overlay', () => {
    render(<TestHarness initialOpen />)
    expect(screen.getByTestId('card-overlay').className).toContain('opacity-100')

    act(() => { fireEvent.click(screen.getByTestId('overlay-close-button')) })

    expect(screen.getByTestId('card-overlay').className).toContain('opacity-0')
  })

  it('Escape key closes overlay', () => {
    render(<TestHarness initialOpen />)
    expect(screen.getByTestId('card-overlay').className).toContain('opacity-100')

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }) })

    expect(screen.getByTestId('card-overlay').className).toContain('opacity-0')
  })

  it('backdrop click closes overlay', () => {
    render(<TestHarness initialOpen />)
    expect(screen.getByTestId('card-overlay').className).toContain('opacity-100')

    act(() => { fireEvent.click(screen.getByTestId('overlay-backdrop')) })

    expect(screen.getByTestId('card-overlay').className).toContain('opacity-0')
  })

  it('card deletion while overlay open closes overlay automatically', () => {
    render(<TestHarness initialOpen />)
    expect(screen.getByTestId('card-overlay').className).toContain('opacity-100')

    act(() => {
      useDesktopStore.setState({ cards: {} })
    })

    expect(screen.getByTestId('card-overlay').className).toContain('opacity-0')
  })

  it('overlay renders card blocks', () => {
    render(<TestHarness initialOpen />)
    // editorial theme renders text blocks with text content visible in the panel
    expect(screen.getAllByText('Full content here').length).toBeGreaterThan(0)
  })

  it('overlay has aria-modal and role=dialog for accessibility', () => {
    render(<TestHarness initialOpen />)
    const overlay = screen.getByRole('dialog')
    expect(overlay).toBeDefined()
    expect(overlay.getAttribute('aria-modal')).toBe('true')
  })
})
