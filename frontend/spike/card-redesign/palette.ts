/**
 * Card color palette v7 — Color-to-color gradients, varied directions.
 * Inspired by Balance: yellow→orange, blue→purple, green→teal, etc.
 * Each gradient flows in a different direction for visual variety.
 */
export const CARD_PALETTE = {
  gold: 'linear-gradient(180deg, #f5e8a0 0%, #f0c878 100%)',
  dusk: 'linear-gradient(200deg, #c8c8d8 0%, #a8a0c0 100%)',
  sage: 'linear-gradient(160deg, #d0e0c8 0%, #a8c8a0 100%)',
  blush: 'linear-gradient(135deg, #f5e0d8 0%, #e8c0b0 100%)',
  ice: 'linear-gradient(210deg, #d8e8f0 0%, #b0c8d8 100%)',
  cream: 'linear-gradient(170deg, #f5f0e0 0%, #e0d0b8 100%)',
  terracotta: 'linear-gradient(0deg, #d8b098 0%, #e8c8a8 100%)',
  moss: 'linear-gradient(150deg, #d0d8c0 0%, #b0c0a0 100%)',
} as const

export type CardColor = keyof typeof CARD_PALETTE

// All text near-black — NO grey. Hierarchy through size + weight, not color.
export const CARD_TEXT = '#1A1A18'
export const CARD_TEXT_SECONDARY = '#2E2E2C'
export const CARD_TEXT_MUTED = '#3E3E3C'
export const CARD_TEXT_SUBTLE = '#4E4E4C'

const PALETTE_KEYS = Object.keys(CARD_PALETTE) as CardColor[]

/** Deterministic color from card ID — consistent across renders */
export function colorFromId(id: string): CardColor {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return PALETTE_KEYS[Math.abs(hash) % PALETTE_KEYS.length]
}
