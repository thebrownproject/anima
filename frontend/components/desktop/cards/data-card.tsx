import * as Icons from '@/components/icons'
import { BaseCard } from './base-card'
import { getCardColor } from './colors'
import type { DesktopCard } from '@/lib/stores/desktop-store'

interface Props {
  card: DesktopCard
  onCardClick?: (card: DesktopCard) => void
}

export function DataCard({ card, onCardClick }: Props) {
  const color = getCardColor('data', card.color)
  const headers = card.headers ?? []
  const rows = (card.previewRows ?? []) as (string | number)[][]

  return (
    <BaseCard color={color} className="w-[400px]">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold">{card.title}</h2>
          <button
            className="p-1 hover:bg-black/5 rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); onCardClick?.(card) }}
          >
            <Icons.ArrowUpRight size={16} className="opacity-50" />
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-black/10 bg-white/50">
          <table className="w-full text-sm text-left">
            <thead className="bg-black/5 text-xs uppercase font-semibold">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 opacity-70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-black/5 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 font-mono text-xs">{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg shadow-sm hover:bg-neutral-800 transition-colors"
            onClick={(e) => { e.stopPropagation(); onCardClick?.(card) }}
          >
            Export CSV
          </button>
          <button
            className="px-3 py-1.5 bg-white border border-black/10 text-xs font-medium rounded-lg shadow-sm hover:bg-neutral-50 transition-colors"
            onClick={(e) => { e.stopPropagation(); onCardClick?.(card) }}
          >
            Edit Data
          </button>
        </div>
      </div>
    </BaseCard>
  )
}
