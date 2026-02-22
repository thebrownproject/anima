'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWebSocket } from '@/components/desktop/ws-provider'
import { useDebugPanel } from './use-debug-panel'
import type { DebugLogEntry } from './types'
import { cn } from '@/lib/utils'

type Tab = 'messages' | 'connection' | 'agent'
type Filter = 'all' | 'inbound' | 'outbound'

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-emerald-400',
  connecting: 'bg-yellow-400',
  authenticating: 'bg-yellow-400',
  sprite_waking: 'bg-yellow-400',
  disconnected: 'bg-red-400',
  error: 'bg-red-400',
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`
}

function directionIcon(dir: DebugLogEntry['direction']): { symbol: string; color: string } {
  switch (dir) {
    case 'outbound': return { symbol: '→', color: 'text-cyan-400' }
    case 'inbound': return { symbol: '←', color: 'text-emerald-400' }
    case 'status': return { symbol: '●', color: 'text-yellow-400' }
  }
}

function typeBadgeColor(type: string): string {
  if (type.startsWith('agent_event')) return 'bg-purple-500/30 text-purple-300'
  if (type === 'canvas_update') return 'bg-blue-500/30 text-blue-300'
  if (type === 'mission') return 'bg-cyan-500/30 text-cyan-300'
  if (type === 'system' || type === 'connection') return 'bg-yellow-500/30 text-yellow-300'
  if (type === 'state_sync') return 'bg-emerald-500/30 text-emerald-300'
  return 'bg-white/10 text-white/60'
}

export function DebugPanel() {
  const { isOpen } = useDebugPanel()
  const { status, error, debugLog } = useWebSocket()
  const [tab, setTab] = useState<Tab>('messages')
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [, setTick] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  // Poll the ref for updates when panel is open
  useEffect(() => {
    if (!isOpen) return
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [isOpen])

  // Auto-scroll to bottom
  useEffect(() => {
    if (shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  })

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    shouldAutoScroll.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const clearLog = () => {
    debugLog.current?.splice(0)
    setExpandedIds(new Set())
  }

  if (!isOpen) return null

  const entries = debugLog.current ?? []

  const filtered = entries.filter((e) => {
    if (tab === 'connection') return e.direction === 'status'
    if (tab === 'agent') return e.type === 'agent_event'
    if (filter === 'inbound') return e.direction === 'inbound'
    if (filter === 'outbound') return e.direction === 'outbound'
    return true
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'messages', label: 'Messages' },
    { key: 'connection', label: 'Connection' },
    { key: 'agent', label: 'Agent' },
  ]

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'inbound', label: 'In' },
    { key: 'outbound', label: 'Out' },
  ]

  return (
    <div className={cn(
      'dark',
      'fixed left-4 top-16 bottom-6 z-50 w-[420px]',
      'rounded-2xl border border-white/20 bg-[rgb(10,10,10)] shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
      'flex flex-col overflow-hidden',
      'transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
    )}>
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        {/* Status dot */}
        <div className={cn('size-2 rounded-full shrink-0', STATUS_COLORS[status] ?? 'bg-gray-400')} />
        <span className="text-[10px] font-medium text-white/50 shrink-0">{status}</span>

        {/* Tabs */}
        <div className="ml-2 flex gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded px-2 py-1 text-[10px] font-medium transition-colors',
                tab === t.key ? 'bg-white/15 text-white/90' : 'text-white/40 hover:text-white/60',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters (messages tab only) */}
        {tab === 'messages' && (
          <div className="ml-1 flex gap-0.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  filter === f.key ? 'bg-white/10 text-white/70' : 'text-white/30 hover:text-white/50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-white/30">{entries.length}</span>
          <button onClick={clearLog} className="text-[10px] text-white/30 hover:text-white/60">
            Clear
          </button>
          <span className="text-[10px] text-white/20">⌘⇧D</span>
        </div>
      </div>

      {/* Connection tab header */}
      {tab === 'connection' && (
        <div className="flex flex-col gap-1 border-b border-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={cn('size-3 rounded-full', STATUS_COLORS[status] ?? 'bg-gray-400')} />
            <span className="text-sm font-medium text-white/80">{status}</span>
            {error && <span className="text-[10px] text-red-400 truncate">{error}</span>}
          </div>
          <span className="text-[10px] text-white/30 font-mono truncate">
            {process.env.NEXT_PUBLIC_WS_URL ?? 'wss://ws.stackdocs.io'}/ws
          </span>
        </div>
      )}

      {/* Log entries */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto font-mono text-xs">
        {filtered.length === 0 && (
          <div className="flex h-full items-center justify-center text-white/20">
            {tab === 'agent' ? 'No agent events yet' : 'No messages yet'}
          </div>
        )}
        {filtered.map((entry) => {
          const dir = directionIcon(entry.direction)
          const expanded = expandedIds.has(entry.id)
          return (
            <div key={entry.id} className="border-b border-white/5">
              <button
                onClick={() => toggleExpand(entry.id)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-white/5 transition-colors"
              >
                <span className={cn('w-3 shrink-0 text-center', dir.color)}>{dir.symbol}</span>
                <span className="w-[72px] shrink-0 text-white/30">{formatTime(entry.timestamp)}</span>
                <span className={cn('shrink-0 rounded px-1 py-0.5 text-[10px] font-medium', typeBadgeColor(entry.type))}>
                  {entry.type}
                </span>
                <span className="min-w-0 truncate text-white/60">{entry.summary}</span>
                <span className="ml-auto shrink-0 text-white/20">{expanded ? '▾' : '▸'}</span>
              </button>
              {expanded && (
                <pre className="mx-3 mb-2 max-h-40 overflow-auto rounded bg-black/30 p-2 text-[10px] text-white/50">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
