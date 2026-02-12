import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Block } from '@/types/ws-protocol'

// =============================================================================
// Types
// =============================================================================

export interface DesktopCard {
  id: string
  title: string
  blocks: Block[]
  position: { x: number; y: number }
  zIndex: number
}

export interface ViewState {
  x: number
  y: number
  scale: number
}

interface DesktopState {
  cards: Record<string, DesktopCard>
  view: ViewState
  activeWorkspace: string
  maxZIndex: number
}

interface DesktopActions {
  addCard: (card: DesktopCard) => void
  updateCard: (id: string, updates: Partial<Omit<DesktopCard, 'id'>>) => void
  removeCard: (id: string) => void
  moveCard: (id: string, position: { x: number; y: number }) => void
  setView: (view: Partial<ViewState>) => void
  bringToFront: (id: string) => void
  setActiveWorkspace: (workspace: string) => void
}

// =============================================================================
// Store
// =============================================================================

export const useDesktopStore = create<DesktopState & DesktopActions>()(
  persist(
    (set) => ({
      // State
      cards: {},
      view: { x: 0, y: 0, scale: 1 },
      activeWorkspace: 'default',
      maxZIndex: 0,

      // Actions
      addCard: (card) =>
        set((state) => ({
          cards: { ...state.cards, [card.id]: card },
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

      moveCard: (id, position) =>
        set((state) => {
          const existing = state.cards[id]
          if (!existing) return state
          return {
            cards: { ...state.cards, [id]: { ...existing, position } },
          }
        }),

      setView: (view) =>
        set((state) => ({
          view: { ...state.view, ...view },
        })),

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

      setActiveWorkspace: (workspace) =>
        set({ activeWorkspace: workspace }),
    }),
    {
      name: 'stackdocs-desktop',
    }
  )
)
