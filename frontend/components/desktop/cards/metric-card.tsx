import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { BaseCard } from './base-card'
import { getCardColor } from './colors'
import type { DesktopCard } from '@/lib/stores/desktop-store'

interface Props {
  card: DesktopCard
  onCardClick: (card: DesktopCard) => void
}

const BARS = [40, 65, 45, 80, 55, 90, 70]

export function MetricCard({ card, onCardClick }: Props) {
  const color = getCardColor('metric', card.color)
  const isUp = card.trendDirection !== 'down'

  return (
    <BaseCard color={color} className="w-[300px] h-[340px]">
      <div className="flex flex-col h-full justify-between">
        <div className="flex justify-between items-start">
          <span className="px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm">
            {card.title}
          </span>
          <button
            className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
            onClick={(e) => { e.stopPropagation(); onCardClick(card) }}
          >
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-6xl font-bold tracking-tighter leading-none mb-2">{card.value ?? '—'}</h3>
          {card.trend && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-md bg-black/5">
                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {card.trend}
              </span>
              <span className="text-xs opacity-60 font-medium">vs last month</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 flex items-end gap-2 h-24">
          {BARS.map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-black/10 rounded-t-sm relative group overflow-hidden"
              style={{ height: `${height}%` }}
            >
              <div className="absolute inset-0 bg-black/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </div>
          ))}
        </div>
      </div>
    </BaseCard>
  )
}
