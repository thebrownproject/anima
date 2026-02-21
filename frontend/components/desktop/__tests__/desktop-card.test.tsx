import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { useDesktopStore } from '@/lib/stores/desktop-store'

const mockSend = vi.fn(() => true)

vi.mock('../ws-provider', () => ({
  useWebSocket: () => ({
    status: 'connected',
    send: mockSend,
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

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: Record<string, unknown>) => {
      const { children, initial, animate, exit, transition, ...rest } = props
      void initial; void animate; void exit; void transition
      return <div {...rest}>{children as React.ReactNode}</div>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

// jsdom lacks pointer capture APIs
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

// Mock template components so tests don't need to render their full trees
vi.mock('@/components/desktop/cards', () => ({
  DocumentCard: ({ card }: { card: { title: string } }) => <div data-testid="document-card">{card.title}</div>,
  MetricCard: ({ card }: { card: { title: string } }) => <div data-testid="metric-card">{card.title}</div>,
  TableCard: ({ card }: { card: { title: string } }) => <div data-testid="table-card">{card.title}</div>,
  ArticleCard: ({ card }: { card: { title: string } }) => <div data-testid="article-card">{card.title}</div>,
  DataCard: ({ card }: { card: { title: string } }) => <div data-testid="data-card">{card.title}</div>,
}))

import { DesktopCard } from '../desktop-card'

const TEST_CARD = {
  id: 'card-test-1',
  stackId: 'default',
  title: 'Test Card',
  blocks: [],
  size: 'medium' as const,
  position: { x: 200, y: 150 },
  zIndex: 3,
}

const DOCUMENT_CARD = {
  ...TEST_CARD,
  id: 'card-doc-1',
  title: 'Document Card',
  cardType: 'document' as const,
}

describe('DesktopCard WS move message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDesktopStore.setState({
      cards: { [TEST_CARD.id]: TEST_CARD },
      maxZIndex: 3,
      view: { x: 0, y: 0, scale: 1 },
      activeStackId: 'default',
      stacks: [],
      archivedStackIds: [],
      leftPanel: 'none',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('sends canvas_interaction move message on drag end (no flick)', () => {
    render(<DesktopCard card={TEST_CARD} />)
    const dragHandle = screen.getByTestId('card-drag-handle')

    // Each event in its own act() so React flushes setIsDragging between them
    act(() => { fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 100, clientY: 100 }) })
    act(() => { fireEvent.pointerMove(dragHandle, { pointerId: 1, movementX: 50, movementY: 30 }) })
    act(() => { fireEvent.pointerUp(dragHandle, { pointerId: 1 }) })

    expect(mockSend).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sentMsg: any = (mockSend.mock.calls as any[][])[0][0]
    expect(sentMsg.type).toBe('canvas_interaction')
    expect(sentMsg.payload.action).toBe('move')
    expect(sentMsg.payload.card_id).toBe('card-test-1')
  })

  it('move message includes position_x, position_y, z_index in data', () => {
    render(<DesktopCard card={TEST_CARD} />)
    const dragHandle = screen.getByTestId('card-drag-handle')

    act(() => { fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 100, clientY: 100 }) })
    act(() => { fireEvent.pointerMove(dragHandle, { pointerId: 1, movementX: 10, movementY: 10 }) })
    act(() => { fireEvent.pointerUp(dragHandle, { pointerId: 1 }) })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sentMsg: any = (mockSend.mock.calls as any[][])[0][0]
    expect(sentMsg.payload.data).toHaveProperty('position_x')
    expect(sentMsg.payload.data).toHaveProperty('position_y')
    expect(sentMsg.payload.data).toHaveProperty('z_index')
    expect(typeof sentMsg.payload.data.position_x).toBe('number')
    expect(typeof sentMsg.payload.data.position_y).toBe('number')
    expect(typeof sentMsg.payload.data.z_index).toBe('number')
  })

  it('does not send move message during drag (only on end)', () => {
    render(<DesktopCard card={TEST_CARD} />)
    const dragHandle = screen.getByTestId('card-drag-handle')

    act(() => { fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 100, clientY: 100 }) })
    act(() => { fireEvent.pointerMove(dragHandle, { pointerId: 1, movementX: 10, movementY: 10 }) })
    act(() => { fireEvent.pointerMove(dragHandle, { pointerId: 1, movementX: 20, movementY: 20 }) })
    act(() => { fireEvent.pointerMove(dragHandle, { pointerId: 1, movementX: 30, movementY: 30 }) })

    // No send during drag
    expect(mockSend).not.toHaveBeenCalled()

    // Send on drag end
    act(() => { fireEvent.pointerUp(dragHandle, { pointerId: 1 }) })
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})

