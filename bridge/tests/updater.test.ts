import { describe, it, expect } from 'vitest'
import { compareSemver } from '../src/updater.js'

describe('compareSemver', () => {
  it('equal versions return 0', () => {
    expect(compareSemver('0.3.0', '0.3.0')).toBe(0)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
  })

  it('older version returns -1', () => {
    expect(compareSemver('0.2.0', '0.3.0')).toBe(-1)
    expect(compareSemver('0.3.0', '1.0.0')).toBe(-1)
    expect(compareSemver('0.2.9', '0.3.0')).toBe(-1)
  })

  it('newer version returns 1', () => {
    expect(compareSemver('0.3.0', '0.2.0')).toBe(1)
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1)
  })

  it('handles legacy integer versions', () => {
    // Legacy "3" treated as 0.0.3, which is < 0.3.0
    expect(compareSemver('3', '0.3.0')).toBe(-1)
    expect(compareSemver('0', '0.3.0')).toBe(-1)
    // Two legacy integers
    expect(compareSemver('3', '3')).toBe(0)
    expect(compareSemver('2', '3')).toBe(-1)
  })

  it('handles missing minor/patch', () => {
    expect(compareSemver('1', '1.0.0')).toBe(-1) // "1" → 0.0.1 < 1.0.0
    expect(compareSemver('0.0.0', '0.0.0')).toBe(0)
  })

  it('handles whitespace in version strings', () => {
    expect(compareSemver(' 0.3.0 ', '0.3.0')).toBe(0)
    expect(compareSemver('0.3.0', ' 0.3.0\n')).toBe(0)
  })
})
