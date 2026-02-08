'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WebSocketManager, type ConnectionStatus } from '@/lib/websocket'
import type { SpriteToBrowserMessage } from '@/types/ws-protocol'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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

export default function TestChatPage() {
  const { getToken } = useAuth()
  const [stackId, setStackId] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const managerRef = useRef<WebSocketManager | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleMessage = useCallback((message: SpriteToBrowserMessage) => {
    if (message.type === 'agent_event') {
      const { event_type, content } = message.payload
      if (event_type === 'text' && content) {
        setMessages(prev => {
          // Append to last agent message if it exists, otherwise create new
          const last = prev[prev.length - 1]
          if (last?.role === 'agent') {
            return [...prev.slice(0, -1), { ...last, content: last.content + content }]
          }
          return [...prev, { role: 'agent', content, timestamp: message.timestamp }]
        })
      } else if (event_type === 'tool') {
        setMessages(prev => [
          ...prev,
          { role: 'system', content: `[tool] ${content}`, timestamp: message.timestamp },
        ])
      } else if (event_type === 'complete') {
        setMessages(prev => [
          ...prev,
          { role: 'system', content: '--- turn complete ---', timestamp: message.timestamp },
        ])
      } else if (event_type === 'error') {
        setMessages(prev => [
          ...prev,
          { role: 'system', content: `[error] ${content}`, timestamp: message.timestamp },
        ])
      }
    } else if (message.type === 'system') {
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: `[${message.payload.event}] ${message.payload.message ?? ''}`,
          timestamp: message.timestamp,
        },
      ])
    } else if (message.type === 'canvas_update') {
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: `[canvas] ${message.payload.command} card="${message.payload.card_id}" ${message.payload.title ?? ''}`,
          timestamp: message.timestamp,
        },
      ])
    }
  }, [])

  const handleConnect = useCallback(() => {
    if (!stackId.trim()) return

    // Clean up existing connection
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
      setMessages(prev => [
        ...prev,
        { role: 'user', content: input.trim(), timestamp: Date.now() },
      ])
      setInput('')
    }
  }, [input])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.destroy()
    }
  }, [])

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Connection bar */}
      <div className="flex items-center gap-3 shrink-0">
        <div className={`size-3 rounded-full ${STATUS_COLORS[status]}`} />
        <span className="text-sm font-mono text-muted-foreground">{status}</span>
        {error && <span className="text-sm text-destructive">{error}</span>}

        <div className="flex items-center gap-2 ml-auto">
          <Input
            placeholder="Stack ID"
            value={stackId}
            onChange={(e) => setStackId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            className="w-64 font-mono text-sm"
            disabled={status !== 'disconnected'}
          />
          {status === 'disconnected' ? (
            <Button onClick={handleConnect} disabled={!stackId.trim()} size="sm">
              Connect
            </Button>
          ) : (
            <Button onClick={handleDisconnect} variant="destructive" size="sm">
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto border rounded-lg p-4 space-y-3 bg-muted/30">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
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
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : msg.role === 'system'
                    ? 'bg-muted text-muted-foreground font-mono text-xs'
                    : 'bg-card border'
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
      <div className="flex gap-2 shrink-0">
        <Input
          placeholder={status === 'connected' ? 'Type a message...' : 'Connect first'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={status !== 'connected'}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={status !== 'connected' || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  )
}
