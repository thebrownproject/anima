import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Wallpaper {
  id: string
  name: string
  url: string
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'purple-waves', name: 'Purple Waves', url: '/wallpapers/purple-waves.jpg' },
  { id: 'neon-silk', name: 'Neon Silk', url: '/wallpapers/neon-silk.jpg' },
  { id: 'amethyst-tide', name: 'Amethyst Tide', url: '/wallpapers/amethyst-tide.jpg' },
  { id: 'electric-dusk', name: 'Electric Dusk', url: '/wallpapers/electric-dusk.jpg' },
  { id: 'ocean-breeze', name: 'Ocean Breeze', url: '/wallpapers/ocean-breeze.jpg' },
  { id: 'cosmic-spiral', name: 'Cosmic Spiral', url: '/wallpapers/cosmic-spiral.jpg' },
  { id: 'neon-ribbon', name: 'Neon Ribbon', url: '/wallpapers/neon-ribbon.jpg' },
  { id: 'crimson-wave', name: 'Crimson Wave', url: '/wallpapers/crimson-wave.jpg' },
  { id: 'scarlet-bloom', name: 'Scarlet Bloom', url: '/wallpapers/scarlet-bloom.jpg' },
  { id: 'coral-tide', name: 'Coral Tide', url: '/wallpapers/coral-tide.jpg' },
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
