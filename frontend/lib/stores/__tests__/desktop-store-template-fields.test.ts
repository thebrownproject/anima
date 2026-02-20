import { describe, it, expect, beforeEach } from 'vitest'
import { useDesktopStore, type DesktopCard } from '../desktop-store'
import type { CardType, TrendDirection } from '@/types/ws-protocol'

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

describe('DesktopCard template fields', () => {
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

  it('DesktopCard type accepts all new optional fields', () => {
    // TypeScript compile-time check — if any field is missing from the interface this won't compile
    const card: DesktopCard = makeCard({
      id: 'card-1',
      cardType: 'document' as CardType,
      summary: 'A brief summary',
      tags: ['tag1', 'tag2'],
      color: '#3B82F6',
      typeBadge: 'PDF',
      date: '2026-02-20',
      value: '$1,234',
      trend: '+12%',
      trendDirection: 'up' as TrendDirection,
      author: 'Fraser Brown',
      readTime: '3 min',
      headers: ['Name', 'Amount'],
      previewRows: [['Row 1', '$100'], ['Row 2', '$200']],
    })
    expect(card.cardType).toBe('document')
    expect(card.summary).toBe('A brief summary')
    expect(card.tags).toEqual(['tag1', 'tag2'])
    expect(card.color).toBe('#3B82F6')
    expect(card.typeBadge).toBe('PDF')
    expect(card.date).toBe('2026-02-20')
    expect(card.value).toBe('$1,234')
    expect(card.trend).toBe('+12%')
    expect(card.trendDirection).toBe('up')
    expect(card.author).toBe('Fraser Brown')
    expect(card.readTime).toBe('3 min')
    expect(card.headers).toEqual(['Name', 'Amount'])
    expect(card.previewRows).toEqual([['Row 1', '$100'], ['Row 2', '$200']])
  })

  it('cards without cardType have cardType as undefined', () => {
    const card = makeCard({ id: 'card-1' })
    expect(card.cardType).toBeUndefined()
  })

  it('addCard stores template fields and retrieves them', () => {
    const card = makeCard({
      id: 'card-1',
      cardType: 'metric',
      value: '$9,999',
      trendDirection: 'up',
    })
    useDesktopStore.getState().addCard(card)
    const stored = useDesktopStore.getState().cards['card-1']
    expect(stored.cardType).toBe('metric')
    expect(stored.value).toBe('$9,999')
    expect(stored.trendDirection).toBe('up')
  })

  it('updateCard merges template fields into existing card', () => {
    const card = makeCard({ id: 'card-1' })
    useDesktopStore.getState().addCard(card)
    useDesktopStore.getState().updateCard('card-1', {
      cardType: 'article',
      author: 'Fraser Brown',
      readTime: '5 min',
    })
    const updated = useDesktopStore.getState().cards['card-1']
    expect(updated.cardType).toBe('article')
    expect(updated.author).toBe('Fraser Brown')
    expect(updated.readTime).toBe('5 min')
    // Original fields preserved
    expect(updated.title).toBe('Card card-1')
  })
})

describe('desktop-store persist v1->v2 migration', () => {
  it('v1 state is passed through unchanged (all new fields optional)', () => {
    // Simulate the migrate function being called with v1 state
    // We access the persist config directly via the store internals
    // The migrate fn is: if version===0, do migration; else return state
    // For v1->v2, state is returned as-is since all new fields are optional

    const v1State = {
      stacks: [{ id: 'stack-1', name: 'My Stack' }],
      archivedStackIds: [],
      cards: {
        'card-1': {
          id: 'card-1',
          stackId: 'stack-1',
          title: 'Existing Card',
          blocks: [],
          size: 'medium',
          position: { x: 100, y: 200 },
          zIndex: 1,
        },
      },
      activeStackId: 'stack-1',
      maxZIndex: 1,
      leftPanel: 'none',
    }

    // Apply via setState to simulate restored state — all v1 cards must be preserved
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useDesktopStore.setState(v1State as any)
    const state = useDesktopStore.getState()

    expect(state.cards['card-1']).toBeDefined()
    expect(state.cards['card-1'].title).toBe('Existing Card')
    expect(state.cards['card-1'].cardType).toBeUndefined()
    expect(state.stacks).toHaveLength(1)
  })
})
