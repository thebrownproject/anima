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

export default function DesktopPage() {
  const cards = useDesktopStore((s) => s.cards)

  return (
    <WebSocketProvider>
      <GlassTooltipProvider delayDuration={800}>
        <div className="relative h-svh w-full overflow-hidden">
          <WallpaperLayer />

          <DesktopTopBar />

          <DesktopContextMenu>
            <DesktopViewport>
              <AnimatePresence>
                {Object.values(cards).map((card) => (
                  <DesktopCard key={card.id} card={card}>
                    <BlockRenderer blocks={card.blocks} />
                  </DesktopCard>
                ))}
              </AnimatePresence>
            </DesktopViewport>
          </DesktopContextMenu>

          <DocumentsPanel />
          <ChatPanel />

          <ChatBar />
          <DebugPanel />
        </div>
      </GlassTooltipProvider>
    </WebSocketProvider>
  )
}
