import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
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
  useMomentum: ({ onStop }: { onFrame: Function; onStop: Function }) => ({
    trackVelocity: vi.fn(),
    releaseWithFlick: () => false, // No momentum — syncToStore called directly
    cancel: vi.fn(),
    isAnimating: () => false,
  }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, ...rest } = props
      return <div {...rest}>{children}</div>
    },
  },
  AnimatePresence: ({ children }: any) => children,
}))

// jsdom lacks pointer capture APIs
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

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
    const sentMsg = mockSend.mock.calls[0][0]
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

    const sentMsg = mockSend.mock.calls[0][0]
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
