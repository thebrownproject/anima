import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Wallpaper {
  id: string
  name: string
  url: string
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'purple-waves', name: 'Purple Waves', url: '/wallpapers/purple-waves.jpg' },
  { id: 'aurora', name: 'Aurora', url: '/wallpapers/aurora.jpg' },
  { id: 'coral', name: 'Coral', url: '/wallpapers/coral.jpg' },
]

interface WallpaperState {
  wallpaperId: string
  setWallpaper: (id: string) => void
}

export const useWallpaperStore = create<WallpaperState>()(
  persist(
    (set) => ({
      wallpaperId: WALLPAPERS[0].id,
      setWallpaper: (id) => set({ wallpaperId: id }),
    }),
    { name: 'stackdocs-wallpaper' }
  )
)

export function getWallpaper(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0]
}
