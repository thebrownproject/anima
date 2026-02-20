import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BaseCard } from '../cards/base-card'
import { COLOR_STYLES, getCardColor, DEFAULT_TEMPLATE_COLORS } from '../cards/colors'
import type { CardColor } from '../cards/colors'

// ── BaseCard rendering ────────────────────────────────────────────────────────

describe('BaseCard', () => {
  const COLORS = Object.keys(COLOR_STYLES) as CardColor[]

  it('renders correct background hex for each palette color', () => {
    for (const color of COLORS) {
      const { unmount } = render(<BaseCard color={color}>content</BaseCard>)
      const card = screen.getByTestId('base-card')
      expect(card.style.backgroundColor).toBe(hexToRgb(COLOR_STYLES[color].bg))
      unmount()
    }
  })

  it('dark card gets light text, light cards get dark text', () => {
    // dark → light text
    const { unmount: u1 } = render(<BaseCard color="dark">x</BaseCard>)
    const dark = screen.getByTestId('base-card')
    expect(dark.style.color).toBe(hexToRgb(COLOR_STYLES.dark.text)) // #E0E0E0
    u1()

    // cream → dark text
    const { unmount: u2 } = render(<BaseCard color="cream">x</BaseCard>)
    const cream = screen.getByTestId('base-card')
    expect(cream.style.color).toBe(hexToRgb(COLOR_STYLES.cream.text)) // #22223B
    u2()
  })

  it('applies rounded-[40px] and p-8 classes', () => {
    render(<BaseCard color="white">content</BaseCard>)
    const card = screen.getByTestId('base-card')
    expect(card.className).toContain('rounded-[40px]')
    const inner = card.firstElementChild as HTMLElement
    expect(inner.className).toContain('p-8')
  })
})

// ── colors.ts helpers ─────────────────────────────────────────────────────────

describe('getCardColor', () => {
  it('returns default template color when no override', () => {
    expect(getCardColor('document')).toBe(DEFAULT_TEMPLATE_COLORS.document)
    expect(getCardColor('metric')).toBe(DEFAULT_TEMPLATE_COLORS.metric)
  })

  it('returns override when valid color name provided', () => {
    expect(getCardColor('document', 'dark')).toBe('dark')
    expect(getCardColor('metric', 'pink')).toBe('pink')
  })

  it('ignores invalid override and falls back to default', () => {
    expect(getCardColor('article', 'notacolor')).toBe(DEFAULT_TEMPLATE_COLORS.article)
  })
})

// ── hex → rgb conversion (JSDOM normalises inline style to rgb()) ─────────────
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
