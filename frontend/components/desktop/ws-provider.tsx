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
import type { SpriteToBrowserMessage, BrowserToSpriteMessage } from '@/types/ws-protocol'
import { useDesktopStore } from '@/lib/stores/desktop-store'
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

export function WebSocketProvider({ stackId, children }: { stackId: string; children: ReactNode }) {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const managerRef = useRef<WebSocketManager | null>(null)
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  const handleMessage = useCallback((message: SpriteToBrowserMessage) => {
    switch (message.type) {
      case 'canvas_update': {
        const { command, card_id, title, blocks } = message.payload
        const store = useDesktopStore.getState()

        if (command === 'create_card') {
          const position = getAutoPosition(store.cards, store.view)
          store.addCard({
            id: card_id,
            title: title ?? 'Untitled',
            blocks: blocks ?? [],
            position,
            zIndex: store.maxZIndex + 1,
          })
        } else if (command === 'update_card') {
          const updates: Record<string, unknown> = {}
          if (title !== undefined) updates.title = title
          if (blocks !== undefined) updates.blocks = blocks
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

      case 'system':
        break
    }
  }, [])

  const connect = useCallback(() => {
    managerRef.current?.destroy()
    const manager = new WebSocketManager({
      stackId,
      getToken: () => getTokenRef.current(),
      onStatusChange: (s, err) => {
        setStatus(s)
        setError(err ?? null)
      },
      onMessage: handleMessage,
    })
    managerRef.current = manager
    manager.connect()
  }, [stackId, handleMessage])

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

  // Auto-connect on mount, destroy on unmount or stackId change
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
