'use client'

import { use, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { WallpaperLayer } from '@/components/wallpaper/wallpaper-layer'
import { WallpaperPicker } from '@/components/wallpaper/wallpaper-picker'
import { DesktopViewport } from '@/components/desktop/desktop-viewport'
import { DesktopCard } from '@/components/desktop/desktop-card'
import { useDesktopStore } from '@/lib/stores/desktop-store'

export default function DesktopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const cards = useDesktopStore((s) => s.cards)

  // Seed a demo card so there's something visible on first load
  useEffect(() => {
    const { cards: c, addCard } = useDesktopStore.getState()
    if (Object.keys(c).length === 0) {
      addCard({
        id: 'demo-1',
        title: 'Invoice Summary',
        blocks: [],
        position: { x: 100, y: 100 },
        zIndex: 1,
      })
    }
  }, [])

  return (
    <div className="relative h-svh w-full overflow-hidden">
      <WallpaperLayer />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30" />

      {/* Canvas viewport */}
      <DesktopViewport>
        <AnimatePresence>
          {Object.values(cards).map((card) => (
            <DesktopCard key={card.id} card={card}>
              <div className="p-4 text-sm text-white/60">
                Demo card content — block renderer coming in task 9
              </div>
            </DesktopCard>
          ))}
        </AnimatePresence>
      </DesktopViewport>

      {/* Chat bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20" />

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
  )
}
