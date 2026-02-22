'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { BlockRenderer } from '@/components/desktop/block-renderer'
import { useDesktopStore, clampCardPosition, snapToGrid, CARD_WIDTHS, TEMPLATE_WIDTHS } from '@/lib/stores/desktop-store'
import type { DesktopCard as DesktopCardType } from '@/lib/stores/desktop-store'
import type { CardSize } from '@/types/ws-protocol'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { useMomentum } from '@/hooks/use-momentum'
import { useWebSocket } from './ws-provider'
import { DocumentCard, MetricCard, TableCard, ArticleCard, DataCard } from '@/components/desktop/cards'
import { getCardColor, COLOR_STYLES } from '@/components/desktop/cards/colors'
import { IconButton } from '@/components/ui/icon-button'

interface DesktopCardProps {
  card: DesktopCardType
  children?: ReactNode
  onCardClick?: (card: DesktopCardType) => void
}

const APPLE_EASE = [0.2, 0.8, 0.2, 1] as const
const SIZE_CYCLE: CardSize[] = ['small', 'medium', 'large', 'full']
const EXPANDED_WIDTH = 650

export function DesktopCard({ card, children, onCardClick }: DesktopCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const { send } = useWebSocket()

  const isExpanded = useDesktopStore((s) => s.expandedCardId === card.id)
  const setExpandedCardId = useDesktopStore((s) => s.setExpandedCardId)

  // Close on Escape when expanded
  useEffect(() => {
    if (!isExpanded) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedCardId(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isExpanded, setExpandedCardId])

  // Ref (not state) to avoid re-renders during drag
  const localPos = useRef({ x: card.position.x, y: card.position.y })

  const baseWidth = card.cardType ? TEMPLATE_WIDTHS[card.cardType] : CARD_WIDTHS[card.size]
  const cardWidth = isExpanded ? Math.max(baseWidth, EXPANDED_WIDTH) : baseWidth

  const applyPosition = useCallback(() => {
    if (positionRef.current) {
      positionRef.current.style.left = `${localPos.current.x}px`
      positionRef.current.style.top = `${localPos.current.y}px`
    }
  }, [])

  const syncToStore = useCallback(() => {
    const height = positionRef.current?.offsetHeight ?? undefined
    const snapped = snapToGrid(localPos.current.x, localPos.current.y)
    localPos.current = snapped
    applyPosition()
    useDesktopStore.getState().moveCard(card.id, snapped, height, cardWidth)
    send({
      type: 'canvas_interaction',
      payload: {
        card_id: card.id,
        action: 'move',
        data: {
          position_x: snapped.x,
          position_y: snapped.y,
          z_index: useDesktopStore.getState().cards[card.id]?.zIndex ?? 0,
        },
      },
    })
  }, [card.id, send, applyPosition, cardWidth])

  const getCardHeight = useCallback(() => positionRef.current?.offsetHeight ?? undefined, [])

  const momentum = useMomentum({
    onFrame: (vx, vy) => {
      const { view } = useDesktopStore.getState()
      localPos.current = clampCardPosition(
        localPos.current.x + vx / view.scale,
        localPos.current.y + vy / view.scale,
        getCardHeight(),
        cardWidth,
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

      pointerDownPos.current = { x: e.clientX, y: e.clientY }

      if (momentum.isAnimating()) {
        momentum.cancel()
      }

      if (!cardRef.current) return
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
        cardWidth,
      )
      localPos.current = clamped

      momentum.trackVelocity(e.movementX, e.movementY)
      applyPosition()
    },
    [isDragging, momentum, applyPosition, cardWidth, getCardHeight],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.stopPropagation()
      setIsDragging(false)
      cardRef.current?.releasePointerCapture(e.pointerId)

      // Click discrimination: < 5px travel = click, not drag
      if (pointerDownPos.current) {
        const dist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y)
        pointerDownPos.current = null
        if (dist < 5) {
          onCardClick?.(card)
          return
        }
      }

      if (!momentum.releaseWithFlick()) {
        syncToStore()
      }
    },
    [isDragging, momentum, syncToStore, onCardClick, card],
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
      send({
        type: 'canvas_interaction',
        payload: { card_id: card.id, action: 'archive_card', data: {} },
      })
    },
    [card.id, send],
  )

  // Center expansion: offset position so growth is from center, not top-left
  const expandOffset = isExpanded ? (cardWidth - baseWidth) / 2 : 0

  // Card colors for expanded state
  const cardColor = card.cardType ? getCardColor(card.cardType, card.color) : 'white'
  const colorStyle = COLOR_STYLES[cardColor]

  return (
    <motion.div
      ref={positionRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        width: cardWidth,
        x: -expandOffset,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: APPLE_EASE }}
      className="pointer-events-auto absolute"
      style={{
        left: card.position.x,
        top: card.position.y,
        zIndex: isExpanded ? 9999 : card.zIndex,
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
          'rounded-[40px]',
          isDragging ? 'shadow-[0_16px_48px_rgba(0,0,0,0.5)]' : isExpanded ? 'shadow-[0_32px_80px_rgba(0,0,0,0.25)]' : 'shadow-none',
        )}
      >
        {isExpanded ? (
          <div
            className="flex flex-col overflow-hidden rounded-[40px]"
            style={{ backgroundColor: colorStyle.bg, color: colorStyle.text }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-xl font-extrabold tracking-tight">{card.title}</h2>
              <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <IconButton
                  icon={<Icons.ChevronDown />}
                  tooltip="Minimise"
                  tooltipSide="left"
                  onClick={() => setExpandedCardId(null)}
                />
              </div>
            </div>
            {/* Full content */}
            <div>
              <BlockRenderer blocks={card.blocks} theme="editorial" />
            </div>
          </div>
        ) : (
          (() => {
            switch (card.cardType) {
              case 'document':
                return <DocumentCard card={card} onCardClick={onCardClick} />
              case 'metric':
                return <MetricCard card={card} onCardClick={onCardClick} />
              case 'table':
                return <TableCard card={card} onCardClick={onCardClick} />
              case 'article':
                return <ArticleCard card={card} onCardClick={onCardClick} />
              case 'data':
                return <DataCard card={card} onCardClick={onCardClick} />
              default:
                return (
                  <Card className="gap-0 overflow-hidden rounded-2xl p-0">
                    <div className="flex h-11 items-center border-b border-border px-4">
                      <span className="flex-1 truncate text-[13px] font-medium tracking-tight text-card-foreground">
                        {card.title}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={handleEdit}
                          className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent"
                          title="Edit"
                        >
                          <Icons.Edit className="size-3.5 text-muted-foreground transition-colors hover:text-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={handleResize}
                          className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent"
                          title={`Resize (${card.size})`}
                        >
                          <Icons.ArrowsMaximize className="size-3.5 text-muted-foreground transition-colors hover:text-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent"
                          title="Close"
                        >
                          <Icons.X className="size-3.5 text-muted-foreground transition-colors hover:text-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* stopPropagation so clicks inside don't trigger drag */}
                    <div onPointerDown={(e) => e.stopPropagation()}>
                      {children}
                    </div>
                  </Card>
                )
            }
          })()
        )}
      </div>
    </motion.div>
  )
}
