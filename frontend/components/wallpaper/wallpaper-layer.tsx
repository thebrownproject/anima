'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useWallpaperStore, getWallpaper } from '@/lib/stores/wallpaper-store'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@/lib/stores/desktop-store'
import { MeshGradient } from './mesh-gradient'

// Module-level ref for direct DOM manipulation from viewport (no re-renders)
let wallpaperEl: HTMLDivElement | null = null
const MAX_SHIFT = 200 // px — must be less than inset buffer (250px)

export function setWallpaperTransform(viewX: number, viewY: number, scale: number) {
  if (!wallpaperEl) return

  const sw = window.innerWidth
  const sh = window.innerHeight

  // Center of the pan range at this zoom level
  const centerX = sw / 2 - (WORLD_WIDTH * scale) / 2
  const centerY = sh / 2 - (WORLD_HEIGHT * scale) / 2

  // Normalize to -1..1 (how far from center as a fraction of max pan)
  const rangeX = (WORLD_WIDTH * scale) / 2
  const rangeY = (WORLD_HEIGHT * scale) / 2
  const nx = rangeX > 0 ? (viewX - centerX) / rangeX : 0
  const ny = rangeY > 0 ? (viewY - centerY) / rangeY : 0

  // Clamp and scale to pixel shift
  const x = Math.max(-1, Math.min(1, nx)) * MAX_SHIFT
  const y = Math.max(-1, Math.min(1, ny)) * MAX_SHIFT

  wallpaperEl.style.transform = `translate3d(${x}px, ${y}px, 0)`
}

export function WallpaperLayer() {
  const wallpaperId = useWallpaperStore((s) => s.wallpaperId)
  const wallpaper = getWallpaper(wallpaperId)
  const isMesh = wallpaperId.startsWith('mesh-')
  const isSolid = wallpaperId.startsWith('solid-')
  const solidColors: Record<string, string> = {
    'solid-black': '#000000',
    'solid-grey': '#1a1a2e',
    'solid-white': '#f5f5f5',
  }

  const ref = useCallback((el: HTMLDivElement | null) => {
    wallpaperEl = el
  }, [])

  return (
    <>
      {/* Wallpaper — solid color, mesh gradient, or image */}
      <div
        ref={isSolid ? undefined : ref}
        className={cn('fixed -z-10', !isSolid && 'will-change-transform')}
        style={{
          inset: isSolid ? 0 : '-250px',
          backfaceVisibility: isSolid ? undefined : 'hidden',
          backgroundColor: isSolid ? solidColors[wallpaperId] : undefined,
        }}
      >
        {isMesh ? (
          <MeshGradient variant={wallpaperId} />
        ) : !isSolid ? (
          <img
            key={wallpaperId}
            src={wallpaper.url}
            alt=""
            className="h-full w-full object-cover transition-opacity duration-700"
            draggable={false}
          />
        ) : null}
      </div>

      {/* Film grain overlay — subtle for JPGs, mesh has its own pixel grain */}
      {!isSolid && (
        <div
          className="pointer-events-none fixed inset-0 -z-[9] mix-blend-overlay"
          style={{ opacity: isMesh ? 0 : 0.035 }}
        >
          <svg width="100%" height="100%">
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
          </svg>
        </div>
      )}
    </>
  )
}
