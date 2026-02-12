import type {
  Block,
  HeadingBlock,
  StatBlock,
  KeyValueBlock,
  TableBlock,
  BadgeBlock,
  ProgressBlock,
  TextBlock,
} from '@/types/ws-protocol'

const BADGE_STYLES: Record<string, string> = {
  default: 'bg-white/15 text-white/80',
  success: 'bg-emerald-500/20 text-emerald-300',
  warning: 'bg-amber-500/20 text-amber-300',
  destructive: 'bg-red-500/20 text-red-300',
}

function Heading({ text, subtitle }: HeadingBlock) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/90">{text}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>}
    </div>
  )
}

function Stat({ value, label, trend }: StatBlock) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums text-white/90">{value}</span>
      <span className="text-xs text-white/50">{label}</span>
      {trend && <span className="text-xs text-white/40">{trend}</span>}
    </div>
  )
}

function KeyValue({ pairs }: KeyValueBlock) {
  return (
    <dl className="space-y-1.5 text-sm">
      {pairs.map((p) => (
        <div key={p.label} className="flex justify-between gap-4">
          <dt className="text-white/50">{p.label}</dt>
          <dd className="text-right text-white/90">{p.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Table({ columns, rows }: TableBlock) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-white/90">
        <thead>
          <tr className="border-b border-white/20 text-left text-xs uppercase text-white/50">
            {columns.map((col) => (
              <th key={col} className="pb-2 pr-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} className="py-2 pr-3">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Badge({ text, variant }: BadgeBlock) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs ${BADGE_STYLES[variant] ?? BADGE_STYLES.default}`}
    >
      {text}
    </span>
  )
}

function Progress({ value, label }: ProgressBlock) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-white/60">{label}</span>
          <span className="tabular-nums text-white/50">{clamped}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/40 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

function Text({ content }: TextBlock) {
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{content}</p>
}

function renderBlock(block: Block) {
  switch (block.type) {
    case 'heading':
      return <Heading key={block.id} {...block} />
    case 'stat':
      return <Stat key={block.id} {...block} />
    case 'key-value':
      return <KeyValue key={block.id} {...block} />
    case 'table':
      return <Table key={block.id} {...block} />
    case 'badge':
      return <Badge key={block.id} {...block} />
    case 'progress':
      return <Progress key={block.id} {...block} />
    case 'text':
      return <Text key={block.id} {...block} />
    case 'separator':
      return <div key={block.id} className="border-t border-white/10" />
    default:
      return null
  }
}

interface BlockRendererProps {
  blocks: Block[]
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
  if (!blocks.length) {
    return <div className="p-4 text-sm text-white/40">No content</div>
  }
  return <div className="space-y-3 p-4">{blocks.map(renderBlock)}</div>
}
