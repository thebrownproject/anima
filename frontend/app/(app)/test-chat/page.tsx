'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applyNodeChanges, type OnNodesChange } from '@xyflow/react'
import { WebSocketManager, type ConnectionStatus } from '@/lib/websocket'
import type { SpriteToBrowserMessage, CanvasUpdate } from '@/types/ws-protocol'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StackCanvas, autoPlace, type CanvasCardNode } from '@/components/canvas/stack-canvas'
import { GridLayoutSpike } from '@/components/canvas/grid-layout-spike'

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

const DEFAULT_CARD_SIZE = { width: 320, height: 240 }

function canvasUpdateToNode(
  update: CanvasUpdate,
  existingNodes: CanvasCardNode[],
): CanvasCardNode {
  const existing = existingNodes.find((n) => n.id === update.payload.card_id)
  const position = existing?.position ?? autoPlace(existingNodes)

  return {
    id: update.payload.card_id,
    type: 'canvasCard' as const,
    position,
    style: {
      width: existing?.style?.width ?? DEFAULT_CARD_SIZE.width,
      height: existing?.style?.height ?? DEFAULT_CARD_SIZE.height,
    },
    data: {
      title: update.payload.title ?? existing?.data?.title ?? 'Untitled',
      blocks: update.payload.blocks ?? existing?.data?.blocks ?? [],
    },
  }
}

export default function TestChatPage() {
  const { getToken } = useAuth()
  const [stackId, setStackId] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [cards, setCards] = useState<CanvasCardNode[]>([])
  const [canvasView, setCanvasView] = useState<'reactflow' | 'grid'>('grid')
  const managerRef = useRef<WebSocketManager | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCanvasUpdate = useCallback((message: CanvasUpdate) => {
    const { command, card_id } = message.payload

    if (command === 'create_card') {
      setCards((prev) => {
        // Don't duplicate — if card already exists, update it instead
        const exists = prev.find((n) => n.id === card_id)
        if (exists) {
          return prev.map((n) =>
            n.id === card_id ? canvasUpdateToNode(message, prev) : n,
          )
        }
        return [...prev, canvasUpdateToNode(message, prev)]
      })
    } else if (command === 'update_card') {
      setCards((prev) =>
        prev.map((n) =>
          n.id === card_id ? canvasUpdateToNode(message, prev) : n,
        ),
      )
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
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + content },
              ]
            }
            return [
              ...prev,
              { role: 'agent', content, timestamp: message.timestamp },
            ]
          })
        } else if (event_type === 'tool') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              content: `[tool] ${content}`,
              timestamp: message.timestamp,
            },
          ])
        } else if (event_type === 'complete') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              content: '--- turn complete ---',
              timestamp: message.timestamp,
            },
          ])
        } else if (event_type === 'error') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              content: `[error] ${content}`,
              timestamp: message.timestamp,
            },
          ])
        }
      } else if (message.type === 'system') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: `[${message.payload.event}] ${message.payload.message ?? ''}`,
            timestamp: message.timestamp,
          },
        ])
      } else if (message.type === 'canvas_update') {
        // Render on canvas AND log to chat
        handleCanvasUpdate(message)
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: `[canvas] ${message.payload.command} card="${message.payload.card_id}" ${message.payload.title ?? ''}`,
            timestamp: message.timestamp,
          },
        ])
      }
    },
    [handleCanvasUpdate],
  )

  const handleConnect = useCallback(() => {
    if (!stackId.trim()) return

    managerRef.current?.destroy()

    const manager = new WebSocketManager({
      stackId: stackId.trim(),
      getToken: () => getToken(),
      onStatusChange: (s, err) => {
        setStatus(s)
        setError(err ?? null)
      },
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

    const sent = managerRef.current.send({
      type: 'mission',
      payload: { text: input.trim() },
    })

    if (sent) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input.trim(), timestamp: Date.now() },
      ])
      setInput('')
    }
  }, [input])

  const handleNodesChange: OnNodesChange<CanvasCardNode> = useCallback(
    (changes) => {
      setCards((prev) => applyNodeChanges(changes, prev))
    },
    [],
  )

  const handleCardClose = useCallback((cardId: string) => {
    setCards((prev) => prev.filter((n) => n.id !== cardId))
  }, [])

  useEffect(() => {
    return () => {
      managerRef.current?.destroy()
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Connection bar */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <div className={`size-3 rounded-full ${STATUS_COLORS[status]}`} />
        <span className="font-mono text-sm text-muted-foreground">
          {status}
        </span>
        {error && (
          <span className="text-sm text-destructive">{error}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="Stack ID"
            value={stackId}
            onChange={(e) => setStackId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            className="w-64 font-mono text-sm"
            disabled={status !== 'disconnected'}
          />
          {status === 'disconnected' ? (
            <Button
              onClick={handleConnect}
              disabled={!stackId.trim()}
              size="sm"
            >
              Connect
            </Button>
          ) : (
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              size="sm"
            >
              Disconnect
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={canvasView === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setCanvasView('grid')}
            >
              Grid Spike
            </Button>
            <Button
              variant={canvasView === 'reactflow' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setCanvasView('reactflow')}
            >
              React Flow
            </Button>
          </div>
          {cards.length > 0 && (
            <Badge variant="secondary" className="font-mono text-xs">
              {cards.length} card{cards.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Main area: chat + canvas side by side */}
      <div className="flex min-h-0 flex-1">
        {/* Chat panel */}
        <div className="flex w-96 shrink-0 flex-col border-r">
          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {status === 'connected'
                  ? 'Connected. Type a message below.'
                  : 'Enter a Stack ID and connect to start chatting.'}
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : msg.role === 'system'
                        ? 'bg-muted font-mono text-xs text-muted-foreground'
                        : 'border bg-card'
                  }`}
                >
                  {msg.role !== 'user' && (
                    <Badge variant="outline" className="mb-1 text-[10px]">
                      {msg.role}
                    </Badge>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex shrink-0 gap-2 border-t p-3">
            <Input
              placeholder={
                status === 'connected' ? 'Type a message...' : 'Connect first'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.shiftKey && handleSend()
              }
              disabled={status !== 'connected'}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={status !== 'connected' || !input.trim()}
              size="sm"
            >
              Send
            </Button>
          </div>
        </div>

        {/* Canvas panel */}
        <div className="flex-1 bg-background">
          {canvasView === 'grid' ? (
            <GridLayoutSpike />
          ) : cards.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Canvas — cards will appear here when the agent creates them
              </p>
            </div>
          ) : (
            <StackCanvas
              cards={cards}
              onNodesChange={handleNodesChange}
              onCardClose={handleCardClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
