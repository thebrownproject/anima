import * as Icons from '@/components/icons'
import { BaseCard } from './base-card'
import { getCardColor } from './colors'
import { exportAsCSV, exportAsJSON } from '@/lib/export'
import type { DesktopCard } from '@/lib/stores/desktop-store'

interface Props {
  card: DesktopCard
  onCardClick?: (card: DesktopCard) => void
}

export function TableCard({ card, onCardClick }: Props) {
  const color = getCardColor('table', card.color)
  const headers = card.headers ?? []
  const rows = (card.previewRows ?? []) as string[][]
  const isEmpty = headers.length === 0 && rows.length === 0

  return (
    <BaseCard color={color} className="w-[600px]">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{card.title}</h2>
            {card.typeBadge && (
              <span className="px-2.5 py-1 bg-white/10 rounded-md text-xs font-semibold uppercase tracking-wider text-white/60">
                {card.typeBadge}
              </span>
            )}
          </div>
          <button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onCardClick?.(card) }}
          >
            <Icons.ArrowUpRight size={18} />
          </button>
        </div>

        {isEmpty ? (
          <div className="flex-1 flex items-center justify-center py-12 text-sm opacity-40">
            No data yet
          </div>
        ) : (
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
        )}

        <div className="mt-6 flex justify-between items-center">
          <span className="text-xs opacity-40 font-mono">{rows.length} entries</span>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-xs font-medium rounded-lg hover:bg-white/20 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              disabled={isEmpty}
              onClick={(e) => { e.stopPropagation(); exportAsCSV(headers, rows, card.title) }}
            >
              <Icons.Csv size={14} />
              CSV
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-xs font-medium rounded-lg hover:bg-white/20 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              disabled={isEmpty}
              onClick={(e) => { e.stopPropagation(); exportAsJSON(headers, rows, card.title) }}
            >
              <Icons.Json size={14} />
              JSON
            </button>
          </div>
        </div>
      </div>
    </BaseCard>
  )
}
