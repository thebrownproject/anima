'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import * as Icons from '@/components/icons'
import { BlockRenderer } from '@/components/desktop/block-renderer'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { getCardColor, COLOR_STYLES } from '@/components/desktop/cards/colors'
import type { DesktopCard } from '@/lib/stores/desktop-store'

interface OverlayContextValue {
  setOverlayCardId: (id: string | null) => void
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

export function useCardOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext)
  if (!ctx) throw new Error('useCardOverlay must be used within CardOverlayProvider')
  return ctx
}

interface CardOverlayProps {
  card: DesktopCard | null
  onClose: () => void
}

function CardOverlayPanel({ card, onClose }: CardOverlayProps) {
  const cardColor = card?.cardType ? getCardColor(card.cardType, card.color) : 'white'
  const { bg, text } = COLOR_STYLES[cardColor]

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Close if card is deleted while overlay is open
  const cards = useDesktopStore((s) => s.cards)
  useEffect(() => {
    if (card && !cards[card.id]) onClose()
  }, [card, cards, onClose])

  const isOpen = card !== null

  return (
    <div
      data-testid="card-overlay"
      aria-modal="true"
      role="dialog"
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        data-testid="overlay-backdrop"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content panel */}
      <div
        className={`relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[40px] shadow-[0_32px_80px_rgba(0,0,0,0.5)] transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        style={{ backgroundColor: bg, color: text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-7 pt-6 pb-4">
          <h2 className="text-[22px] font-extrabold leading-tight tracking-tight" style={{ color: text }}>
            {card?.title}
          </h2>
          <button
            type="button"
            data-testid="overlay-close-button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-black/10"
            aria-label="Close overlay"
          >
            <Icons.X className="size-5" style={{ color: text }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {card && <BlockRenderer blocks={card.blocks} theme="editorial" />}
        </div>
      </div>
    </div>
  )
}

interface CardOverlayProviderProps {
  overlayCardId: string | null
  setOverlayCardId: (id: string | null) => void
  children: ReactNode
}

export function CardOverlayProvider({ overlayCardId, setOverlayCardId, children }: CardOverlayProviderProps) {
  const card = useDesktopStore((s) => (overlayCardId ? (s.cards[overlayCardId] ?? null) : null))

  return (
    <OverlayContext.Provider value={{ setOverlayCardId }}>
      {children}
      <CardOverlayPanel card={card} onClose={() => setOverlayCardId(null)} />
    </OverlayContext.Provider>
  )
}
