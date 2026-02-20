import { BaseCard } from './base-card'
import { getCardColor } from './colors'
import type { DesktopCard } from '@/lib/stores/desktop-store'

interface Props {
  card: DesktopCard
  onCardClick?: (card: DesktopCard) => void
}

export function ArticleCard({ card, onCardClick }: Props) {
  const color = getCardColor('article', card.color)

  return (
    <BaseCard color={color} className="w-[500px] h-[600px]">
      <div className="flex flex-col h-full">
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <span className="px-3 py-1 rounded-full border border-black/10 text-xs font-medium uppercase tracking-wider">
              Article
            </span>
            {card.readTime && (
              <span className="text-xs font-mono opacity-50">{card.readTime}</span>
            )}
          </div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight mb-2">{card.title}</h1>
        </div>

        <div
          className="flex-1 overflow-y-auto pr-2 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onCardClick?.(card) }}
        >
          <div className="text-base leading-relaxed opacity-90 whitespace-pre-wrap font-serif">
            {card.summary ?? ''}
          </div>
        </div>

        {card.author && (
          <div className="mt-6 pt-6 border-t border-black/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-black/10 flex-shrink-0" />
            <span className="text-sm font-medium">{card.author}</span>
          </div>
        )}
      </div>
    </BaseCard>
  )
}
