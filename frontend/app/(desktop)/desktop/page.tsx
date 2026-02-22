'use client'

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
import { ConnectionStatus } from '@/components/desktop/connection-status'
import { DebugPanel } from '@/components/debug/debug-panel'
import { useCardsForActiveStack, useDesktopStore } from '@/lib/stores/desktop-store'
import type { DesktopCard as DesktopCardType } from '@/lib/stores/desktop-store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MaybeVoiceProvider } from '@/components/voice/voice-provider'

function CardLayer() {
  const cards = useCardsForActiveStack()
  const setExpandedCardId = useDesktopStore((s) => s.setExpandedCardId)

  const expandedCardId = useDesktopStore((s) => s.expandedCardId)

  const handleCardClick = (card: DesktopCardType) => {
    if (card.cardType) setExpandedCardId(expandedCardId === card.id ? null : card.id)
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

export default function DesktopPage() {
  return (
    <WebSocketProvider>
    <MaybeVoiceProvider>
    <TooltipProvider delayDuration={800}>
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

        <ConnectionStatus />
        <ChatBar />
        <DebugPanel />
      </div>
    </TooltipProvider>
    </MaybeVoiceProvider>
    </WebSocketProvider>
  )
}
