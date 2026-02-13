'use client'

import { type ReactNode } from 'react'
import * as Icons from '@/components/icons'
import {
  GlassContextMenu,
  GlassContextMenuTrigger,
  GlassContextMenuContent,
  GlassContextMenuItem,
  GlassContextMenuLabel,
  GlassContextMenuSeparator,
} from '@/components/ui/glass-context-menu'
import { WALLPAPERS, useWallpaperStore } from '@/lib/stores/wallpaper-store'
import { useDesktopStore } from '@/lib/stores/desktop-store'

const ZOOM_STEP = 0.25

function dispatchZoom(scale: number) {
  window.dispatchEvent(new CustomEvent('desktop-zoom', { detail: { scale } }))
}

export function DesktopContextMenu({ children }: { children: ReactNode }) {
  const wallpaperId = useWallpaperStore((s) => s.wallpaperId)
  const setWallpaper = useWallpaperStore((s) => s.setWallpaper)
  const currentScale = useDesktopStore((s) => s.view.scale)

  return (
    <GlassContextMenu>
      <GlassContextMenuTrigger asChild>
        {children}
      </GlassContextMenuTrigger>

      <GlassContextMenuContent>
        {/* Environment */}
        <GlassContextMenuLabel>Environment</GlassContextMenuLabel>

        {WALLPAPERS.map((wp) => (
          <GlassContextMenuItem
            key={wp.id}
            onClick={() => setWallpaper(wp.id)}
          >
            <div
              className="size-7 shrink-0 rounded-md bg-cover bg-center ring-1 ring-white/20"
              style={{ backgroundImage: `url(${wp.url})` }}
            />
            <span className="flex-1">{wp.name}</span>
            {wallpaperId === wp.id && (
              <Icons.Check className="size-3 text-white/50" />
            )}
          </GlassContextMenuItem>
        ))}

        <GlassContextMenuSeparator />

        {/* View */}
        <GlassContextMenuLabel>View</GlassContextMenuLabel>

        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          <button
            onClick={() => dispatchZoom(currentScale - ZOOM_STEP)}
            className="flex items-center justify-center rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Icons.ZoomOut className="size-4" />
          </button>
          <button
            onClick={() => dispatchZoom(1)}
            className="flex items-center justify-center rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Icons.ZoomReset className="size-4" />
          </button>
          <button
            onClick={() => dispatchZoom(currentScale + ZOOM_STEP)}
            className="flex items-center justify-center rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Icons.ZoomIn className="size-4" />
          </button>
        </div>

        <GlassContextMenuItem disabled>
          <Icons.LayoutGrid className="size-4" />
          <span>Clean Up By Name</span>
        </GlassContextMenuItem>

        <GlassContextMenuSeparator />

        {/* Stack */}
        <GlassContextMenuLabel>Stack</GlassContextMenuLabel>

        <GlassContextMenuItem disabled>
          <Icons.Edit className="size-4" />
          <span>Rename Stack</span>
        </GlassContextMenuItem>
        <GlassContextMenuItem disabled>
          <Icons.Settings className="size-4" />
          <span>Stack Settings</span>
        </GlassContextMenuItem>
      </GlassContextMenuContent>
    </GlassContextMenu>
  )
}
