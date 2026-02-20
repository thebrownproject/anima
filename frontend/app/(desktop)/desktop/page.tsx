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
import { DebugPanel } from '@/components/debug/debug-panel'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { GlassTooltipProvider } from '@/components/ui/glass-tooltip'
import { MaybeVoiceProvider } from '@/components/voice/voice-provider'
// SPIKE: font switcher
import { SPIKE_CARDS_ENABLED } from '@/spike/card-redesign/config'
import { FontSwitcher, useSpikeFont } from '@/spike/card-redesign/font-switcher'

function CardLayer() {
  const cards = useDesktopStore((s) => s.cards)
  const { fontFamily } = useSpikeFont()

  return (
    <>
      <AnimatePresence>
        {Object.values(cards).map((card) => (
          <DesktopCard
            key={card.id}
            card={card}
            style={SPIKE_CARDS_ENABLED ? { fontFamily } : undefined}
          >
            <BlockRenderer blocks={card.blocks} />
          </DesktopCard>
        ))}
      </AnimatePresence>
    </>
  )
}

export default function DesktopPage() {
  return (
    <WebSocketProvider>
    <MaybeVoiceProvider>
    <GlassTooltipProvider delayDuration={800}>
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
        {SPIKE_CARDS_ENABLED && <FontSwitcher />}
      </div>
    </GlassTooltipProvider>
    </MaybeVoiceProvider>
    </WebSocketProvider>
  )
}
