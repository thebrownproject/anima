'use client'

import { type ReactNode } from 'react'
import * as Icons from '@/components/icons'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
} from '@/components/ui/context-menu'
import { WALLPAPERS, useWallpaperStore } from '@/lib/stores/wallpaper-store'
import { WallpaperThumbnail } from '@/components/desktop/wallpaper-thumbnail'
import { useDesktopStore } from '@/lib/stores/desktop-store'

const ZOOM_STEP = 0.25

function dispatchZoom(scale: number) {
  window.dispatchEvent(new CustomEvent('desktop-zoom', { detail: { scale } }))
}

/** Shared menu body — used by both right-click context menu and tab "..." popover */
export function DesktopMenuBody() {
  const wallpaperId = useWallpaperStore((s) => s.wallpaperId)
  const setWallpaper = useWallpaperStore((s) => s.setWallpaper)
  const currentScale = useDesktopStore((s) => s.view.scale)

  return (
    <>
      {/* Stack */}
      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Stack
      </p>
      <button
        disabled
        className="flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground opacity-40 transition-colors"
      >
        <Icons.Edit className="size-4" />
        <span>Rename Stack</span>
      </button>
      <button
        disabled
        className="flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground opacity-40 transition-colors"
      >
        <Icons.Settings className="size-4" />
        <span>Stack Settings</span>
      </button>

      <div className="mx-2 my-1 h-px bg-border" />

      {/* View */}
      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        View
      </p>
      <div className="grid grid-cols-3 gap-1 px-1 pb-1">
        <button
          onClick={() => dispatchZoom(currentScale - ZOOM_STEP)}
          className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Icons.ZoomOut className="size-4" />
        </button>
        <button
          onClick={() => dispatchZoom(1)}
          className="flex items-center justify-center rounded-lg p-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {Math.round(currentScale * 100)}%
        </button>
        <button
          onClick={() => dispatchZoom(currentScale + ZOOM_STEP)}
          className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Icons.ZoomIn className="size-4" />
        </button>
      </div>
      <button
        disabled
        className="flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground opacity-40 transition-colors"
      >
        <Icons.LayoutGrid className="size-4" />
        <span>Clean Up By Name</span>
      </button>

      <div className="mx-2 my-1 h-px bg-border" />

      {/* Environment */}
      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Environment
      </p>
      <div className="grid grid-cols-3 place-items-center gap-3 px-1 py-2">
        {WALLPAPERS.map((wp) => (
          <WallpaperThumbnail
            key={wp.id}
            wallpaper={wp}
            selected={wallpaperId === wp.id}
            onSelect={() => setWallpaper(wp.id)}
          />
        ))}
      </div>
    </>
  )
}

export function DesktopContextMenu({ children }: { children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[14rem] rounded-xl p-1.5">
        <DesktopMenuBody />
      </ContextMenuContent>
    </ContextMenu>
  )
}
