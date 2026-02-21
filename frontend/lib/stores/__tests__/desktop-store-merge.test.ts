import { describe, it, expect, beforeEach } from 'vitest'
import { useDesktopStore, type DesktopCard } from '../desktop-store'

function makeCard(overrides: Partial<DesktopCard> & { id: string }): DesktopCard {
  return {
    stackId: 'default',
    title: `Card ${overrides.id}`,
    blocks: [],
    size: 'medium',
    position: { x: 100, y: 200 },
    zIndex: 1,
    ...overrides,
  }
}

describe('desktop-store mergeCards', () => {
  beforeEach(() => {
    useDesktopStore.setState({
      cards: {},
      maxZIndex: 0,
      view: { x: 0, y: 0, scale: 1 },
      activeStackId: 'default',
      stacks: [],
      archivedStackIds: [],
      leftPanel: 'none',
    })
  })

  it('existing cards with userPositioned keep their stored position', () => {
    const existing = makeCard({ id: 'card-1', position: { x: 500, y: 300 }, zIndex: 2, userPositioned: true })
    useDesktopStore.getState().setCards({ 'card-1': existing })

    const incoming = makeCard({ id: 'card-1', position: { x: 50, y: 50 }, zIndex: 1 })
    useDesktopStore.getState().mergeCards({ 'card-1': incoming })

    const result = useDesktopStore.getState().cards['card-1']
    expect(result.position).toEqual({ x: 500, y: 300 })
    expect(result.zIndex).toBe(2)
    expect(result.userPositioned).toBe(true)
  })

  it('existing cards without userPositioned get overwritten by incoming', () => {
    const existing = makeCard({ id: 'card-1', position: { x: 500, y: 300 } })
    useDesktopStore.getState().setCards({ 'card-1': existing })

    const incoming = makeCard({ id: 'card-1', position: { x: 50, y: 50 } })
    useDesktopStore.getState().mergeCards({ 'card-1': incoming })

    const result = useDesktopStore.getState().cards['card-1']
    expect(result.position).toEqual({ x: 50, y: 50 })
  })

  it('new cards (not in store) use incoming position', () => {
    const existing = makeCard({ id: 'card-1', position: { x: 500, y: 300 }, userPositioned: true })
    useDesktopStore.getState().setCards({ 'card-1': existing })

    const incoming = {
      'card-1': makeCard({ id: 'card-1', position: { x: 50, y: 50 } }),
      'card-2': makeCard({ id: 'card-2', position: { x: 200, y: 400 } }),
    }
    useDesktopStore.getState().mergeCards(incoming)

    const card2 = useDesktopStore.getState().cards['card-2']
    expect(card2).toBeDefined()
    expect(card2.position).toEqual({ x: 200, y: 400 })
  })

  it('removed cards (in store but not in incoming) get cleaned up', () => {
    const cards = {
      'card-1': makeCard({ id: 'card-1' }),
      'card-2': makeCard({ id: 'card-2' }),
    }
    useDesktopStore.getState().setCards(cards)

    const incoming = { 'card-1': makeCard({ id: 'card-1', position: { x: 50, y: 50 } }) }
    useDesktopStore.getState().mergeCards(incoming)

    const state = useDesktopStore.getState()
    expect(state.cards['card-1']).toBeDefined()
    expect(state.cards['card-2']).toBeUndefined()
  })

  it('cards at (0,0) with userPositioned keep their position (no sentinel bug)', () => {
    // A card legitimately positioned at (0,0) by the user should be preserved
    const existing = makeCard({ id: 'card-1', position: { x: 0, y: 0 }, userPositioned: true })
    useDesktopStore.getState().setCards({ 'card-1': existing })

    const incoming = makeCard({ id: 'card-1', position: { x: 300, y: 150 } })
    useDesktopStore.getState().mergeCards({ 'card-1': incoming })

    const result = useDesktopStore.getState().cards['card-1']
    expect(result.position).toEqual({ x: 0, y: 0 })
  })

  it('updates maxZIndex from merged result', () => {
    const existing = makeCard({ id: 'card-1', position: { x: 500, y: 300 }, zIndex: 5, userPositioned: true })
    useDesktopStore.getState().setCards({ 'card-1': existing })

    const incoming = {
      'card-1': makeCard({ id: 'card-1', position: { x: 50, y: 50 }, zIndex: 1 }),
      'card-2': makeCard({ id: 'card-2', position: { x: 200, y: 400 }, zIndex: 3 }),
    }
    useDesktopStore.getState().mergeCards(incoming)

    // card-1 keeps zIndex 5 (userPositioned), card-2 gets 3
    expect(useDesktopStore.getState().maxZIndex).toBe(5)
  })

  it('updates non-position fields from incoming (title, blocks, size)', () => {
    const existing = makeCard({ id: 'card-1', position: { x: 500, y: 300 }, title: 'Old Title', userPositioned: true })
    useDesktopStore.getState().setCards({ 'card-1': existing })

    const incoming = makeCard({ id: 'card-1', position: { x: 50, y: 50 }, title: 'New Title' })
    useDesktopStore.getState().mergeCards({ 'card-1': incoming })

    const result = useDesktopStore.getState().cards['card-1']
    expect(result.title).toBe('New Title')
    expect(result.position).toEqual({ x: 500, y: 300 })
  })

  it('moveCard sets userPositioned flag', () => {
    const card = makeCard({ id: 'card-1', position: { x: 100, y: 200 } })
    useDesktopStore.getState().setCards({ 'card-1': card })

    useDesktopStore.getState().moveCard('card-1', { x: 300, y: 400 })

    const result = useDesktopStore.getState().cards['card-1']
    expect(result.userPositioned).toBe(true)
  })
})
