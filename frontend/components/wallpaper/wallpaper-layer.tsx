'use client'

import { useCallback } from 'react'
import { useWallpaperStore, getWallpaper } from '@/lib/stores/wallpaper-store'

// Module-level ref for direct DOM manipulation from viewport (no re-renders)
let wallpaperEl: HTMLDivElement | null = null

/** Called by DesktopViewport on every pan/zoom frame. */
const WORLD_W = 4000
const WORLD_H = 3000
const MAX_SHIFT = 200 // px — must be less than inset buffer (250px)

export function setWallpaperTransform(viewX: number, viewY: number, scale: number) {
  if (!wallpaperEl) return

  const sw = window.innerWidth
  const sh = window.innerHeight

  // Center of the pan range at this zoom level
  const centerX = sw / 2 - (WORLD_W * scale) / 2
  const centerY = sh / 2 - (WORLD_H * scale) / 2

  // Normalize to -1..1 (how far from center as a fraction of max pan)
  const rangeX = (WORLD_W * scale) / 2
  const rangeY = (WORLD_H * scale) / 2
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

  const ref = useCallback((el: HTMLDivElement | null) => {
    wallpaperEl = el
  }, [])

  return (
    <div
      ref={ref}
      className="fixed -z-10 will-change-transform"
      style={{
        inset: '-250px',
        backfaceVisibility: 'hidden',
      }}
    >
      <img
        key={wallpaperId}
        src={wallpaper.url}
        alt=""
        className="h-full w-full object-cover transition-opacity duration-700"
        draggable={false}
      />
    </div>
  )
}
