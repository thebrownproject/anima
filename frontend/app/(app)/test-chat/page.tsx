'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WebSocketManager, type ConnectionStatus } from '@/lib/websocket'
import type { SpriteToBrowserMessage, CanvasUpdate, Block } from '@/types/ws-protocol'
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
} from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassInput } from '@/components/ui/glass-input'
import { GlassTabs, GlassTabsList, GlassTabsTrigger } from '@/components/ui/glass-tabs'
import * as Icons from '@/components/icons'

// --- Wallpapers ---

const WALLPAPERS = [
  { name: 'Ocean', class: 'bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600' },
  { name: 'Aurora', class: 'bg-gradient-to-br from-purple-500 via-pink-500 to-rose-400' },
  { name: 'Forest', class: 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600' },
  { name: 'Sunset', class: 'bg-gradient-to-br from-orange-400 via-rose-500 to-purple-600' },
  { name: 'Midnight', class: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900' },
  { name: 'Deep Space', class: 'bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950' },
  { name: 'Aqua', class: 'bg-gradient-to-br from-sky-300 via-cyan-400 to-teal-500' },
  { name: 'Lavender', class: 'bg-gradient-to-br from-violet-300 via-purple-400 to-indigo-500' },
] as const

// --- Glass pill container (shared style for top bar pills) ---

function GlassPill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </div>
  )
}

// --- Top Bar ---

function TopBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-4 pt-4">
      {/* Left — App circles */}
      <div className="pointer-events-auto flex items-center gap-2">
        <GlassButton variant="ghost" size="icon" className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl">
          <Icons.FileText className="size-5 text-white/80" />
        </GlassButton>
        <GlassButton variant="ghost" size="icon" className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl">
          <Icons.LayoutGrid className="size-5 text-white/80" />
        </GlassButton>
        <GlassButton variant="ghost" size="icon" className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl">
          <Icons.SlidersHorizontal className="size-5 text-white/80" />
        </GlassButton>
      </div>

      {/* Center — Back button + Workspace Tabs pill + Add button */}
      <div className="pointer-events-auto flex items-center gap-2">
        <GlassButton variant="ghost" size="icon" className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl">
          <Icons.ChevronLeft className="size-5 text-white/80" />
        </GlassButton>
        <GlassPill className="px-2">
          <GlassTabs defaultValue="q4">
            <GlassTabsList className="h-8 border-0 bg-transparent p-0 shadow-none backdrop-blur-none">
              <GlassTabsTrigger value="q4" className="gap-2 rounded-xl px-4 text-sm">
                <span className="size-2 rounded-full bg-red-400" />
                Q4 Invoices
              </GlassTabsTrigger>
              <GlassTabsTrigger value="tax" className="gap-2 rounded-xl px-4 text-sm">
                <span className="size-2 rounded-full bg-emerald-400" />
                Tax Returns
              </GlassTabsTrigger>
            </GlassTabsList>
          </GlassTabs>
        </GlassPill>
        <GlassButton variant="ghost" size="icon" className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl">
          <Icons.Plus className="size-5 text-white/80" />
        </GlassButton>
      </div>

      {/* Right pill — System Tray */}
      <GlassPill className="pointer-events-auto">
        <span className="px-2 text-xs font-medium text-white/70">87%</span>
        <GlassButton variant="ghost" size="icon" className="size-8 rounded-xl">
          <Icons.Search className="size-5 text-white/80" />
        </GlassButton>
        <GlassButton variant="ghost" size="icon" className="size-8 rounded-xl">
          <Icons.Bell className="size-5 text-white/80" />
        </GlassButton>
        <GlassButton variant="ghost" size="icon" className="size-8 rounded-xl">
          <Icons.User className="size-5 text-white/80" />
        </GlassButton>
      </GlassPill>
    </div>
  )
}

// --- Chat Bar ---

