'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useDesktopStore } from '@/lib/stores/desktop-store'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2.0
const ZOOM_SENSITIVITY = -0.001

export function DesktopViewport({ children }: { children?: ReactNode }) {
  const view = useDesktopStore((s) => s.view)
  const [isPanning, setIsPanning] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const { view: v, setView: sv } = useDesktopStore.getState()
      const delta = e.deltaY * ZOOM_SENSITIVITY
      const newScale = Math.min(Math.max(v.scale + delta, ZOOM_MIN), ZOOM_MAX)

      // Zoom under cursor: convert screen → world, then recalculate offset
      const worldX = (e.clientX - v.x) / v.scale
      const worldY = (e.clientY - v.y) / v.scale

      sv({
        x: e.clientX - worldX * newScale,
        y: e.clientY - worldY * newScale,
        scale: newScale,
      })
    },
    []
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only pan on the canvas background (not on cards)
      if ((e.target as HTMLElement).id !== 'desktop-canvas-bg') return
      if (e.button === 2) return // ignore right-click

      setIsPanning(true)
      lastPos.current = { x: e.clientX, y: e.clientY }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return

      const { view: v, setView: sv } = useDesktopStore.getState()
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      sv({ x: v.x + dx, y: v.y + dy })
      lastPos.current = { x: e.clientX, y: e.clientY }
    },
    [isPanning]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return
      setIsPanning(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [isPanning]
  )

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Hit area for pan — sits behind cards */}
      <div id="desktop-canvas-bg" className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Transformed container — children positioned in world space */}
      <div
        className="absolute left-0 top-0 h-full w-full origin-top-left will-change-transform pointer-events-none"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        {children}
      </div>

      {/* Position/zoom indicator */}
      <div className="pointer-events-none absolute bottom-5 right-4 z-10 text-right font-mono text-xs text-white/40">
        <div>POS: {Math.round(view.x)}, {Math.round(view.y)}</div>
        <div>ZM: {Math.round(view.scale * 100)}%</div>
      </div>
    </div>
  )
}
