'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { useDesktopStore, clampCardPosition, CARD_WIDTHS } from '@/lib/stores/desktop-store'
import type { DesktopCard as DesktopCardType } from '@/lib/stores/desktop-store'
import type { CardSize } from '@/types/ws-protocol'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { useMomentum } from '@/hooks/use-momentum'
import { useWebSocket } from './ws-provider'
// SPIKE: card redesign
import { SPIKE_CARDS_ENABLED } from '@/spike/card-redesign/config'
import { CARD_PALETTE, CARD_TEXT, CARD_TEXT_SUBTLE, colorFromId } from '@/spike/card-redesign/palette'

interface DesktopCardProps {
  card: DesktopCardType
  children?: ReactNode
  style?: React.CSSProperties
}

const APPLE_EASE = [0.2, 0.8, 0.2, 1] as const
const SIZE_CYCLE: CardSize[] = ['small', 'medium', 'large', 'full']

export function DesktopCard({ card, children, style }: DesktopCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { send } = useWebSocket()

  // Local position tracked in ref during drag (no re-renders)
  const localPos = useRef({ x: card.position.x, y: card.position.y })

  const syncToStore = useCallback(() => {
    const height = positionRef.current?.offsetHeight ?? undefined
    useDesktopStore.getState().moveCard(card.id, { ...localPos.current }, height)
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

  const getCardHeight = useCallback(() => positionRef.current?.offsetHeight ?? undefined, [])

  const momentum = useMomentum({
    onFrame: (vx, vy) => {
      const { view } = useDesktopStore.getState()
      localPos.current = clampCardPosition(
        localPos.current.x + vx / view.scale,
        localPos.current.y + vy / view.scale,
        getCardHeight(),
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
        getCardHeight(),
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

  // Safety net: if pointer capture is lost (tab switch, DevTools, touch cancel),
  // reset drag state to prevent stuck cursor
  const handleLostPointerCapture = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      syncToStore()
    }
  }, [isDragging, syncToStore])

  const handleResize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const idx = SIZE_CYCLE.indexOf(card.size)
      const next = SIZE_CYCLE[(idx + 1) % SIZE_CYCLE.length]
      useDesktopStore.getState().updateCard(card.id, { size: next })
    },
    [card.id, card.size],
  )

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      // Placeholder — will enable card editing in a future task
    },
    [],
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
      className="pointer-events-auto absolute"
      style={{
        left: card.position.x,
        top: card.position.y,
        zIndex: card.zIndex,
        width: CARD_WIDTHS[card.size] ?? CARD_WIDTHS.medium,
      }}
    >
      <div
        ref={cardRef}
        data-testid="card-drag-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={handleLostPointerCapture}
        style={{
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: isDragging ? 'scale(1.02)' : 'scale(1)',
          userSelect: isDragging ? 'none' : undefined,
          WebkitUserSelect: isDragging ? 'none' : undefined,
        }}
        className={cn(
          SPIKE_CARDS_ENABLED ? 'rounded-xl' : 'rounded-2xl',
          isDragging ? 'shadow-[0_16px_48px_rgba(0,0,0,0.5)]' : 'shadow-none',
        )}
      >
        {SPIKE_CARDS_ENABLED ? (
          /* SPIKE: Opaque editorial card surface */
          <div
            className="group relative overflow-hidden rounded-xl"
            style={{
              background: CARD_PALETTE[colorFromId(card.id)],
              boxShadow: '0 8px 40px rgba(0, 0, 0, 0.25), 0 2px 10px rgba(0, 0, 0, 0.12)',
              ...style,
            }}
          >
            {/* Subtle top-edge highlight for depth/lift */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl"
              style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.5), rgba(255,255,255,0.3), rgba(255,255,255,0.5))' }}
            />
            {/* Floating controls — visible on hover */}
            <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-lg bg-black/8 px-1.5 py-1 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
              <button
                type="button"
                onClick={handleEdit}
                className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-black/10"
                title="Edit"
              >
                <Icons.Edit className="size-3.5 transition-colors" style={{ color: CARD_TEXT_SUBTLE }} />
              </button>
              <button
                type="button"
                onClick={handleResize}
                className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-black/10"
                title={`Resize (${card.size})`}
              >
                <Icons.ArrowsMaximize className="size-3.5 transition-colors" style={{ color: CARD_TEXT_SUBTLE }} />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-black/10"
                title="Close"
              >
                <Icons.X className="size-3.5 transition-colors" style={{ color: CARD_TEXT_SUBTLE }} />
              </button>
            </div>

            {/* Card title — NEWSPAPER HEADLINE */}
            <div className="px-7 pt-7 pb-3">
              <h2
                className="text-[36px] font-black leading-[1.15] tracking-tight"
                style={{ color: CARD_TEXT }}
              >
                {card.title}
              </h2>
            </div>

            {/* Content — stopPropagation so clicks inside don't trigger drag */}
            <div onPointerDown={(e) => e.stopPropagation()}>
              {children}
            </div>
          </div>
        ) : (
          /* Original glass card */
          <GlassCard glowEffect={false}>
            {/* Title bar */}
            <div className="flex h-11 items-center border-b border-white/[0.08] px-4">
              <span className="flex-1 truncate text-[13px] font-medium tracking-tight text-white/90">
                {card.title}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
                  title="Edit"
                >
                  <Icons.Edit className="size-3.5 text-white/40 transition-colors hover:text-white/70" />
                </button>
                <button
                  type="button"
                  onClick={handleResize}
                  className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
                  title={`Resize (${card.size})`}
                >
                  <Icons.ArrowsMaximize className="size-3.5 text-white/40 transition-colors hover:text-white/70" />
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
                  title="Close"
                >
                  <Icons.X className="size-3.5 text-white/40 transition-colors hover:text-white/70" />
                </button>
              </div>
            </div>

            {/* Content — stopPropagation so clicks inside don't trigger drag */}
            <div onPointerDown={(e) => e.stopPropagation()}>
              {children}
            </div>
          </GlassCard>
        )}
      </div>
    </motion.div>
  )
}
