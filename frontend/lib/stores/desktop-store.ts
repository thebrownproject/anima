import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { Block, CardSize, CardType, StackInfo, TrendDirection } from '@/types/ws-protocol'

export const CARD_WIDTHS: Record<CardSize, number> = {
  small: 280,
  medium: 380,
  large: 560,
  full: 800,
}

export const TEMPLATE_WIDTHS: Record<CardType, number> = {
  document: 400,
  metric: 300,
  table: 600,
  article: 500,
  data: 400,
}

// World bounds — cards and viewport are clamped to this area (16:9 for widescreen monitors)
export const WORLD_WIDTH = 8000
export const WORLD_HEIGHT = 4000
export const CARD_WIDTH = CARD_WIDTHS.medium // backward compat
const CARD_H_DEFAULT = 500

export const GRID_SIZE = 20 // px — snap granularity for card drop positions

export function snapToGrid(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(y / GRID_SIZE) * GRID_SIZE,
  }
}

/** Clamp a card position within world bounds.
 *  Pass cardHeight/cardWidth for pixel-perfect clamping during drag. */
export function clampCardPosition(x: number, y: number, cardHeight?: number, cardWidth?: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(WORLD_WIDTH - (cardWidth ?? CARD_WIDTH), x)),
    y: Math.max(0, Math.min(WORLD_HEIGHT - (cardHeight ?? CARD_H_DEFAULT), y)),
  }
}

export interface DesktopCard {
  id: string
  stackId: string
  title: string
  blocks: Block[]
  size: CardSize
  position: { x: number; y: number }
  zIndex: number
  cardType?: CardType
  summary?: string
  tags?: string[]
  color?: string
  typeBadge?: string
  date?: string
  value?: string
  trend?: string
  trendDirection?: TrendDirection
  author?: string
  readTime?: string
  headers?: string[]
  previewRows?: unknown[][]
  userPositioned?: boolean
}

export interface ViewState {
  x: number
  y: number
  scale: number
}

export type LeftPanel = 'none' | 'documents'

interface DesktopState {
  stacks: StackInfo[]
  archivedStackIds: string[]
  cards: Record<string, DesktopCard>
  view: ViewState
  activeStackId: string
  maxZIndex: number
  leftPanel: LeftPanel
  expandedCardId: string | null
}

interface DesktopActions {
  // Stack actions
  setStacks: (stacks: StackInfo[]) => void
  addStack: (stack: StackInfo) => void
  archiveStack: (id: string) => void
  restoreStack: (id: string) => void
  renameStack: (id: string, name: string) => void
  setActiveStackId: (stackId: string) => void

  // Card actions
  setCards: (cards: Record<string, DesktopCard>) => void
  mergeCards: (cards: Record<string, DesktopCard>) => void
  addCard: (card: DesktopCard) => void
  updateCard: (id: string, updates: Partial<Omit<DesktopCard, 'id'>>) => void
  removeCard: (id: string) => void
  moveCard: (id: string, position: { x: number; y: number }, cardHeight?: number, cardWidth?: number) => void
  bringToFront: (id: string) => void

  // View actions
  setView: (view: Partial<ViewState>) => void
  setLeftPanel: (panel: LeftPanel) => void
  toggleLeftPanel: (panel: LeftPanel) => void

  // Expansion
  setExpandedCardId: (id: string | null) => void
}

