'use client'

import { useWallpaperStore, WALLPAPERS } from '@/lib/stores/wallpaper-store'

export function WallpaperPicker() {
  const { wallpaperId, setWallpaper } = useWallpaperStore()

  return (
    <div className="flex items-center gap-1.5">
      {WALLPAPERS.map((wp) => (
        <button
          key={wp.id}
          onClick={() => setWallpaper(wp.id)}
          className={`size-6 rounded-full border-2 bg-cover bg-center transition-all ${
            wp.id === wallpaperId
              ? 'scale-110 border-white shadow-lg shadow-white/20'
              : 'border-white/30 hover:scale-105 hover:border-white/60'
          }`}
          style={{ backgroundImage: `url(${wp.url})` }}
          title={wp.name}
        />
      ))}
    </div>
  )
}
