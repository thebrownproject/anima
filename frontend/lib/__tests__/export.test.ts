import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportAsCSV, exportAsJSON, toCSV, toJSON } from '../export'

const HEADERS = ['Name', 'Quantity', 'Price']
const ROWS = [
  ['Widget A', '10', '$5.00'],
  ['Widget B', '3', '$12.50'],
]

describe('toCSV', () => {
  it('produces valid CSV with headers and rows', () => {
    const csv = toCSV(HEADERS, ROWS)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Name,Quantity,Price')
    expect(lines[1]).toBe('Widget A,10,$5.00')
    expect(lines[2]).toBe('Widget B,3,$12.50')
  })

  it('escapes values containing commas', () => {
    const csv = toCSV(['Item'], [['Nuts, Bolts']])
    expect(csv).toBe('Item\n"Nuts, Bolts"')
  })

  it('escapes values containing double quotes', () => {
    const csv = toCSV(['Item'], [['12" Screen']])
    expect(csv).toBe('Item\n"12"" Screen"')
  })

  it('escapes values containing newlines', () => {
    const csv = toCSV(['Note'], [['Line1\nLine2']])
    expect(csv).toBe('Note\n"Line1\nLine2"')
  })

  it('returns only headers when rows are empty', () => {
    const csv = toCSV(HEADERS, [])
    expect(csv).toBe('Name,Quantity,Price')
  })

  it('returns empty string when headers are empty', () => {
    const csv = toCSV([], [])
    expect(csv).toBe('')
  })

  it('coerces non-string cell values to strings', () => {
    const csv = toCSV(['Val'], [[42 as unknown as string]])
    expect(csv).toBe('Val\n42')
  })
})

describe('toJSON', () => {
  it('produces valid JSON array-of-objects', () => {
    const json = toJSON(HEADERS, ROWS)
    const parsed = JSON.parse(json)
    expect(parsed).toEqual([
      { Name: 'Widget A', Quantity: '10', Price: '$5.00' },
      { Name: 'Widget B', Quantity: '3', Price: '$12.50' },
    ])
  })

  it('uses 2-space indentation', () => {
    const json = toJSON(['A'], [['1']])
    // Verify top-level array elements are indented 2 spaces (not 4)
    expect(json).toMatch(/^\s{2}\{/m)
    expect(json).not.toMatch(/^\s{8}/m)
  })

  it('returns empty array when rows are empty', () => {
    const json = toJSON(HEADERS, [])
    expect(JSON.parse(json)).toEqual([])
  })

  it('returns empty array when headers are empty', () => {
    const json = toJSON([], [])
    expect(JSON.parse(json)).toEqual([])
  })
})

describe('exportAsCSV', () => {
  let clickedAnchor: { href: string; download: string }

  beforeEach(() => {
    clickedAnchor = { href: '', download: '' }
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(v: string) { clickedAnchor.href = v },
      set download(v: string) { clickedAnchor.download = v },
      click: vi.fn(),
    } as unknown as HTMLElement)
  })

  it('downloads with a sanitized filename', () => {
    exportAsCSV(HEADERS, ROWS, 'Invoice #001')
    expect(clickedAnchor.download).toBe('invoice-001.csv')
  })
})

describe('exportAsJSON', () => {
  let clickedAnchor: { href: string; download: string }

  beforeEach(() => {
    clickedAnchor = { href: '', download: '' }
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(v: string) { clickedAnchor.href = v },
      set download(v: string) { clickedAnchor.download = v },
      click: vi.fn(),
    } as unknown as HTMLElement)
  })

  it('downloads with a sanitized filename', () => {
    exportAsJSON(HEADERS, ROWS, 'Invoice #001')
    expect(clickedAnchor.download).toBe('invoice-001.json')
  })
})
