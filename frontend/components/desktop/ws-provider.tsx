'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { WebSocketManager, type ConnectionStatus, type SendResult } from '@/lib/websocket'
import type { SpriteToBrowserMessage, BrowserToSpriteMessage, ChatMessageInfo, CardInfo } from '@/types/ws-protocol'
import { useDesktopStore, type DesktopCard } from '@/lib/stores/desktop-store'
import { useChatStore } from '@/lib/stores/chat-store'
import { getAutoPosition } from './auto-placer'
import { type DebugLogEntry, DEBUG_LOG_MAX } from '@/components/debug/types'

interface WebSocketContextValue {
  status: ConnectionStatus
  error: string | null
  connect: () => void
  disconnect: () => void
  send: (msg: Omit<BrowserToSpriteMessage, 'id' | 'timestamp'>) => SendResult
  debugLog: RefObject<DebugLogEntry[]>
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider')
  return ctx
}

/** Map snake_case CardInfo fields to camelCase DesktopCard fields. */
function mapCardFields(c: Partial<CardInfo>): Partial<Omit<DesktopCard, 'id' | 'position' | 'zIndex'>> {
  const mapped: Partial<Omit<DesktopCard, 'id' | 'position' | 'zIndex'>> = {}
  if (c.stack_id !== undefined) mapped.stackId = c.stack_id
  if (c.title !== undefined) mapped.title = c.title
  if (c.blocks !== undefined) mapped.blocks = c.blocks
  if (c.size !== undefined) mapped.size = c.size
  if (c.card_type !== undefined) mapped.cardType = c.card_type
  if (c.summary !== undefined) mapped.summary = c.summary
  if (c.tags !== undefined) mapped.tags = c.tags
  if (c.color !== undefined) mapped.color = c.color
  if (c.type_badge !== undefined) mapped.typeBadge = c.type_badge
  if (c.date !== undefined) mapped.date = c.date
  if (c.value !== undefined) mapped.value = c.value
  if (c.trend !== undefined) mapped.trend = c.trend
  if (c.trend_direction !== undefined) mapped.trendDirection = c.trend_direction
  if (c.author !== undefined) mapped.author = c.author
  if (c.read_time !== undefined) mapped.readTime = c.read_time
  if (c.headers !== undefined) mapped.headers = c.headers
  if (c.preview_rows !== undefined) mapped.previewRows = c.preview_rows
  return mapped
}

function summarizeInbound(msg: SpriteToBrowserMessage): string {
  switch (msg.type) {
    case 'agent_event': {
      const { event_type, content } = msg.payload
      if (event_type === 'tool') return `Tool: ${content}`
      if (event_type === 'text') return `Agent: streaming (${content.length} chars)`
      if (event_type === 'error') return `Error: ${content}`
      return `Agent: ${event_type}`
    }
    case 'canvas_update':
      return `Canvas: ${msg.payload.command} ${msg.payload.card_id}`
    case 'state_sync':
      return `Sync: ${msg.payload.stacks.length} stacks, ${msg.payload.cards.length} cards, ${msg.payload.chat_history.length} msgs`
    case 'status':
      return `Status: ${msg.payload.document_id} ${msg.payload.status}`
    case 'system':
      return `System: ${msg.payload.event}${msg.payload.message ? ` — ${msg.payload.message}` : ''}`
    default:
      return (msg as SpriteToBrowserMessage).type
  }
}

