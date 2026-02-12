'use client'

import { use } from 'react'
import { WallpaperLayer } from '@/components/wallpaper/wallpaper-layer'
import { WallpaperPicker } from '@/components/wallpaper/wallpaper-picker'
import { DesktopViewport } from '@/components/desktop/desktop-viewport'

export default function DesktopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <div className="relative h-svh w-full overflow-hidden">
      <WallpaperLayer />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30" />

      {/* Canvas viewport */}
      <DesktopViewport>
        {/* Cards will be rendered here by later tasks */}
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
