'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { WallpaperLayer } from '@/components/wallpaper/wallpaper-layer'
import { DesktopViewport } from '@/components/desktop/desktop-viewport'
import { DesktopCard } from '@/components/desktop/desktop-card'
import { DesktopTopBar } from '@/components/desktop/desktop-top-bar'
import { WebSocketProvider } from '@/components/desktop/ws-provider'
import { ChatBar } from '@/components/desktop/chat-bar'
import { ChatPanel } from '@/components/desktop/chat-panel'
import { DocumentsPanel } from '@/components/desktop/documents-panel'
import { BlockRenderer } from '@/components/desktop/block-renderer'
import { DesktopContextMenu } from '@/components/desktop/desktop-context-menu'
import { DebugPanel } from '@/components/debug/debug-panel'
import { useDesktopStore, useCardsForActiveStack } from '@/lib/stores/desktop-store'
import type { DesktopCard as DesktopCardType } from '@/lib/stores/desktop-store'
import { useWallpaperStore } from '@/lib/stores/wallpaper-store'
import { GlassTooltipProvider } from '@/components/ui/glass-tooltip'
import { MaybeVoiceProvider } from '@/components/voice/voice-provider'
import { CardOverlayProvider, useCardOverlay } from '@/components/desktop/card-overlay'

function CardLayer() {
  const cards = useCardsForActiveStack()
  const { setOverlayCardId } = useCardOverlay()

  const handleCardClick = (card: DesktopCardType) => {
    if (card.cardType) setOverlayCardId(card.id)
  }

  return (
    <AnimatePresence>
      {cards.map((card) => (
        <DesktopCard key={card.id} card={card} onCardClick={handleCardClick}>
          <BlockRenderer blocks={card.blocks} />
        </DesktopCard>
      ))}
    </AnimatePresence>
  )
}

const DEMO_CARDS = [
  { id: 'demo-doc', title: 'Q4 Revenue Report', cardType: 'document' as const, typeBadge: 'Report', date: '2026-01-31', summary: 'Total revenue increased 24% YoY driven by enterprise segment growth and improved retention across all tiers.', tags: ['finance', 'q4', 'revenue'], position: { x: 40, y: 60 } },
  { id: 'demo-metric-1', title: 'Monthly Recurring Revenue', cardType: 'metric' as const, value: '$142,800', trend: '+18.4%', trendDirection: 'up' as const, position: { x: 480, y: 60 } },
  { id: 'demo-metric-2', title: 'Active Users', cardType: 'metric' as const, value: '45.2K', trend: '-2.1%', trendDirection: 'down' as const, color: 'orange', position: { x: 820, y: 60 } },
  { id: 'demo-article', title: 'The Future of Document Intelligence', cardType: 'article' as const, readTime: '5 min read', author: 'Fraser Brown', summary: 'In the early days of computing, documents were static artifacts. We printed them, filed them, and occasionally lost them. Then came digitization, which made documents searchable but not truly intelligent.\n\nToday, AI agents like Stackdocs don\'t just read documents — they understand them.', position: { x: 40, y: 460 } },
  { id: 'demo-table', title: 'Q3 Regional Performance', cardType: 'table' as const, headers: ['Region', 'Revenue', 'Growth', 'Status'], previewRows: [['North America', '$850,000', '+12%', 'On Track'], ['Europe', '$420,000', '+8%', 'Review'], ['Asia Pacific', '$310,000', '-2%', 'At Risk'], ['Latin America', '$150,000', '+18%', 'Exceeding']], position: { x: 580, y: 460 } },
]

export default function DesktopPage() {
  const [overlayCardId, setOverlayCardId] = useState<string | null>(null)
  const setCards = useDesktopStore((s) => s.setCards)
  const setWallpaper = useWallpaperStore((s) => s.setWallpaper)

  useEffect(() => {
    setWallpaper('solid-white')
    if (process.env.NODE_ENV === 'development') {
      const seeded: Record<string, DesktopCardType> = {}
      DEMO_CARDS.forEach(({ position, ...rest }, i) => {
        const card: DesktopCardType = { ...rest, stackId: 'default', size: 'medium', zIndex: i + 1, blocks: [], position }
        seeded[card.id] = card
      })
      setCards(seeded)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <WebSocketProvider>
    <MaybeVoiceProvider>
    <GlassTooltipProvider delayDuration={800}>
    <CardOverlayProvider overlayCardId={overlayCardId} setOverlayCardId={setOverlayCardId}>
      <div className="relative h-svh w-full overflow-hidden">
        <WallpaperLayer />

        <DesktopTopBar />

        <DesktopContextMenu>
          <DesktopViewport>
            <CardLayer />
          </DesktopViewport>
        </DesktopContextMenu>

        <DocumentsPanel />
        <ChatPanel />

        <ChatBar />
        <DebugPanel />
      </div>
    </CardOverlayProvider>
    </GlassTooltipProvider>
    </MaybeVoiceProvider>
    </WebSocketProvider>
  )
}
