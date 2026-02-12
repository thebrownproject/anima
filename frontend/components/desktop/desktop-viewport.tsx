'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDesktopStore } from '@/lib/stores/desktop-store'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2.0
const SYNC_DELAY = 150
const SHARP_DELAY = 200

// Zoom lerp — fast enough to feel instant, smooth enough to soften mouse wheel steps
const LERP_SPEED = 0.5
const SETTLE_THRESHOLD = 0.0005

// Pan momentum
const MOMENTUM_DECAY = 0.92
const MOMENTUM_MIN = 0.5

interface ViewSnapshot {
  x: number
  y: number
  scale: number
}

export function DesktopViewport({ children }: { children?: ReactNode }) {
  const [isPanning, setIsPanning] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const transformRef = useRef<HTMLDivElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)

  const current = useRef<ViewSnapshot>({ x: 0, y: 0, scale: 1 })
  const target = useRef<ViewSnapshot>({ x: 0, y: 0, scale: 1 })
  const zoomRafId = useRef<number>(0)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sharpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSettled = useRef(true)

  // Pan velocity tracking for momentum
  const velocity = useRef({ x: 0, y: 0 })
  const lastMoveTime = useRef(0)
  const momentumRafId = useRef<number>(0)

  // Seed from Zustand on mount
  useEffect(() => {
    const v = useDesktopStore.getState().view
    current.current = { ...v }
    target.current = { ...v }
    applySharpMode(v)
  }, [])

  const applyAnimationMode = (v: ViewSnapshot) => {
    if (!transformRef.current) return
    const el = transformRef.current
    ;(el.style as unknown as Record<string, string>).zoom = ''
    el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`
    isSettled.current = false
    updateHud(v)
  }

  const applySharpMode = (v: ViewSnapshot) => {
    if (!transformRef.current) return
    const el = transformRef.current
    ;(el.style as unknown as Record<string, string>).zoom = `${v.scale}`
    el.style.transform = `translate3d(${v.x / v.scale}px, ${v.y / v.scale}px, 0)`
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

  // Pan momentum animation loop
  const animateMomentum = useCallback(() => {
    const v = velocity.current
    v.x *= MOMENTUM_DECAY
    v.y *= MOMENTUM_DECAY

    if (Math.abs(v.x) < MOMENTUM_MIN && Math.abs(v.y) < MOMENTUM_MIN) {
      momentumRafId.current = 0
      applySharpMode(current.current)
      scheduleSync()
      return
    }

    current.current.x += v.x
    current.current.y += v.y
    applyAnimationMode(current.current)

    momentumRafId.current = requestAnimationFrame(animateMomentum)
  }, [scheduleSync])

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

      target.current = {
        x: e.clientX - worldX * newZoom,
        y: e.clientY - worldY * newZoom,
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

      if (momentumRafId.current) {
        cancelAnimationFrame(momentumRafId.current)
        momentumRafId.current = 0
      }

      setIsPanning(true)
      lastPos.current = { x: e.clientX, y: e.clientY }
      velocity.current = { x: 0, y: 0 }
      lastMoveTime.current = performance.now()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return

      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }

      lastMoveTime.current = performance.now()
      velocity.current.x = dx * 0.6 + velocity.current.x * 0.4
      velocity.current.y = dy * 0.6 + velocity.current.y * 0.4

      current.current.x += dx
      current.current.y += dy
      target.current.x += dx
      target.current.y += dy

      applyAnimationMode(current.current)
    },
    [isPanning],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return
      setIsPanning(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      const timeSinceLastMove = performance.now() - lastMoveTime.current
      const v = velocity.current
      if (timeSinceLastMove < 60 && (Math.abs(v.x) > MOMENTUM_MIN || Math.abs(v.y) > MOMENTUM_MIN)) {
        momentumRafId.current = requestAnimationFrame(animateMomentum)
      } else {
        applySharpMode(current.current)
        scheduleSync()
      }
    },
    [isPanning, animateMomentum, scheduleSync],
  )

  useEffect(() => {
    return () => {
      if (zoomRafId.current) cancelAnimationFrame(zoomRafId.current)
      if (momentumRafId.current) cancelAnimationFrame(momentumRafId.current)
      if (syncTimer.current) clearTimeout(syncTimer.current)
      if (sharpTimer.current) clearTimeout(sharpTimer.current)
    }
  }, [])

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div id="desktop-canvas-bg" className="absolute inset-0 cursor-grab active:cursor-grabbing" />

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
