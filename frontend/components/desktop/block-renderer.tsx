import type {
  Block,
  HeadingBlock,
  StatBlock,
  KeyValueBlock,
  TableBlock,
  BadgeBlock,
  ProgressBlock,
  TextBlock,
  DocumentBlock,
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
      <h3 className="text-[13px] font-semibold tracking-tight text-white/95">{text}</h3>
      {subtitle && <p className="mt-0.5 text-[11px] text-white/45">{subtitle}</p>}
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
    <dl className="space-y-2 text-[13px]">
      {pairs.map((p) => (
        <div key={p.label} className="flex justify-between gap-4">
          <dt className="text-white/45">{p.label}</dt>
          <dd className="text-right text-white/90">{p.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Table({ columns, rows }: TableBlock) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] text-white/85">
        <thead>
          <tr className="border-b border-white/15 text-left text-[11px] uppercase tracking-wider text-white/40">
            {columns.map((col, ci) => (
              <th key={ci} className="pb-2.5 pr-4 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map((row, i) => (
            <tr key={i} className="transition-colors hover:bg-white/[0.03]">
              {columns.map((col, ci) => (
                <td key={ci} className="py-2.5 pr-4 text-[13px]">
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
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-medium ${BADGE_STYLES[variant] ?? BADGE_STYLES.default}`}
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
  return <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">{content}</p>
}

function Document({ data, mime_type, filename }: DocumentBlock) {
  const dataUri = `data:${mime_type};base64,${data}`

  if (mime_type === 'application/pdf') {
    return (
      <div className="overflow-hidden rounded-lg border border-white/10">
        <object
          data={dataUri}
          type="application/pdf"
          className="w-full"
          style={{ height: 480 }}
        >
          <div className="flex items-center gap-2 p-4 text-sm text-white/60">
            <span>{filename}</span>
          </div>
        </object>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3">
      <span className="text-sm text-white/70">{filename}</span>
    </div>
  )
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
    case 'document':
      return <Document key={block.id} {...block} />
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
  return <div className="space-y-3 px-5 py-4">{blocks.map(renderBlock)}</div>
}
