import { describe, it, expect } from 'vitest'
import { clampCardPosition, WORLD_WIDTH, WORLD_HEIGHT, CARD_WIDTH, TEMPLATE_WIDTHS } from '../desktop-store'

describe('clampCardPosition', () => {
  it('defaults to CARD_WIDTH (medium) when no cardWidth provided', () => {
    const result = clampCardPosition(WORLD_WIDTH, 0)
    expect(result.x).toBe(WORLD_WIDTH - CARD_WIDTH)
  })

  it('uses actual template width when cardWidth provided', () => {
    const tableWidth = TEMPLATE_WIDTHS.table // 600
    const result = clampCardPosition(WORLD_WIDTH, 0, undefined, tableWidth)
    expect(result.x).toBe(WORLD_WIDTH - tableWidth)
  })

  it('uses metric width (300) for small cards', () => {
    const metricWidth = TEMPLATE_WIDTHS.metric // 300
    const result = clampCardPosition(WORLD_WIDTH, 0, undefined, metricWidth)
    expect(result.x).toBe(WORLD_WIDTH - metricWidth)
  })

  it('clamps y with custom cardHeight', () => {
    const result = clampCardPosition(0, WORLD_HEIGHT, 200)
    expect(result.y).toBe(WORLD_HEIGHT - 200)
  })

  it('does not go below zero', () => {
    const result = clampCardPosition(-100, -100)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })
})
