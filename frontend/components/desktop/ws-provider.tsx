'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@clerk/nextjs'
import { WebSocketManager, type ConnectionStatus } from '@/lib/websocket'
import type { SpriteToBrowserMessage, BrowserToSpriteMessage, CardInfo, ChatMessageInfo } from '@/types/ws-protocol'
import { useDesktopStore, type DesktopCard } from '@/lib/stores/desktop-store'
import { useChatStore } from '@/lib/stores/chat-store'
import { getAutoPosition } from './auto-placer'

interface WebSocketContextValue {
  status: ConnectionStatus
  error: string | null
  connect: () => void
  disconnect: () => void
  send: (msg: Omit<BrowserToSpriteMessage, 'id' | 'timestamp'>) => boolean
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider')
  return ctx
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const managerRef = useRef<WebSocketManager | null>(null)
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  const handleMessage = useCallback((message: SpriteToBrowserMessage) => {
    switch (message.type) {
      case 'canvas_update': {
        const { command, card_id, title, blocks, size, stack_id } = message.payload
        const store = useDesktopStore.getState()

        if (command === 'create_card') {
          const position = getAutoPosition(store.cards, store.view)
          store.addCard({
            id: card_id,
            stackId: stack_id ?? store.activeStackId,
            title: title ?? 'Untitled',
            blocks: blocks ?? [],
            size: size ?? 'medium',
            position,
            zIndex: store.maxZIndex + 1,
          })
        } else if (command === 'update_card') {
          const updates: Partial<Omit<DesktopCard, 'id'>> = {}
          if (title !== undefined) updates.title = title
          if (blocks !== undefined) updates.blocks = blocks
          if (size !== undefined) updates.size = size
          store.updateCard(card_id, updates)
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

        // Populate stacks
        store.setStacks(stacks)
        store.setActiveStackId(active_stack_id)

        // Map CardInfo (snake_case) -> DesktopCard (camelCase)
        // Use getAutoPosition for cards with default (0,0) position
        const cardRecord: Record<string, DesktopCard> = {}
        let idx = 0
        for (const c of cards) {
          const needsPosition = c.position.x === 0 && c.position.y === 0
          // Build a temporary cards record for position calculation
          const position = needsPosition
            ? getAutoPosition(cardRecord, store.view)
            : c.position
          cardRecord[c.id] = {
            id: c.id,
            stackId: c.stack_id,
            title: c.title,
            blocks: c.blocks,
            size: c.size,
            position,
            zIndex: c.z_index || idx + 1,
          }
          idx++
        }
        store.setCards(cardRecord)

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
        chat.setMessages(mapped)
        break
      }

      case 'system':
        break
    }
  }, [])

  const connect = useCallback(() => {
    managerRef.current?.destroy()
    const manager = new WebSocketManager({
      getToken: () => getTokenRef.current(),
      onStatusChange: (s, err) => {
        setStatus(s)
        setError(err ?? null)
      },
      onMessage: handleMessage,
    })
    managerRef.current = manager
    manager.connect()
  }, [handleMessage])

  const disconnect = useCallback(() => {
    managerRef.current?.destroy()
    managerRef.current = null
    setStatus('disconnected')
    setError(null)
  }, [])

  const send = useCallback(
    (msg: Omit<BrowserToSpriteMessage, 'id' | 'timestamp'>): boolean =>
      managerRef.current?.send(msg) ?? false,
    []
  )

  // Auto-connect on mount, destroy on unmount
  useEffect(() => {
    connect()
    return () => { managerRef.current?.destroy() }
  }, [connect])

  return (
    <WebSocketContext.Provider value={{ status, error, connect, disconnect, send }}>
      {children}
    </WebSocketContext.Provider>
  )
}
