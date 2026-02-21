import { Fragment } from 'react'
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

type Theme = 'editorial' | 'glass'

const BADGE_STYLES_GLASS: Record<string, string> = {
  default: 'bg-white/15 text-white/80',
  success: 'bg-emerald-500/20 text-emerald-300',
  warning: 'bg-amber-500/20 text-amber-300',
  destructive: 'bg-red-500/20 text-red-300',
}

const BADGE_STYLES_EDITORIAL: Record<string, string> = {
  default: 'bg-black/12 text-[#1A1A18] font-bold',
  success: 'bg-emerald-900/20 text-[#1A1A18] font-bold',
  warning: 'bg-amber-900/20 text-[#1A1A18] font-bold',
  destructive: 'bg-red-900/20 text-[#1A1A18] font-bold',
}

function Heading({ text, subtitle, theme }: HeadingBlock & { theme: Theme }) {
  if (theme === 'editorial') {
    return (
      <div>
        <h3 className="text-[28px] font-extrabold leading-[1.2] tracking-tight text-[#1A1A18]">{text}</h3>
        {subtitle && <p className="mt-2 text-[17px] leading-normal font-medium text-[#2E2E2C]">{subtitle}</p>}
      </div>
    )
  }
  return (
    <div>
      <h3 className="text-[13px] font-semibold tracking-tight text-white/95">{text}</h3>
      {subtitle && <p className="mt-0.5 text-[11px] text-white/45">{subtitle}</p>}
    </div>
  )
}

function Stat({ value, label, trend, theme }: StatBlock & { theme: Theme }) {
  if (theme === 'editorial') {
    return (
      <div className="flex items-baseline gap-3">
        <span className="text-[56px] font-black leading-none tabular-nums tracking-tighter text-[#1A1A18]">
          {value}
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-[17px] font-bold text-[#1A1A18]">{label}</span>
          {trend && <span className="text-[15px] font-semibold text-[#2E2E2C]">{trend}</span>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums text-white/90">{value}</span>
      <span className="text-xs text-white/50">{label}</span>
      {trend && <span className="text-xs text-white/40">{trend}</span>}
    </div>
  )
}

function KeyValue({ pairs, theme }: KeyValueBlock & { theme: Theme }) {
  if (theme === 'editorial') {
    return (
      <dl className="space-y-5 text-[17px] leading-normal">
        {pairs.map((p) => (
          <div key={p.label} className="flex justify-between gap-4">
            <dt className="font-semibold text-[#2E2E2C]">{p.label}</dt>
            <dd className="text-right font-bold text-[#1A1A18]">{p.value}</dd>
          </div>
        ))}
      </dl>
    )
  }
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

function Table({ columns, rows, theme }: TableBlock & { theme: Theme }) {
  if (theme === 'editorial') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[15px] leading-normal text-[#1A1A18]">
          <thead>
            <tr className="border-b-2 border-black/15 text-left text-[13px] uppercase tracking-wider font-extrabold text-[#1A1A18]">
              {columns.map((col, ci) => (
                <th key={ci} className="pb-3.5 pr-4">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.08]">
            {rows.map((row, i) => (
              <tr key={i} className="transition-colors hover:bg-black/[0.04]">
                {columns.map((col, ci) => (
                  <td key={ci} className="py-4 pr-4 font-medium">
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

function Badge({ text, variant, theme }: BadgeBlock & { theme: Theme }) {
  const styles = theme === 'editorial' ? BADGE_STYLES_EDITORIAL : BADGE_STYLES_GLASS
  return (
    <span className={`inline-flex items-center rounded-lg px-3.5 py-1.5 text-[13px] ${styles[variant] ?? styles.default}`}>
      {text}
    </span>
  )
}

function Progress({ value, label, theme }: ProgressBlock & { theme: Theme }) {
  const clamped = Math.max(0, Math.min(100, value))
  if (theme === 'editorial') {
    return (
      <div className="space-y-3">
        {label && (
          <div className="flex justify-between text-[17px]">
            <span className="font-bold text-[#1A1A18]">{label}</span>
            <span className="font-black tabular-nums text-[#1A1A18]">{clamped}%</span>
          </div>
        )}
        <div className="h-3 rounded-full bg-black/12">
          <div className="h-full rounded-full bg-[#1A1A18]/50 transition-all" style={{ width: `${clamped}%` }} />
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-white/60">{label}</span>
          <span className="tabular-nums text-white/50">{clamped}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white/40 transition-all" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

function Text({ content, theme }: TextBlock & { theme: Theme }) {
  if (theme === 'editorial') {
    return <p className="whitespace-pre-wrap text-[18px] leading-relaxed font-medium text-[#1A1A18]">{content}</p>
  }
  return <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">{content}</p>
}

function Document({ data, mime_type, filename, theme }: DocumentBlock & { theme: Theme }) {
  const dataUri = `data:${mime_type};base64,${data}`
  const ed = theme === 'editorial'

  if (mime_type === 'application/pdf') {
    return (
      <div className={`overflow-hidden rounded-lg border ${ed ? 'border-black/12' : 'border-white/10'}`}>
        <object data={dataUri} type="application/pdf" className="w-full" style={{ height: 480 }}>
          <div className={`flex items-center gap-2 p-4 text-[17px] font-semibold ${ed ? 'text-[#1A1A18]' : 'text-white/60'}`}>
            <span>{filename}</span>
          </div>
        </object>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-4 ${ed ? 'border-black/12' : 'border-white/10'}`}>
      <span className={`text-[17px] font-bold ${ed ? 'text-[#1A1A18]' : 'text-white/70'}`}>{filename}</span>
    </div>
  )
}

function Separator({ theme }: { theme: Theme }) {
  return <div className={`border-t ${theme === 'editorial' ? 'border-black/12' : 'border-white/10'}`} />
}

function renderBlock(block: Block, theme: Theme) {
  switch (block.type) {
    case 'heading':   return <Heading {...block} theme={theme} />
    case 'stat':      return <Stat {...block} theme={theme} />
    case 'key-value': return <KeyValue {...block} theme={theme} />
    case 'table':     return <Table {...block} theme={theme} />
    case 'badge':     return <Badge {...block} theme={theme} />
    case 'progress':  return <Progress {...block} theme={theme} />
    case 'text':      return <Text {...block} theme={theme} />
    case 'document':  return <Document {...block} theme={theme} />
    case 'separator': return <Separator theme={theme} />
    default:          return null
  }
}

interface BlockRendererProps {
  blocks: Block[]
  theme?: Theme
}

export function BlockRenderer({ blocks, theme = 'glass' }: BlockRendererProps) {
  if (!blocks.length) {
    return (
      <div className={`p-7 text-[17px] font-semibold ${theme === 'editorial' ? 'text-[#2E2E2C]' : 'text-white/40'}`}>
        No content
      </div>
    )
  }
  return (
    <div className={theme === 'editorial' ? 'space-y-7 px-7 pb-8 pt-4' : 'space-y-3 px-5 py-4'}>
      {blocks.map((block, index) => (
        <Fragment key={block.id ?? index}>{renderBlock(block, theme)}</Fragment>
      ))}
    </div>
  )
}
