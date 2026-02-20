import { type DesktopCard, type ViewState, WORLD_WIDTH, WORLD_HEIGHT, CARD_WIDTHS, clampCardPosition, snapToGrid } from '@/lib/stores/desktop-store'

const CARD_GRID_HEIGHT = 200 // Estimated height for grid spacing (not actual rendered height)
const GAP = 40
const COLS = 4

/**
 * Compute a non-overlapping position for a new card.
 * Places cards in a grid pattern offset from the viewport center,
 * clamped within world bounds.
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
      : WORLD_WIDTH / 2
  const centerY =
    typeof window !== 'undefined'
      ? (window.innerHeight / 2 - viewState.y) / viewState.scale
      : WORLD_HEIGHT / 2

  // Grid position based on card count
  const col = count % COLS
  const row = Math.floor(count / COLS)

  // Offset grid so it's roughly centered
  const gridWidth = COLS * (CARD_WIDTHS.medium + GAP) - GAP
  const startX = centerX - gridWidth / 2
  const startY = centerY - CARD_GRID_HEIGHT / 2

  const clamped = clampCardPosition(
    startX + col * (CARD_WIDTHS.medium + GAP),
    startY + row * (CARD_GRID_HEIGHT + GAP),
  )
  return snapToGrid(clamped.x, clamped.y)
}
