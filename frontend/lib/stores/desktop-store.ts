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

// World bounds — cards and viewport are clamped to this area (16:9 for widescreen monitors)
export const WORLD_WIDTH = 8000
export const WORLD_HEIGHT = 4000
export const CARD_WIDTH = CARD_WIDTHS.medium // backward compat
const CARD_H_DEFAULT = 500

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
  moveCard: (id: string, position: { x: number; y: number }, cardHeight?: number) => void
  bringToFront: (id: string) => void

  // View actions
  setView: (view: Partial<ViewState>) => void
  setLeftPanel: (panel: LeftPanel) => void
  toggleLeftPanel: (panel: LeftPanel) => void
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
            const hasPosition = existing && (existing.position.x !== 0 || existing.position.y !== 0)
            merged[id] = hasPosition
              ? { ...card, position: existing.position, zIndex: existing.zIndex }
              : card
            if (merged[id].zIndex > maxZ) maxZ = merged[id].zIndex
          }
          return { cards: merged, maxZIndex: maxZ }
        }),

      addCard: (card) =>
        set((state) => ({
          cards: { ...state.cards, [card.id]: { ...card, position: clampCardPosition(card.position.x, card.position.y) } },
          maxZIndex: Math.max(state.maxZIndex, card.zIndex),
        })),

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
          const { [id]: _, ...rest } = state.cards
          return { cards: rest }
        }),

      moveCard: (id, position, cardHeight?) =>
        set((state) => {
          const existing = state.cards[id]
          if (!existing) return state
          return {
            cards: { ...state.cards, [id]: { ...existing, position: clampCardPosition(position.x, position.y, cardHeight) } },
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
    }),
    {
      name: 'stackdocs-desktop',
      version: 2,
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
        // v1 -> v2: all new template fields are optional — no transformation needed
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
