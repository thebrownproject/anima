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
          ? 'border-2 border-primary scale-110'
          : 'border border-border hover:border-primary/50 hover:scale-105',
      )}
      style={wallpaper.url
        ? { backgroundImage: `url(${wallpaper.url})` }
        : { backgroundColor: wallpaper.id === 'solid-black' ? '#000' : wallpaper.id === 'solid-white' ? '#e8e8f0' : '#1a1a2e' }
      }
    />
  )
}
