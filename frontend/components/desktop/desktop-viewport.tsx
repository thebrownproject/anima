'use client'

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDesktopStore, WORLD_WIDTH, WORLD_HEIGHT } from '@/lib/stores/desktop-store'
import { cn } from '@/lib/utils'
import { useMomentum } from '@/hooks/use-momentum'
import { setWallpaperTransform } from '@/components/wallpaper/wallpaper-layer'
import { useFileUpload } from '@/hooks/use-file-upload'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2.0

/** Max empty-space pixels visible past any world edge. */
const VIEW_PADDING = 100

/** Clamp viewport so at most VIEW_PADDING px of empty space shows past world edges.
 *  At high zoom (world larger than screen): bounded panning with padding.
 *  At low zoom (world + padding fits on screen): centers the world.
 */
function clampView(x: number, y: number, scale: number): { x: number; y: number } {
  const sw = typeof window !== 'undefined' ? window.innerWidth : 1920
  const sh = typeof window !== 'undefined' ? window.innerHeight : 1080
  const worldW = WORLD_WIDTH * scale
  const worldH = WORLD_HEIGHT * scale

  const minX = sw - worldW - VIEW_PADDING
  const maxX = VIEW_PADDING
  const minY = sh - worldH - VIEW_PADDING
  const maxY = VIEW_PADDING

  return {
    x: minX > maxX ? (sw - worldW) / 2 : Math.max(minX, Math.min(maxX, x)),
    y: minY > maxY ? (sh - worldH) / 2 : Math.max(minY, Math.min(maxY, y)),
  }
}
const SYNC_DELAY = 150
const SHARP_DELAY = 200

// Zoom lerp — fast enough to feel instant, smooth enough to soften mouse wheel steps
const LERP_SPEED = 0.5
const SETTLE_THRESHOLD = 0.0005

interface ViewSnapshot {
  x: number
  y: number
  scale: number
}

interface ViewportProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
}

