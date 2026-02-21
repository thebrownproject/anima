import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import type { DesktopCard } from '@/lib/stores/desktop-store'
import type { TableBlock } from '@/types/ws-protocol'

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: Record<string, unknown>) => {
      const { children, initial, animate, exit, transition, ...rest } = props
      void initial; void animate; void exit; void transition
      return <div {...rest}>{children as React.ReactNode}</div>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

import { TableCard } from '../cards/table-card'
import { BlockRenderer } from '../block-renderer'

// Extraction tool output shape: 4 columns, dict-keyed rows, list-of-lists preview
// Uses distinct values per cell to avoid duplicate-text ambiguity in queries
const HEADERS = ['Description', 'Quantity', 'Unit Price', 'Total']
const PREVIEW_ROWS: string[][] = [
  ['Web Development Services', '2', '$2,500.00', '$5,000.00'],
  ['Hosting (Annual)', '3', '$400.00', '$1,200.00'],
]
const TABLE_BLOCK: TableBlock = {
  id: 'tb-1',
  type: 'table',
  columns: HEADERS,
  rows: [
    { Description: 'Web Development Services', Quantity: '2', 'Unit Price': '$2,500.00', Total: '$5,000.00' },
    { Description: 'Hosting (Annual)', Quantity: '3', 'Unit Price': '$400.00', Total: '$1,200.00' },
  ],
}

const TABLE_CARD: DesktopCard = {
  id: 'card-table-1',
  stackId: 'default',
  title: 'Invoice #INV-001',
  blocks: [
    { id: 'h1', type: 'heading', text: 'Invoice Details' },
    TABLE_BLOCK,
  ],
  size: 'medium',
  position: { x: 100, y: 100 },
  zIndex: 1,
  cardType: 'table',
  headers: HEADERS,
  previewRows: PREVIEW_ROWS,
}

const EMPTY_TABLE_CARD: DesktopCard = {
  ...TABLE_CARD,
  id: 'card-table-empty',
  title: 'Empty Table',
  headers: [],
  previewRows: [],
  blocks: [],
}

const NO_FIELDS_CARD: DesktopCard = {
  ...TABLE_CARD,
  id: 'card-table-nofields',
  title: 'Missing Fields',
  headers: undefined,
  previewRows: undefined,
  blocks: [],
}

const baseStoreState = {
  cards: { [TABLE_CARD.id]: TABLE_CARD },
  maxZIndex: 1,
  view: { x: 0, y: 0, scale: 1 },
  activeStackId: 'default',
  stacks: [],
  archivedStackIds: [],
  leftPanel: 'none' as const,
}

describe('TableCard collapsed view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDesktopStore.setState(baseStoreState)
  })
  afterEach(cleanup)

  it('renders title, headers, and row data', () => {
    render(<TableCard card={TABLE_CARD} />)

    expect(screen.getByText('Invoice #INV-001')).toBeDefined()
    for (const h of HEADERS) {
      expect(screen.getByText(h)).toBeDefined()
    }
    expect(screen.getByText('Web Development Services')).toBeDefined()
    expect(screen.getByText('$5,000.00')).toBeDefined()
    expect(screen.getByText('Hosting (Annual)')).toBeDefined()
  })

  it('shows correct entry count in footer', () => {
    render(<TableCard card={TABLE_CARD} />)
    expect(screen.getByText('2 entries')).toBeDefined()
  })

  it('columns align with data (each row has same number of cells as headers)', () => {
    const { container } = render(<TableCard card={TABLE_CARD} />)
    const headerCells = container.querySelectorAll('thead th')
    const bodyRows = container.querySelectorAll('tbody tr')

    expect(headerCells.length).toBe(HEADERS.length)
    bodyRows.forEach((row) => {
      expect(row.querySelectorAll('td').length).toBe(HEADERS.length)
    })
  })
})

describe('TableCard empty state', () => {
  afterEach(cleanup)

  it('shows fallback when headers and previewRows are empty arrays', () => {
    render(<TableCard card={EMPTY_TABLE_CARD} />)

    expect(screen.getByText('No data yet')).toBeDefined()
    expect(screen.getByText('0 entries')).toBeDefined()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows fallback when headers and previewRows are undefined', () => {
    render(<TableCard card={NO_FIELDS_CARD} />)

    expect(screen.getByText('No data yet')).toBeDefined()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('BlockRenderer expanded table view', () => {
  afterEach(cleanup)

  it('renders table block with columns and dict-keyed rows', () => {
    const { container } = render(<BlockRenderer blocks={TABLE_CARD.blocks} theme="editorial" />)

    for (const col of HEADERS) {
      expect(screen.getByText(col)).toBeDefined()
    }
    expect(screen.getByText('Web Development Services')).toBeDefined()
    expect(screen.getByText('$400.00')).toBeDefined()
    // Verify row count matches data
    const bodyRows = container.querySelectorAll('tbody tr')
    expect(bodyRows.length).toBe(2)
  })

  it('renders heading block alongside table block', () => {
    render(<BlockRenderer blocks={TABLE_CARD.blocks} theme="editorial" />)
    expect(screen.getByText('Invoice Details')).toBeDefined()
  })

  it('handles blocks without id field (DB persistence case)', () => {
    const blocksWithoutId = TABLE_CARD.blocks.map(({ id: _id, ...rest }) => rest) as typeof TABLE_CARD.blocks
    render(<BlockRenderer blocks={blocksWithoutId} theme="editorial" />)

    // Should render without error, using index as key fallback
    expect(screen.getByText('Invoice Details')).toBeDefined()
    expect(screen.getByText('Web Development Services')).toBeDefined()
  })

  it('shows "No content" when blocks array is empty', () => {
    render(<BlockRenderer blocks={[]} theme="editorial" />)
    expect(screen.getByText('No content')).toBeDefined()
  })
})
