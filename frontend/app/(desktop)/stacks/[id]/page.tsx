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

  // Seed demo cards so there's something to play with
  useEffect(() => {
    const { cards: c, addCard } = useDesktopStore.getState()
    const demos = [
      { id: 'demo-1', title: 'Invoice Summary', position: { x: 80, y: 80 } },
      { id: 'demo-2', title: 'Q4 Revenue Breakdown', position: { x: 420, y: 100 } },
      { id: 'demo-3', title: 'Supplier Contacts', position: { x: 160, y: 340 } },
      { id: 'demo-4', title: 'Expense Report', position: { x: 520, y: 360 } },
      { id: 'demo-5', title: 'Tax Deductions', position: { x: 300, y: 580 } },
    ]
    demos.forEach((d, i) => {
      if (!c[d.id]) addCard({ ...d, blocks: [], zIndex: i + 1 })
    })
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
