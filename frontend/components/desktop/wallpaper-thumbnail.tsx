'use client'

import { cn } from '@/lib/utils'
import type { Wallpaper } from '@/lib/stores/wallpaper-store'

interface WallpaperThumbnailProps {
  wallpaper: Wallpaper
  selected: boolean
  onSelect: () => void
}

export function WallpaperThumbnail({
  wallpaper,
  selected,
  onSelect,
}: WallpaperThumbnailProps) {
  return (
    <button
      title={wallpaper.name}
      onClick={onSelect}
      className={cn(
        'size-10 cursor-default rounded-full bg-cover bg-center transition-all',
        selected
          ? 'border-2 border-white/50 scale-110'
          : 'border border-white/15 hover:border-white/30 hover:scale-105',
      )}
      style={{ backgroundImage: `url(${wallpaper.url})` }}
    />
  )
}
