'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import type { DesktopCard as DesktopCardType } from '@/lib/stores/desktop-store'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'

interface DesktopCardProps {
  card: DesktopCardType
  children?: ReactNode
}

const APPLE_EASE = [0.2, 0.8, 0.2, 1] as const

export function DesktopCard({ card, children }: DesktopCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Local position tracked in ref during drag (no re-renders)
  const localPos = useRef({ x: card.position.x, y: card.position.y })

  // Sync from store when not dragging (external updates like canvas_update)
  useEffect(() => {
    if (!isDragging) {
      localPos.current = { x: card.position.x, y: card.position.y }
    }
  }, [card.position.x, card.position.y, isDragging])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      useDesktopStore.getState().bringToFront(card.id)

      if (!cardRef.current) return
      // Snapshot current position into local ref
      const current = useDesktopStore.getState().cards[card.id]
      if (current) localPos.current = { ...current.position }

      setIsDragging(true)
      cardRef.current.setPointerCapture(e.pointerId)
    },
    [card.id],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.stopPropagation()

      const { view } = useDesktopStore.getState()
      localPos.current.x += e.movementX / view.scale
      localPos.current.y += e.movementY / view.scale

      // Direct DOM update — no React re-render
      if (positionRef.current) {
        positionRef.current.style.left = `${localPos.current.x}px`
        positionRef.current.style.top = `${localPos.current.y}px`
      }
    },
    [isDragging],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.stopPropagation()
      setIsDragging(false)
      cardRef.current?.releasePointerCapture(e.pointerId)

      // Sync final position to Zustand on drop
      useDesktopStore.getState().moveCard(card.id, { ...localPos.current })
    },
    [isDragging, card.id],
  )

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      useDesktopStore.getState().removeCard(card.id)
    },
    [card.id],
  )

  return (
    <motion.div
      ref={positionRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, ease: APPLE_EASE }}
      className="pointer-events-auto absolute w-80"
      style={{
        left: card.position.x,
        top: card.position.y,
        zIndex: card.zIndex,
      }}
    >
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : undefined,
          transform: isDragging ? 'scale(1.02)' : undefined,
          userSelect: isDragging ? 'none' : undefined,
          WebkitUserSelect: isDragging ? 'none' : undefined,
        }}
        className={cn(isDragging && 'shadow-[0_16px_48px_rgba(0,0,0,0.5)]')}
      >
        <GlassCard glowEffect={false}>
          {/* Title bar */}
          <div className="flex h-11 items-center border-b border-white/10 px-3">
            <span className="flex-1 truncate text-sm font-medium text-white/90">
              {card.title}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="flex size-7 items-center justify-center rounded hover:bg-white/10"
            >
              <Icons.X className="size-4 text-white/60" />
            </button>
          </div>

          {/* Content — stopPropagation so clicks inside don't trigger drag */}
          <div onPointerDown={(e) => e.stopPropagation()}>
            {children}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  )
}