describe('DesktopCard click discrimination', () => {
  const mockClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useDesktopStore.setState({
      cards: { [TEST_CARD.id]: TEST_CARD },
      maxZIndex: 3,
      view: { x: 0, y: 0, scale: 1 },
      activeStackId: 'default',
      stacks: [],
      archivedStackIds: [],
      leftPanel: 'none',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('calls onCardClick when pointer travel < 5px', () => {
    render(<DesktopCard card={TEST_CARD} onCardClick={mockClick} />)
    const dragHandle = screen.getByTestId('card-drag-handle')

    act(() => { fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 100, clientY: 100 }) })
    act(() => { fireEvent.pointerUp(dragHandle, { pointerId: 1, clientX: 102, clientY: 101 }) })

    expect(mockClick).toHaveBeenCalledTimes(1)
    expect(mockClick).toHaveBeenCalledWith(TEST_CARD)
    // No WS move sent for a click
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('does not call onCardClick when pointer travel >= 5px', () => {
    render(<DesktopCard card={TEST_CARD} onCardClick={mockClick} />)
    const dragHandle = screen.getByTestId('card-drag-handle')

    act(() => { fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 100, clientY: 100 }) })
    act(() => { fireEvent.pointerMove(dragHandle, { pointerId: 1, movementX: 10, movementY: 10 }) })
    act(() => { fireEvent.pointerUp(dragHandle, { pointerId: 1, clientX: 110, clientY: 110 }) })

    expect(mockClick).not.toHaveBeenCalled()
    expect(mockSend).toHaveBeenCalledTimes(1) // move message sent instead
  })
})

describe('DesktopCard close behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDesktopStore.setState({
      cards: { [TEST_CARD.id]: TEST_CARD },
      maxZIndex: 3,
      view: { x: 0, y: 0, scale: 1 },
      activeStackId: 'default',
      stacks: [],
      archivedStackIds: [],
      leftPanel: 'none',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('removes card from store immediately on close (optimistic)', () => {
    render(<DesktopCard card={TEST_CARD} />)
    const closeBtn = screen.getByTitle('Close')

    act(() => { fireEvent.click(closeBtn) })

    expect(useDesktopStore.getState().cards[TEST_CARD.id]).toBeUndefined()
  })

  it('sends canvas_interaction with archive_card on close', () => {
    render(<DesktopCard card={TEST_CARD} />)
    const closeBtn = screen.getByTitle('Close')

    act(() => { fireEvent.click(closeBtn) })

    expect(mockSend).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sentMsg: any = (mockSend.mock.calls as any[][])[0][0]
    expect(sentMsg.type).toBe('canvas_interaction')
    expect(sentMsg.payload.card_id).toBe(TEST_CARD.id)
    expect(sentMsg.payload.action).toBe('archive_card')
    expect(sentMsg.payload.data).toEqual({})
  })
})

describe('DesktopCard template dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDesktopStore.setState({
      cards: {
        [TEST_CARD.id]: TEST_CARD,
        [DOCUMENT_CARD.id]: DOCUMENT_CARD,
      },
      maxZIndex: 3,
      view: { x: 0, y: 0, scale: 1 },
      activeStackId: 'default',
      stacks: [],
      archivedStackIds: [],
      leftPanel: 'none',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('card with cardType="document" renders DocumentCard', () => {
    render(<DesktopCard card={DOCUMENT_CARD} />)
    expect(screen.getByTestId('document-card')).toBeDefined()
    expect(screen.queryByRole('heading', { name: /Test Card/i })).toBeNull()
  })

  it('card with no cardType renders default Card fallback', () => {
    render(<DesktopCard card={TEST_CARD} />)
    // Default path: title bar h-11 with card title text
    expect(screen.getByText('Test Card')).toBeDefined()
    expect(screen.queryByTestId('document-card')).toBeNull()
    expect(screen.queryByTestId('base-card')).toBeNull()
  })
})
