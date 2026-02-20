import { ArrowUpRight } from 'lucide-react'
import { BaseCard } from './base-card'
import { getCardColor } from './colors'
import type { DesktopCard } from '@/lib/stores/desktop-store'

interface Props {
  card: DesktopCard
  onCardClick?: (card: DesktopCard) => void
}

export function TableCard({ card, onCardClick }: Props) {
  const color = getCardColor('table', card.color)
  const headers = card.headers ?? []
  const rows = (card.previewRows ?? []) as string[][]

  return (
    <BaseCard color={color} className="w-[600px]">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">{card.title}</h2>
          <button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onCardClick?.(card) }}
          >
            <ArrowUpRight size={18} />
          </button>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                {headers.map((h, i) => (
                  <th key={i} className="py-3 px-2 text-xs font-mono uppercase opacity-50 tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="group hover:bg-white/5 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="py-4 px-2 text-sm border-b border-white/5 font-medium group-last:border-none">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-between items-center text-xs opacity-40 font-mono">
          <span>{rows.length} entries</span>
          <span>Synced just now</span>
        </div>
      </div>
    </BaseCard>
  )
}
