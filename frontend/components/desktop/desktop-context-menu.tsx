'use client'

import { type ReactNode } from 'react'
import * as Icons from '@/components/icons'
import {
  GlassContextMenu,
  GlassContextMenuTrigger,
  GlassContextMenuContent,
} from '@/components/ui/glass-context-menu'
import { WALLPAPERS, useWallpaperStore } from '@/lib/stores/wallpaper-store'
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
      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
        Stack
      </p>
      <button
        disabled
        className="flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 opacity-40 transition-colors"
      >
        <Icons.Edit className="size-4" />
        <span>Rename Stack</span>
      </button>
      <button
        disabled
        className="flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 opacity-40 transition-colors"
      >
        <Icons.Settings className="size-4" />
        <span>Stack Settings</span>
      </button>

      <div className="mx-2 my-1 h-px bg-white/10" />

      {/* View */}
      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
        View
      </p>
      <div className="grid grid-cols-3 gap-1 px-1 pb-1">
        <button
          onClick={() => dispatchZoom(currentScale - ZOOM_STEP)}
          className="flex items-center justify-center rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Icons.ZoomOut className="size-4" />
        </button>
        <button
          onClick={() => dispatchZoom(1)}
          className="flex items-center justify-center rounded-lg p-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          {Math.round(currentScale * 100)}%
        </button>
        <button
          onClick={() => dispatchZoom(currentScale + ZOOM_STEP)}
          className="flex items-center justify-center rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Icons.ZoomIn className="size-4" />
        </button>
      </div>
      <button
        disabled
        className="flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 opacity-40 transition-colors"
      >
        <Icons.LayoutGrid className="size-4" />
        <span>Clean Up By Name</span>
      </button>

      <div className="mx-2 my-1 h-px bg-white/10" />

      {/* Environment */}
      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
        Environment
      </p>
      {WALLPAPERS.map((wp) => (
        <button
          key={wp.id}
          onClick={() => setWallpaper(wp.id)}
          className="relative flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <div
            className="size-7 shrink-0 rounded-full bg-cover bg-center ring-1 ring-white/20"
            style={{ backgroundImage: `url(${wp.url})` }}
          />
          <span className="flex-1 text-left">{wp.name}</span>
          {wallpaperId === wp.id && (
            <Icons.Check className="size-3 text-white/50" />
          )}
        </button>
      ))}
    </>
  )
}

export function DesktopContextMenu({ children }: { children: ReactNode }) {
  return (
    <GlassContextMenu>
      <GlassContextMenuTrigger asChild>
        {children}
      </GlassContextMenuTrigger>
      <GlassContextMenuContent>
        <DesktopMenuBody />
      </GlassContextMenuContent>
    </GlassContextMenu>
  )
}
