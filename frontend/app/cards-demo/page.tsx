'use client'

import { DocumentCard } from '@/components/desktop/cards/document-card'
import { MetricCard } from '@/components/desktop/cards/metric-card'
import { TableCard } from '@/components/desktop/cards/table-card'
import { ArticleCard } from '@/components/desktop/cards/article-card'
import { DataCard } from '@/components/desktop/cards/data-card'
import type { DesktopCard } from '@/lib/stores/desktop-store'

const base: Omit<DesktopCard, 'id' | 'title' | 'cardType'> = {
  stackId: 'demo',
  position: { x: 0, y: 0 },
  zIndex: 1,
  size: 'medium',
  blocks: [],
}

const DOCUMENT: DesktopCard = {
  ...base,
  id: 'demo-doc',
  title: 'Q4 Revenue Report',
  cardType: 'document',
  typeBadge: 'Report',
  date: '2026-01-31',
  summary: 'Total revenue increased 24% YoY driven by enterprise segment growth and improved retention across all tiers.',
  tags: ['finance', 'q4', 'revenue'],
}

const METRIC: DesktopCard = {
  ...base,
  id: 'demo-metric',
  title: 'Monthly Recurring Revenue',
  cardType: 'metric',
  value: '$142,800',
  trend: '+18.4%',
  trendDirection: 'up',
}

const TABLE: DesktopCard = {
  ...base,
  id: 'demo-table',
  title: 'Invoice Summary',
  cardType: 'table',
  headers: ['Invoice', 'Client', 'Amount', 'Status'],
  previewRows: [
    ['INV-0041', 'Acme Corp', '$12,400', 'Paid'],
    ['INV-0042', 'Globex Ltd', '$8,750', 'Pending'],
    ['INV-0043', 'Initech', '$21,000', 'Overdue'],
    ['INV-0044', 'Umbrella Co', '$5,300', 'Paid'],
  ],
}

const ARTICLE: DesktopCard = {
  ...base,
  id: 'demo-article',
  title: 'The Future of Document Intelligence',
  cardType: 'article',
  readTime: '4 min read',
  author: 'Fraser Brown',
  summary: 'As AI systems become more capable of understanding complex documents, the gap between raw data and actionable insight is closing. Here is what that means for small business owners who spend hours each week buried in invoices, contracts, and reports.',
}

const DATA: DesktopCard = {
  ...base,
  id: 'demo-data',
  title: 'Product Sales',
  cardType: 'data',
  headers: ['Product', 'Units', 'Revenue'],
  previewRows: [
    ['Starter', '142', '$14,200'],
    ['Pro', '89', '$44,500'],
    ['Enterprise', '12', '$84,000'],
  ],
}

export default function CardsDemoPage() {
  return (
    <div className="min-h-screen overflow-y-auto bg-neutral-100 p-12">
      <h1 className="text-2xl font-bold mb-2 text-neutral-800">Card Templates</h1>
      <p className="text-sm text-neutral-500 mb-10">m7b.4.17 — all 5 templates rendered with sample data</p>
      <div className="flex flex-wrap gap-8 items-start">
        <DocumentCard card={DOCUMENT} onCardClick={(c) => console.log('open', c.id)} />
        <MetricCard card={METRIC} onCardClick={(c) => console.log('open', c.id)} />
        <ArticleCard card={ARTICLE} onCardClick={(c) => console.log('open', c.id)} />
        <DataCard card={DATA} onCardClick={(c) => console.log('open', c.id)} />
        <TableCard card={TABLE} onCardClick={(c) => console.log('open', c.id)} />
      </div>
    </div>
  )
}