function ChatBar({
  chatMode,
  onToggleMode,
  onToggleChat,
  showChat,
}: {
  chatMode: 'chips' | 'typing'
  onToggleMode: () => void
  onToggleChat: () => void
  showChat: boolean
}) {
  const [chatInput, setChatInput] = useState('')

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        {/* Paperclip */}
        <GlassButton variant="ghost" size="icon" className="size-8 shrink-0 rounded-full">
          <Icons.Paperclip className="size-5 text-white/70" />
        </GlassButton>

        {/* Chips / Input toggle */}
        <div className="relative flex min-w-[400px] items-center justify-center">
          {chatMode === 'chips' ? (
            <div className="flex gap-2">
              <GlassButton size="sm" className="rounded-full px-4">
                Show breakdown
              </GlassButton>
              <GlassButton size="sm" className="rounded-full px-4">
                Export CSV
              </GlassButton>
              <GlassButton size="sm" className="rounded-full px-4">
                Upload more
              </GlassButton>
            </div>
          ) : (
            <GlassInput
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="h-9 w-full rounded-full border-0 bg-white/5 text-sm"
              autoFocus
            />
          )}
        </div>

        {/* Right icons */}
        <GlassButton
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          onClick={onToggleMode}
        >
          <Icons.Keyboard className={`size-5 ${chatMode === 'typing' ? 'text-white' : 'text-white/70'}`} />
        </GlassButton>
        <GlassButton variant="ghost" size="icon" className="size-8 shrink-0 rounded-full">
          <Icons.Microphone className="size-5 text-white/70" />
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          onClick={onToggleChat}
        >
          <Icons.Message className={`size-5 ${showChat ? 'text-white' : 'text-white/70'}`} />
        </GlassButton>
      </div>
    </div>
  )
}

// --- Wallpaper Picker (bottom-right) ---

function WallpaperPicker({ wallpaper, onChange }: { wallpaper: number; onChange: (i: number) => void }) {
  return (
    <div className="pointer-events-none absolute bottom-16 right-4 z-10 flex items-center gap-1.5">
      {WALLPAPERS.map((wp, i) => (
        <button
          key={wp.name}
          onClick={() => onChange(i)}
          className={`pointer-events-auto group relative size-6 rounded-full ${wp.class} border-2 transition-all ${
            i === wallpaper
              ? 'scale-110 border-white shadow-lg shadow-white/20'
              : 'border-white/30 hover:scale-105 hover:border-white/60'
          }`}
          title={wp.name}
        />
      ))}
    </div>
  )
}

// --- WS helpers (unchanged) ---

interface ChatMessage {
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: number
}

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  disconnected: 'bg-gray-500',
  connecting: 'bg-yellow-500 animate-pulse',
  authenticating: 'bg-yellow-500 animate-pulse',
  sprite_waking: 'bg-orange-500 animate-pulse',
  connected: 'bg-green-500',
  error: 'bg-red-500',
}

interface CanvasCard {
  id: string
  title: string
  blocks: Block[]
}

function canvasUpdateToCard(
  update: CanvasUpdate,
  existingCards: CanvasCard[],
): CanvasCard {
  const existing = existingCards.find((c) => c.id === update.payload.card_id)
  return {
    id: update.payload.card_id,
    title: update.payload.title ?? existing?.title ?? 'Untitled',
    blocks: update.payload.blocks ?? existing?.blocks ?? [],
  }
}

// --- Main Page ---

