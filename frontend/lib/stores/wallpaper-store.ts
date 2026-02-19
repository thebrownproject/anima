import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Wallpaper {
  id: string
  name: string
  url: string
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'solid-black', name: 'Black', url: '' },
  { id: 'solid-grey', name: 'Grey', url: '' },
  { id: 'solid-white', name: 'White', url: '' },
  { id: 'purple-blue-grain', name: 'Purple Blue Grain', url: '/wallpapers/purple-blue-grain.jpg' },
  { id: 'deep-purple-gradient', name: 'Deep Purple Gradient', url: '/wallpapers/deep-purple-gradient.jpg' },
  { id: 'blue-pink-gradient', name: 'Blue Pink Gradient', url: '/wallpapers/blue-pink-gradient.jpg' },
  { id: 'dynamic-grain', name: 'Dynamic Grain', url: '/wallpapers/dynamic-grain.jpg' },
  { id: 'purple-haze', name: 'Purple Haze', url: '/wallpapers/purple-haze.jpg' },
  { id: 'blues-to-purple', name: 'Blues to Purple', url: '/wallpapers/blues-to-purple.jpg' },
  { id: 'blue-beige-glow', name: 'Blue Beige Glow', url: '/wallpapers/blue-beige-glow.jpg' },
  { id: 'deep-blue-purple', name: 'Deep Blue Purple', url: '/wallpapers/deep-blue-purple.jpg' },
  { id: 'colorful-grain', name: 'Colorful Grain', url: '/wallpapers/colorful-grain.jpg' },
  { id: 'purple-fabric', name: 'Purple Fabric', url: '/wallpapers/purple-fabric.jpg' },
  { id: 'purple-grey-soft', name: 'Purple Grey Soft', url: '/wallpapers/purple-grey-soft.jpg' },
  { id: 'lavender-white', name: 'Lavender White', url: '/wallpapers/lavender-white.jpg' },
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
