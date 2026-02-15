'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { useDesktopStore, clampCardPosition } from '@/lib/stores/desktop-store'
import type { DesktopCard as DesktopCardType } from '@/lib/stores/desktop-store'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { useMomentum } from '@/hooks/use-momentum'
import { useWebSocket } from './ws-provider'

interface DesktopCardProps {
  card: DesktopCardType
  children?: ReactNode
}

const APPLE_EASE = [0.2, 0.8, 0.2, 1] as const

export function DesktopCard({ card, children }: DesktopCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { send } = useWebSocket()

  // Local position tracked in ref during drag (no re-renders)
  const localPos = useRef({ x: card.position.x, y: card.position.y })

  const syncToStore = useCallback(() => {
    useDesktopStore.getState().moveCard(card.id, { ...localPos.current })
    send({
      type: 'canvas_interaction',
      payload: {
        card_id: card.id,
        action: 'move',
        data: {
          position_x: localPos.current.x,
          position_y: localPos.current.y,
          z_index: useDesktopStore.getState().cards[card.id]?.zIndex ?? 0,
        },
      },
    })
  }, [card.id, send])

  const applyPosition = useCallback(() => {
    if (positionRef.current) {
      positionRef.current.style.left = `${localPos.current.x}px`
      positionRef.current.style.top = `${localPos.current.y}px`
    }
  }, [])

  const momentum = useMomentum({
    onFrame: (vx, vy) => {
      const { view } = useDesktopStore.getState()
      localPos.current = clampCardPosition(
        localPos.current.x + vx / view.scale,
        localPos.current.y + vy / view.scale,
      )
      applyPosition()
    },
    onStop: syncToStore,
  })

  // Sync from store when not dragging (external updates like canvas_update)
  useEffect(() => {
    if (!isDragging && !momentum.isAnimating()) {
      localPos.current = { x: card.position.x, y: card.position.y }
    }
  }, [card.position.x, card.position.y, isDragging, momentum])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      useDesktopStore.getState().bringToFront(card.id)

      // Cancel any running momentum
      if (momentum.isAnimating()) {
        momentum.cancel()
      }

      if (!cardRef.current) return
      // Snapshot current position into local ref
      const current = useDesktopStore.getState().cards[card.id]
      if (current) localPos.current = { ...current.position }

      setIsDragging(true)
      cardRef.current.setPointerCapture(e.pointerId)
    },
    [card.id, momentum],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.stopPropagation()

      const { view } = useDesktopStore.getState()
      const clamped = clampCardPosition(
        localPos.current.x + e.movementX / view.scale,
        localPos.current.y + e.movementY / view.scale,
      )
      localPos.current = clamped

      momentum.trackVelocity(e.movementX, e.movementY)
      applyPosition()
    },
    [isDragging, momentum, applyPosition],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.stopPropagation()
      setIsDragging(false)
      cardRef.current?.releasePointerCapture(e.pointerId)

      // Flick -> momentum glide, otherwise snap to final position
      if (!momentum.releaseWithFlick()) {
        syncToStore()
      }
    },
    [isDragging, momentum, syncToStore],
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
        data-testid="card-drag-handle"
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