export function DesktopViewport({ children, className, ...rest }: ViewportProps) {
  const [isPanning, setIsPanning] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const { sendUpload } = useFileUpload()
  const transformRef = useRef<HTMLDivElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)

  const current = useRef<ViewSnapshot>({ x: 0, y: 0, scale: 1 })
  const target = useRef<ViewSnapshot>({ x: 0, y: 0, scale: 1 })
  const zoomRafId = useRef<number>(0)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sharpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSettled = useRef(true)

  // Seed from Zustand on mount — clamp any persisted out-of-bounds position
  useEffect(() => {
    const v = useDesktopStore.getState().view
    const clamped = clampView(v.x, v.y, v.scale)
    const seeded = { x: clamped.x, y: clamped.y, scale: v.scale }
    current.current = { ...seeded }
    target.current = { ...seeded }
    applySharpMode(seeded)
  }, [])

  const applyAnimationMode = (v: ViewSnapshot) => {
    if (!transformRef.current) return
    const el = transformRef.current
    ;(el.style as unknown as Record<string, string>).zoom = ''
    el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`
    setWallpaperTransform(v.x, v.y, v.scale)
    isSettled.current = false
    updateHud(v)
  }

  const applySharpMode = (v: ViewSnapshot) => {
    if (!transformRef.current) return
    const el = transformRef.current
    ;(el.style as unknown as Record<string, string>).zoom = `${v.scale}`
    el.style.transform = `translate3d(${v.x / v.scale}px, ${v.y / v.scale}px, 0)`
    setWallpaperTransform(v.x, v.y, v.scale)
    isSettled.current = true
    updateHud(v)
  }

  const updateHud = (v: ViewSnapshot) => {
    if (hudRef.current) {
      hudRef.current.textContent = `POS: ${Math.round(v.x)}, ${Math.round(v.y)}  ZM: ${Math.round(v.scale * 100)}%`
    }
  }

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      const c = current.current
      useDesktopStore.getState().setView({ x: c.x, y: c.y, scale: c.scale })
    }, SYNC_DELAY)
  }, [])

  const scheduleSharp = useCallback(() => {
    if (sharpTimer.current) clearTimeout(sharpTimer.current)
    sharpTimer.current = setTimeout(() => {
      applySharpMode(current.current)
      scheduleSync()
    }, SHARP_DELAY)
  }, [scheduleSync])

  // Zoom lerp loop — smooths discrete mouse wheel jumps
  const animateZoom = useCallback(() => {
    const c = current.current
    const t = target.current

    const dx = t.x - c.x
    const dy = t.y - c.y
    const ds = t.scale - c.scale

    if (Math.abs(dx) < SETTLE_THRESHOLD && Math.abs(dy) < SETTLE_THRESHOLD && Math.abs(ds) < SETTLE_THRESHOLD) {
      c.x = t.x
      c.y = t.y
      c.scale = t.scale
      applyAnimationMode(c)
      scheduleSharp()
      zoomRafId.current = 0
      return
    }

    c.x += dx * LERP_SPEED
    c.y += dy * LERP_SPEED
    c.scale += ds * LERP_SPEED
    applyAnimationMode(c)

    zoomRafId.current = requestAnimationFrame(animateZoom)
  }, [scheduleSharp])

  const startZoomAnimation = useCallback(() => {
    if (!zoomRafId.current) {
      zoomRafId.current = requestAnimationFrame(animateZoom)
    }
  }, [animateZoom])

  // Listen for external zoom requests (from context menu, etc.)
  useEffect(() => {
    const handler = (e: Event) => {
      const { scale } = (e as CustomEvent<{ scale: number }>).detail
      const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale))

      // Zoom toward viewport center
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const worldX = (cx - target.current.x) / target.current.scale
      const worldY = (cy - target.current.y) / target.current.scale

      const extClamped = clampView(cx - worldX * clamped, cy - worldY * clamped, clamped)
      target.current = {
        x: extClamped.x,
        y: extClamped.y,
        scale: clamped,
      }

      // Update store scale immediately so UI (menu %) stays responsive
      useDesktopStore.getState().setView({ scale: clamped })

      if (sharpTimer.current) clearTimeout(sharpTimer.current)
      startZoomAnimation()
    }

    window.addEventListener('desktop-zoom', handler)
    return () => window.removeEventListener('desktop-zoom', handler)
  }, [startZoomAnimation])

  // Pan momentum via shared hook
  const momentum = useMomentum({
    onFrame: (vx, vy) => {
      const clamped = clampView(current.current.x + vx, current.current.y + vy, current.current.scale)
      current.current.x = clamped.x
      current.current.y = clamped.y
      applyAnimationMode(current.current)
    },
    onStop: () => {
      applySharpMode(current.current)
      scheduleSync()
    },
  })

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const t = target.current

      const sign = Math.sign(e.deltaY)
      const absDelta = Math.abs(e.deltaY)
      const delta = Math.min(absDelta, 100) * sign

      // Reduced base sensitivity
      let newZoom = t.scale - delta / 500

      // Adaptive boost past 100% (dampened)
      newZoom +=
        Math.log10(Math.max(1, t.scale)) *
        -sign *
        Math.min(0.3, absDelta / 80)

      newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom))

      // Zoom under cursor
      const worldX = (e.clientX - t.x) / t.scale
      const worldY = (e.clientY - t.y) / t.scale

      const zClamped = clampView(e.clientX - worldX * newZoom, e.clientY - worldY * newZoom, newZoom)
      target.current = {
        x: zClamped.x,
        y: zClamped.y,
        scale: newZoom,
      }

      // Cancel sharp timer while actively scrolling
      if (sharpTimer.current) clearTimeout(sharpTimer.current)

      startZoomAnimation()
    },
    [startZoomAnimation],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).id !== 'desktop-canvas-bg') return
      if (e.button === 2) return

      if (momentum.isAnimating()) {
        momentum.cancel()
      }

      setIsPanning(true)
      lastPos.current = { x: e.clientX, y: e.clientY }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [momentum],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return

      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }

      momentum.trackVelocity(dx, dy)

      const clamped = clampView(current.current.x + dx, current.current.y + dy, current.current.scale)
      current.current.x = clamped.x
      current.current.y = clamped.y
      target.current.x = clamped.x
      target.current.y = clamped.y

      applyAnimationMode(current.current)
    },
    [isPanning, momentum],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return
      setIsPanning(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      // Flick -> momentum glide, otherwise settle immediately
      if (!momentum.releaseWithFlick()) {
        applySharpMode(current.current)
        scheduleSync()
      }
    },
    [isPanning, momentum, scheduleSync],
  )

  // Safety net: if pointer capture is lost (tab switch, DevTools, touch cancel),
  // reset panning state to prevent stuck cursor
  const handleLostPointerCapture = useCallback(() => {
    if (isPanning) setIsPanning(false)
  }, [isPanning])

  useEffect(() => {
    return () => {
      if (zoomRafId.current) cancelAnimationFrame(zoomRafId.current)
      if (syncTimer.current) clearTimeout(syncTimer.current)
      if (sharpTimer.current) clearTimeout(sharpTimer.current)
    }
  }, [])

  return (
    <div
      {...rest}
      className={cn("absolute inset-0 overflow-hidden", className)}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onLostPointerCapture={handleLostPointerCapture}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) sendUpload(file)
      }}
    >
      <div id="desktop-canvas-bg" className="absolute inset-0" style={{ cursor: isPanning ? 'grabbing' : 'grab' }} />

      <div
        ref={transformRef}
        className="absolute left-0 top-0 h-full w-full origin-top-left will-change-transform pointer-events-none"
      >
        {children}
      </div>

      <div
        ref={hudRef}
        className="pointer-events-none absolute bottom-5 right-4 z-10 text-right font-mono text-xs text-white/40"
      />
    </div>
  )
}
