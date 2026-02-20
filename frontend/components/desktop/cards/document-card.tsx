import * as Icons from '@/components/icons'
import { BaseCard } from './base-card'
import { getCardColor } from './colors'
import type { DesktopCard } from '@/lib/stores/desktop-store'

interface Props {
  card: DesktopCard
  onCardClick?: (card: DesktopCard) => void
}

export function DocumentCard({ card, onCardClick }: Props) {
  const color = getCardColor('document', card.color)
  const tags = card.tags ?? []

  return (
    <BaseCard color={color} className="w-[400px]">
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-start border-b border-black/5 pb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-black/5 shadow-sm">
            <Icons.FileText size={14} className="opacity-50" />
            <span className="text-xs font-bold uppercase tracking-wider">{card.typeBadge ?? 'Document'}</span>
          </div>
          {card.date && (
            <span className="font-mono text-xs opacity-40 bg-black/5 px-2 py-1 rounded-md">{card.date}</span>
          )}
        </div>

        <div>
          <h2 className="text-4xl font-bold leading-[0.9] tracking-tight mb-4">{card.title}</h2>
          {card.summary && (
            <div className="text-lg leading-relaxed font-medium opacity-70">{card.summary}</div>
          )}
        </div>

        <div className="mt-auto pt-6 flex flex-col gap-4">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 border border-black/10 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors cursor-default"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <button
            className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-between px-6 group"
            onClick={(e) => { e.stopPropagation(); onCardClick?.(card) }}
          >
            <span>Read Report</span>
            <Icons.ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </button>
        </div>
      </div>
    </BaseCard>
  )
}
