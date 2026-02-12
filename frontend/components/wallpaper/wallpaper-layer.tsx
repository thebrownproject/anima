'use client'

import { useWallpaperStore, getWallpaper } from '@/lib/stores/wallpaper-store'

export function WallpaperLayer() {
  const wallpaperId = useWallpaperStore((s) => s.wallpaperId)
  const wallpaper = getWallpaper(wallpaperId)

  return (
    <div
      className="fixed inset-0 -z-10 bg-cover bg-center transition-[background-image] duration-700"
      style={{ backgroundImage: `url(${wallpaper.url})` }}
    />
  )
}