export const useDesktopStore = create<DesktopState & DesktopActions>()(
  persist(
    (set) => ({
      stacks: [],
      archivedStackIds: [],
      cards: {},
      view: { x: 0, y: 0, scale: 1 },
      activeStackId: 'default',
      maxZIndex: 0,
      leftPanel: 'none' as LeftPanel,
      expandedCardId: null,

      // Stack actions
      setStacks: (stacks) => set({ stacks }),

      addStack: (stack) =>
        set((state) => ({ stacks: [...state.stacks, stack] })),

      archiveStack: (id) =>
        set((state) => {
          const archivedStackIds = [...state.archivedStackIds, id]
          // Remove cards belonging to this stack
          const cards: Record<string, DesktopCard> = {}
          for (const [cardId, card] of Object.entries(state.cards)) {
            if (card.stackId !== id) cards[cardId] = card
          }
          // If archiving the active stack, switch to first non-archived stack
          let { activeStackId } = state
          if (activeStackId === id) {
            const remaining = state.stacks.find(
              (s) => s.id !== id && !archivedStackIds.includes(s.id)
            )
            activeStackId = remaining?.id ?? 'default'
          }
          return { archivedStackIds, cards, activeStackId }
        }),

      restoreStack: (id) =>
        set((state) => ({
          archivedStackIds: state.archivedStackIds.filter((sid) => sid !== id),
        })),

      renameStack: (id, name) =>
        set((state) => ({
          stacks: state.stacks.map((s) =>
            s.id === id ? { ...s, name } : s
          ),
        })),

      setActiveStackId: (stackId) => set({ activeStackId: stackId }),

      // Card actions
      setCards: (cards) => {
        let maxZ = 0
        for (const card of Object.values(cards)) {
          if (card.zIndex > maxZ) maxZ = card.zIndex
        }
        set({ cards, maxZIndex: maxZ })
      },

      mergeCards: (incoming) =>
        set((state) => {
          const merged: Record<string, DesktopCard> = {}
          let maxZ = 0
          for (const [id, card] of Object.entries(incoming)) {
            const existing = state.cards[id]
            merged[id] = existing?.userPositioned
              ? { ...card, position: existing.position, zIndex: existing.zIndex, userPositioned: true }
              : card
            if (merged[id].zIndex > maxZ) maxZ = merged[id].zIndex
          }
          return { cards: merged, maxZIndex: maxZ }
        }),

      addCard: (card) =>
        set((state) => {
          const width = card.cardType ? TEMPLATE_WIDTHS[card.cardType] : CARD_WIDTHS[card.size]
          return {
            cards: { ...state.cards, [card.id]: { ...card, position: clampCardPosition(card.position.x, card.position.y, undefined, width) } },
            maxZIndex: Math.max(state.maxZIndex, card.zIndex),
          }
        }),

      updateCard: (id, updates) =>
        set((state) => {
          const existing = state.cards[id]
          if (!existing) return state
          return {
            cards: { ...state.cards, [id]: { ...existing, ...updates } },
          }
        }),

      removeCard: (id) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure to omit
          const { [id]: _removed, ...rest } = state.cards
          return {
            cards: rest,
            expandedCardId: state.expandedCardId === id ? null : state.expandedCardId,
          }
        }),

      moveCard: (id, position, cardHeight?, cardWidth?) =>
        set((state) => {
          const existing = state.cards[id]
          if (!existing) return state
          return {
            cards: { ...state.cards, [id]: { ...existing, position: clampCardPosition(position.x, position.y, cardHeight, cardWidth), userPositioned: true } },
          }
        }),

      bringToFront: (id) =>
        set((state) => {
          const existing = state.cards[id]
          if (!existing) return state
          const newZ = state.maxZIndex + 1
          return {
            cards: { ...state.cards, [id]: { ...existing, zIndex: newZ } },
            maxZIndex: newZ,
          }
        }),

      // View actions
      setView: (view) =>
        set((state) => ({ view: { ...state.view, ...view } })),

      setLeftPanel: (panel) => set({ leftPanel: panel }),

      toggleLeftPanel: (panel) =>
        set((state) => ({
          leftPanel: state.leftPanel === panel ? 'none' : panel,
        })),

      setExpandedCardId: (id) => set({ expandedCardId: id }),
    }),
    {
      name: 'anima-desktop',
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version === 0 || version === undefined) {
          // v0 -> v1: add stacks, rename activeWorkspace, add stackId to cards
          const oldCards = (state.cards ?? {}) as Record<string, Record<string, unknown>>
          const migratedCards: Record<string, unknown> = {}
          for (const [id, card] of Object.entries(oldCards)) {
            migratedCards[id] = { ...card, stackId: card.stackId ?? 'default' }
          }
          return {
            ...state,
            stacks: state.stacks ?? [],
            archivedStackIds: state.archivedStackIds ?? [],
            activeStackId: state.activeWorkspace ?? state.activeStackId ?? 'default',
            cards: migratedCards,
          }
        }
        if (version <= 2) {
          // v2 -> v3: add userPositioned flag (default false for existing cards)
          const oldCards = (state.cards ?? {}) as Record<string, Record<string, unknown>>
          const migratedCards: Record<string, unknown> = {}
          for (const [id, card] of Object.entries(oldCards)) {
            migratedCards[id] = { ...card, userPositioned: card.userPositioned ?? false }
          }
          return { ...state, cards: migratedCards }
        }
        return state
      },
    }
  )
)

/** Selector: returns cards for the currently active stack. */
export function useCardsForActiveStack(): DesktopCard[] {
  return useDesktopStore(
    useShallow((state) =>
      Object.values(state.cards).filter(
        (card) => card.stackId === state.activeStackId
      )
    )
  )
}
