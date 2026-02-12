import type { DesktopCard, ViewState } from '@/lib/stores/desktop-store'

const CARD_WIDTH = 320
const CARD_HEIGHT = 200
const GAP = 40
const COLS = 4

/**
 * Compute a non-overlapping position for a new card.
 * Places cards in a grid pattern offset from the viewport center.
 */
export function getAutoPosition(
  existingCards: Record<string, DesktopCard>,
  viewState: ViewState
): { x: number; y: number } {
  const count = Object.keys(existingCards).length

  // Viewport center in world coordinates
  const centerX =
    typeof window !== 'undefined'
      ? (window.innerWidth / 2 - viewState.x) / viewState.scale
      : 600
  const centerY =
    typeof window !== 'undefined'
      ? (window.innerHeight / 2 - viewState.y) / viewState.scale
      : 400

  // Grid position based on card count
  const col = count % COLS
  const row = Math.floor(count / COLS)

  // Offset grid so it's roughly centered
  const gridWidth = COLS * (CARD_WIDTH + GAP) - GAP
  const startX = centerX - gridWidth / 2
  const startY = centerY - CARD_HEIGHT / 2

  return {
    x: startX + col * (CARD_WIDTH + GAP),
    y: startY + row * (CARD_HEIGHT + GAP),
  }
}