function summarizeOutbound(msg: Omit<BrowserToSpriteMessage, 'id' | 'timestamp'>): string {
  // Use 'any' for payload access — this is debug-only summarization
  const p = msg.payload as Record<string, unknown>
  switch (msg.type) {
    case 'mission': {
      const text = (p.text as string) ?? ''
      return `User: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`
    }
    case 'file_upload':
      return `Upload: ${p.filename}`
    case 'canvas_interaction':
      return `Canvas: ${p.action} on ${p.card_id}`
    case 'auth':
      return 'Auth: token sent'
    default:
      return msg.type
  }
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const managerRef = useRef<WebSocketManager | null>(null)
  const getTokenRef = useRef(getToken)
  useEffect(() => { getTokenRef.current = getToken }, [getToken])
  const debugLogRef = useRef<DebugLogEntry[]>([])

  const pushDebug = useCallback((
    direction: DebugLogEntry['direction'],
    type: string,
    summary: string,
    payload: unknown,
  ) => {
    const log = debugLogRef.current
    log.push({ id: crypto.randomUUID(), timestamp: Date.now(), direction, type, summary, payload })
    if (log.length > DEBUG_LOG_MAX) log.splice(0, log.length - DEBUG_LOG_MAX)
  }, [])

  const handleMessage = useCallback((message: SpriteToBrowserMessage) => {
    // Debug log: inbound messages
    pushDebug('inbound', message.type, summarizeInbound(message), message)

    switch (message.type) {
      case 'canvas_update': {
        const { command, card_id } = message.payload
        const store = useDesktopStore.getState()
        const fields = mapCardFields(message.payload)

        if (command === 'create_card') {
          const position = getAutoPosition(store.cards, store.view)
          store.addCard({
            id: card_id,
            stackId: fields.stackId ?? store.activeStackId,
            title: fields.title ?? 'Untitled',
            blocks: fields.blocks ?? [],
            size: fields.size ?? 'medium',
            position,
            zIndex: store.maxZIndex + 1,
            ...fields,
          })
        } else if (command === 'update_card') {
          store.updateCard(card_id, fields)
        } else if (command === 'close_card') {
          store.removeCard(card_id)
        }
        break
      }

      case 'agent_event': {
        const { event_type, content } = message.payload
        const chat = useChatStore.getState()

        if (event_type === 'text' && content) {
          chat.setAgentStreaming(true)
          chat.appendToLastAgent(content)
        } else if (event_type === 'complete') {
          chat.setAgentStreaming(false)
        } else if (event_type === 'tool') {
          chat.addMessage({ role: 'system', content: `[tool] ${content}`, timestamp: message.timestamp })
        } else if (event_type === 'error') {
          chat.setAgentStreaming(false)
          chat.addMessage({ role: 'system', content: `[error] ${content}`, timestamp: message.timestamp })
        }
        break
      }

      case 'state_sync': {
        const { stacks, active_stack_id, cards, chat_history } = message.payload
        const store = useDesktopStore.getState()
        const chat = useChatStore.getState()

        // State sync means fresh server state; any in-flight stream is stale
        chat.setAgentStreaming(false)

        // Populate stacks and reconcile archived IDs against server truth
        store.setStacks(stacks)
        store.setActiveStackId(active_stack_id)
        const serverStackIds = new Set(stacks.map((s: { id: string }) => s.id))
        useDesktopStore.setState((prev) => ({
          archivedStackIds: prev.archivedStackIds.filter((id) => serverStackIds.has(id)),
        }))

        // Map CardInfo (snake_case) -> DesktopCard (camelCase)
        // Use getAutoPosition for cards with default (0,0) position
        const cardRecord: Record<string, DesktopCard> = {}
        let idx = 0
        for (const c of cards) {
          const needsPosition = c.position.x === 0 && c.position.y === 0
          const position = needsPosition
            ? getAutoPosition(cardRecord, store.view)
            : c.position
          cardRecord[c.id] = {
            id: c.id,
            position,
            zIndex: c.z_index || idx + 1,
            ...mapCardFields(c),
          } as DesktopCard
          idx++
        }
        store.mergeCards(cardRecord)

        // Map chat history — Sprite stores "assistant", frontend uses "agent"
        const roleMap: Record<string, 'user' | 'agent' | 'system'> = {
          user: 'user',
          assistant: 'agent',
          agent: 'agent',
          system: 'system',
        }
        const mapped = chat_history.map((m: ChatMessageInfo) => ({
          id: m.id,
          role: roleMap[m.role] ?? 'system',
          content: m.content,
          timestamp: m.timestamp,
        }))
        chat.mergeMessages(mapped, message.timestamp)
        break
      }

      case 'status': {
        const { status, message: statusMessage } = message.payload
        if (status === 'failed') {
          toast.error(statusMessage ?? 'Document processing failed', { id: `doc-status-${message.payload.document_id}` })
        } else if (status === 'completed') {
          toast.success(statusMessage ?? 'Document ready', { id: `doc-status-${message.payload.document_id}` })
        }
        break
      }

      case 'system':
        break
    }
  }, [pushDebug])

  const connect = useCallback(() => {
    managerRef.current?.destroy()
    const manager = new WebSocketManager({
      getToken: () => getTokenRef.current(),
      onStatusChange: (s, err) => {
        pushDebug('status', 'connection', `Status: ${s}${err ? ` — ${err}` : ''}`, { status: s, error: err })
        setStatus(s)
        setError(err ?? null)
        if (s === 'error' && err) {
          toast.error(err, { id: 'ws-connection-error' })
        }
      },
      onMessage: handleMessage,
    })
    managerRef.current = manager
    manager.connect()
  }, [handleMessage, pushDebug])

  const disconnect = useCallback(() => {
    managerRef.current?.destroy()
    managerRef.current = null
    setStatus('disconnected')
    setError(null)
  }, [])

  const send = useCallback(
    (msg: Omit<BrowserToSpriteMessage, 'id' | 'timestamp'>): SendResult => {
      const result = managerRef.current?.send(msg) ?? 'dropped'
      if (result !== 'dropped') {
        const redacted = msg.type === 'auth' ? { ...msg, payload: { token: '[REDACTED]' } } : msg
        pushDebug('outbound', msg.type, `[${result}] ${summarizeOutbound(msg)}`, redacted)
      }
      return result
    },
    [pushDebug]
  )

  // Auto-connect on mount, destroy on unmount
  useEffect(() => {
    connect()
    return () => { managerRef.current?.destroy() }
  }, [connect])

  return (
    <WebSocketContext.Provider value={{ status, error, connect, disconnect, send, debugLog: debugLogRef }}>
      {children}
    </WebSocketContext.Provider>
  )
}
