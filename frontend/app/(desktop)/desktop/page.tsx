'use client'

import { useState } from 'react'
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
import { useDesktopStore } from '@/lib/stores/desktop-store'
import type { DesktopCard as DesktopCardType } from '@/lib/stores/desktop-store'
import { GlassTooltipProvider } from '@/components/ui/glass-tooltip'
import { MaybeVoiceProvider } from '@/components/voice/voice-provider'
import { CardOverlayProvider, useCardOverlay } from '@/components/desktop/card-overlay'

function CardLayer() {
  const cards = useDesktopStore((s) => s.cards)
  const { setOverlayCardId } = useCardOverlay()

  const handleCardClick = (card: DesktopCardType) => {
    if (card.cardType) setOverlayCardId(card.id)
  }

  return (
    <AnimatePresence>
      {Object.values(cards).map((card) => (
        <DesktopCard key={card.id} card={card} onCardClick={handleCardClick}>
          <BlockRenderer blocks={card.blocks} />
        </DesktopCard>
      ))}
    </AnimatePresence>
  )
}

export default function DesktopPage() {
  const [overlayCardId, setOverlayCardId] = useState<string | null>(null)

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
