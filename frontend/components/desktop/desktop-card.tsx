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

// Momentum physics — matched to DesktopViewport for consistent feel
const MOMENTUM_DECAY = 0.92
const MOMENTUM_MIN = 0.5
const FLICK_WINDOW = 60 // ms — must move within this window to trigger glide

export function DesktopCard({ card, children }: DesktopCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Local position tracked in ref during drag (no re-renders)
  const localPos = useRef({ x: card.position.x, y: card.position.y })

  // Velocity tracking for drag momentum
  const velocity = useRef({ x: 0, y: 0 })
  const lastMoveTime = useRef(0)
  const momentumRafId = useRef<number>(0)

  // Sync from store when not dragging (external updates like canvas_update)
  useEffect(() => {
    if (!isDragging && !momentumRafId.current) {
      localPos.current = { x: card.position.x, y: card.position.y }
    }
  }, [card.position.x, card.position.y, isDragging])

  // Cleanup momentum RAF on unmount
  useEffect(() => {
    return () => {
      if (momentumRafId.current) cancelAnimationFrame(momentumRafId.current)
    }
  }, [])

  const syncToStore = useCallback(() => {
    useDesktopStore.getState().moveCard(card.id, { ...localPos.current })
  }, [card.id])

  const animateMomentum = useCallback(() => {
    const v = velocity.current
    v.x *= MOMENTUM_DECAY
    v.y *= MOMENTUM_DECAY

    if (Math.abs(v.x) < MOMENTUM_MIN && Math.abs(v.y) < MOMENTUM_MIN) {
      momentumRafId.current = 0
      syncToStore()
      return
    }

    const { view } = useDesktopStore.getState()
    localPos.current.x += v.x / view.scale
    localPos.current.y += v.y / view.scale

    if (positionRef.current) {
      positionRef.current.style.left = `${localPos.current.x}px`
      positionRef.current.style.top = `${localPos.current.y}px`
    }

    momentumRafId.current = requestAnimationFrame(animateMomentum)
  }, [syncToStore])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      useDesktopStore.getState().bringToFront(card.id)

      // Cancel any running momentum
      if (momentumRafId.current) {
        cancelAnimationFrame(momentumRafId.current)
        momentumRafId.current = 0
        syncToStore()
      }

      if (!cardRef.current) return
      // Snapshot current position into local ref
      const current = useDesktopStore.getState().cards[card.id]
      if (current) localPos.current = { ...current.position }

      velocity.current = { x: 0, y: 0 }
      lastMoveTime.current = performance.now()
      setIsDragging(true)
      cardRef.current.setPointerCapture(e.pointerId)
    },
    [card.id, syncToStore],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.stopPropagation()

      const { view } = useDesktopStore.getState()
      localPos.current.x += e.movementX / view.scale
      localPos.current.y += e.movementY / view.scale

      // Track velocity with exponential moving average (same blend as viewport)
      lastMoveTime.current = performance.now()
      velocity.current.x = e.movementX * 0.6 + velocity.current.x * 0.4
      velocity.current.y = e.movementY * 0.6 + velocity.current.y * 0.4

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

      // Flick → momentum glide, otherwise snap to final position
      const timeSinceLastMove = performance.now() - lastMoveTime.current
      const v = velocity.current
      if (timeSinceLastMove < FLICK_WINDOW && (Math.abs(v.x) > MOMENTUM_MIN || Math.abs(v.y) > MOMENTUM_MIN)) {
        momentumRafId.current = requestAnimationFrame(animateMomentum)
      } else {
        syncToStore()
      }
    },
    [isDragging, animateMomentum, syncToStore],
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
          transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: isDragging ? 'scale(1.02)' : 'scale(1)',
          userSelect: isDragging ? 'none' : undefined,
          WebkitUserSelect: isDragging ? 'none' : undefined,
        }}
        className={cn('rounded-2xl', isDragging ? 'shadow-[0_16px_48px_rgba(0,0,0,0.5)]' : 'shadow-none')}
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
