'use client'

import { use } from 'react'
import { AnimatePresence } from 'framer-motion'
import { WallpaperLayer } from '@/components/wallpaper/wallpaper-layer'
import { WallpaperPicker } from '@/components/wallpaper/wallpaper-picker'
import { DesktopViewport } from '@/components/desktop/desktop-viewport'
import { DesktopCard } from '@/components/desktop/desktop-card'
import { DesktopTopBar } from '@/components/desktop/desktop-top-bar'
import { WebSocketProvider } from '@/components/desktop/ws-provider'
import { ChatBar } from '@/components/desktop/chat-bar'
import { ChatPanel } from '@/components/desktop/chat-panel'
import { DocumentsPanel } from '@/components/desktop/documents-panel'
import { BlockRenderer } from '@/components/desktop/block-renderer'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { GlassTooltipProvider } from '@/components/ui/glass-tooltip'

export default function DesktopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const cards = useDesktopStore((s) => s.cards)

  return (
    <WebSocketProvider stackId={id}>
      <GlassTooltipProvider delayDuration={800}>
        <div className="relative h-svh w-full overflow-hidden">
          <WallpaperLayer />

          {/* Top bar */}
          <DesktopTopBar />

          {/* Canvas viewport */}
          <DesktopViewport>
            <AnimatePresence>
              {Object.values(cards).map((card) => (
                <DesktopCard key={card.id} card={card}>
                  <BlockRenderer blocks={card.blocks} />
                </DesktopCard>
              ))}
            </AnimatePresence>
          </DesktopViewport>

          {/* Side panels */}
          <DocumentsPanel />
          <ChatPanel />

          {/* Chat bar */}
          <ChatBar />

          {/* Wallpaper picker (bottom-right, above viewport HUD) */}
          <div className="pointer-events-none absolute bottom-12 right-4 z-10">
            <div className="pointer-events-auto">
              <WallpaperPicker />
            </div>
          </div>

          {/* Stack ID for debugging */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 font-mono text-xs text-white/30">
            stack: {id}
          </div>
        </div>
      </GlassTooltipProvider>
    </WebSocketProvider>
  )
}