export default function TestChatPage() {
  const { getToken } = useAuth()
  const [stackId, setStackId] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [cards, setCards] = useState<CanvasCard[]>([])
  const [wallpaper, setWallpaper] = useState(0)
  const [chatMode, setChatMode] = useState<'chips' | 'typing'>('chips')
  const [showChat, setShowChat] = useState(true)
  const managerRef = useRef<WebSocketManager | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCanvasUpdate = useCallback((message: CanvasUpdate) => {
    const { command, card_id } = message.payload
    if (command === 'create_card') {
      setCards((prev) => {
        const exists = prev.find((n) => n.id === card_id)
        if (exists) {
          return prev.map((n) => (n.id === card_id ? canvasUpdateToCard(message, prev) : n))
        }
        return [...prev, canvasUpdateToCard(message, prev)]
      })
    } else if (command === 'update_card') {
      setCards((prev) => prev.map((n) => (n.id === card_id ? canvasUpdateToCard(message, prev) : n)))
    } else if (command === 'close_card') {
      setCards((prev) => prev.filter((n) => n.id !== card_id))
    }
  }, [])

  const handleMessage = useCallback(
    (message: SpriteToBrowserMessage) => {
      if (message.type === 'agent_event') {
        const { event_type, content } = message.payload
        if (event_type === 'text' && content) {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'agent') {
              return [...prev.slice(0, -1), { ...last, content: last.content + content }]
            }
            return [...prev, { role: 'agent', content, timestamp: message.timestamp }]
          })
        } else if (event_type === 'tool') {
          setMessages((prev) => [...prev, { role: 'system', content: `[tool] ${content}`, timestamp: message.timestamp }])
        } else if (event_type === 'complete') {
          setMessages((prev) => [...prev, { role: 'system', content: '--- turn complete ---', timestamp: message.timestamp }])
        } else if (event_type === 'error') {
          setMessages((prev) => [...prev, { role: 'system', content: `[error] ${content}`, timestamp: message.timestamp }])
        }
      } else if (message.type === 'system') {
        setMessages((prev) => [...prev, { role: 'system', content: `[${message.payload.event}] ${message.payload.message ?? ''}`, timestamp: message.timestamp }])
      } else if (message.type === 'canvas_update') {
        handleCanvasUpdate(message)
        setMessages((prev) => [...prev, { role: 'system', content: `[canvas] ${message.payload.command} card="${message.payload.card_id}" ${message.payload.title ?? ''}`, timestamp: message.timestamp }])
      }
    },
    [handleCanvasUpdate],
  )

  const handleConnect = useCallback(() => {
    if (!stackId.trim()) return
    managerRef.current?.destroy()
    const manager = new WebSocketManager({
      getToken: () => getToken(),
      onStatusChange: (s, err) => { setStatus(s); setError(err ?? null) },
      onMessage: handleMessage,
    })
    managerRef.current = manager
    manager.connect()
    setMessages([])
    setCards([])
  }, [stackId, getToken, handleMessage])

  const handleDisconnect = useCallback(() => {
    managerRef.current?.destroy()
    managerRef.current = null
    setStatus('disconnected')
  }, [])

  const handleSend = useCallback(() => {
    if (!input.trim() || !managerRef.current) return
    const sent = managerRef.current.send({ type: 'mission', payload: { text: input.trim() } })
    if (sent) {
      setMessages((prev) => [...prev, { role: 'user', content: input.trim(), timestamp: Date.now() }])
      setInput('')
    }
  }, [input])

  const handleCardClose = useCallback((cardId: string) => {
    setCards((prev) => prev.filter((n) => n.id !== cardId))
  }, [])

  useEffect(() => {
    return () => { managerRef.current?.destroy() }
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden transition-all duration-700" style={{ backgroundImage: 'url(/wallpapers/purple-waves.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Top Bar */}
      <TopBar />

      {/* Canvas area */}
      <div className="absolute inset-0 overflow-auto pt-20 pb-24 px-8">
        {/* Demo glass cards */}
        <div className="flex flex-wrap gap-6">
          <GlassCard className="w-72">
            <GlassCardHeader>
              <GlassCardTitle>Total Extracted</GlassCardTitle>
              <GlassCardDescription>12 invoices &middot; Q4 2025</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent>
              <p className="text-4xl font-bold text-white">$47,200</p>
            </GlassCardContent>
          </GlassCard>

          <GlassCard className="w-[480px]">
            <GlassCardHeader>
              <GlassCardTitle>Invoice Extraction Results</GlassCardTitle>
              <GlassCardDescription>5 vendors processed</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent>
              <table className="w-full text-sm text-white/90">
                <thead>
                  <tr className="border-b border-white/20 text-left text-xs uppercase text-white/50">
                    <th className="pb-2">Vendor</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr><td className="py-2">ABC Company</td><td>Feb 9</td><td>$1,247.00</td><td><span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Verified</span></td></tr>
                  <tr><td className="py-2">XYZ Ltd</td><td>Feb 8</td><td>$3,500.50</td><td><span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Verified</span></td></tr>
                  <tr><td className="py-2">Acme Corp</td><td>Feb 7</td><td>$890.00</td><td><span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Pending</span></td></tr>
                  <tr><td className="py-2">Smith &amp; Co</td><td>Feb 5</td><td>$12,400.00</td><td><span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Verified</span></td></tr>
                  <tr><td className="py-2">Global Tech</td><td>Feb 4</td><td>$2,150.25</td><td><span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Verified</span></td></tr>
                </tbody>
              </table>
            </GlassCardContent>
          </GlassCard>

          <GlassCard className="w-64" glowEffect={false}>
            <GlassCardHeader>
              <GlassCardTitle>Processing</GlassCardTitle>
              <GlassCardDescription>3 documents queued</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-white/80">
                  <span>invoice_042.pdf</span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">OCR</span>
                </div>
                <div className="flex items-center justify-between text-sm text-white/80">
                  <span>receipt_103.jpg</span>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">Queued</span>
                </div>
                <div className="flex items-center justify-between text-sm text-white/80">
                  <span>contract_07.pdf</span>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">Queued</span>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Live WS canvas cards */}
        {cards.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-6">
            {cards.map((card) => (
              <GlassCard key={card.id} className="w-80">
                <GlassCardHeader>
                  <div className="flex items-center justify-between">
                    <GlassCardTitle>{card.title}</GlassCardTitle>
                    <GlassButton
                      variant="ghost"
                      size="icon"
                      className="size-6 rounded-lg"
                      onClick={() => handleCardClose(card.id)}
                    >
                      <Icons.X className="size-3 text-white/60" />
                    </GlassButton>
                  </div>
                </GlassCardHeader>
                <GlassCardContent>
                  <pre className="whitespace-pre-wrap text-xs text-white/80">
                    {JSON.stringify(card.blocks, null, 2)}
                  </pre>
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Assistant Panel (right side — spec Mode 2) */}
      {showChat && (
        <div className="absolute right-4 top-20 bottom-20 z-20 flex w-96 flex-col rounded-2xl border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-transform duration-500">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Assistant</span>
              <div className={`size-2 rounded-full ${STATUS_COLORS[status]}`} />
              <span className="font-mono text-xs text-white/40">{status}</span>
            </div>
            <GlassButton
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg"
              onClick={() => setShowChat(false)}
            >
              <Icons.X className="size-4 text-white/60" />
            </GlassButton>
          </div>

          {/* Connection bar */}
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <GlassInput
              placeholder="Stack ID"
              value={stackId}
              onChange={(e) => setStackId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              className="h-8 flex-1 rounded-lg text-xs"
              disabled={status !== 'disconnected'}
            />
            {status === 'disconnected' ? (
              <GlassButton onClick={handleConnect} disabled={!stackId.trim()} size="sm" className="h-8 rounded-lg px-3 text-xs">
                Connect
              </GlassButton>
            ) : (
              <GlassButton onClick={handleDisconnect} variant="destructive" size="sm" className="h-8 rounded-lg px-3 text-xs">
                Disconnect
              </GlassButton>
            )}
          </div>
          {error && (
            <div className="border-b border-white/10 px-4 py-1">
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-white/30">
                {status === 'connected'
                  ? 'Connected. Type a message below.'
                  : 'Enter a Stack ID and connect.'}
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-white/20 text-white'
                      : msg.role === 'system'
                        ? 'font-mono text-xs text-white/40'
                        : 'bg-white/10 text-white/90'
                  }`}
                >
                  {msg.role !== 'user' && (
                    <span className="mb-1 block text-[10px] font-medium uppercase text-white/30">
                      {msg.role}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
            <GlassInput
              placeholder={status === 'connected' ? 'Type a message...' : 'Connect first'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={status !== 'connected'}
              className="h-9 flex-1 rounded-xl text-sm"
            />
            <GlassButton
              onClick={handleSend}
              disabled={status !== 'connected' || !input.trim()}
              size="icon"
              className="size-9 rounded-xl"
            >
              <Icons.Send className="size-4" />
            </GlassButton>
          </div>
        </div>
      )}

      {/* Chat Bar */}
      <ChatBar
        chatMode={chatMode}
        onToggleMode={() => setChatMode(chatMode === 'chips' ? 'typing' : 'chips')}
        onToggleChat={() => setShowChat(!showChat)}
        showChat={showChat}
      />

      {/* Wallpaper Picker */}
      <WallpaperPicker wallpaper={wallpaper} onChange={setWallpaper} />

      {/* Canvas position indicator */}
      <div className="pointer-events-none absolute bottom-5 right-4 z-10 text-right font-mono text-xs text-white/40">
        <div>POS: 0, 0</div>
        <div>ZM: 100%</div>
      </div>
    </div>
  )
}
