'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import * as Icons from '@/components/icons'
import { Spinner } from '@/components/ui/spinner'
import { useWebSocket } from './ws-provider'
import type { ConnectionStatus } from '@/lib/websocket'

// Suppress transient disconnects shorter than this threshold
const TRANSIENT_THRESHOLD_MS = 5000

interface StatusConfig {
  icon: React.ReactNode
  label: string
  className: string
}

const STATUS_CONFIG: Partial<Record<ConnectionStatus, StatusConfig>> = {
  connecting: {
    icon: <Spinner className="size-3.5 text-muted-foreground" />,
    label: 'Connecting...',
    className: 'border-border bg-card',
  },
  authenticating: {
    icon: <Spinner className="size-3.5 text-muted-foreground" />,
    label: 'Authenticating...',
    className: 'border-border bg-card',
  },
  sprite_waking: {
    icon: <Spinner className="size-3.5 text-cyan-400/80" />,
    label: 'Connecting to your workspace...',
    className: 'border-cyan-400/20 bg-cyan-400/10',
  },
  disconnected: {
    icon: <Icons.WifiOff className="size-3.5" />,
    label: 'Reconnecting...',
    className: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400',
  },
  error: {
    icon: <Icons.AlertCircle className="size-3.5" />,
    label: 'Connection lost',
    className: 'border-red-200 bg-red-50 text-red-600 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400',
  },
}

export function ConnectionStatus() {
  const { status, error } = useWebSocket()
  const [visible, setVisible] = useState(false)
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevStatusRef = useRef<ConnectionStatus>(status)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status

    if (disconnectTimer.current) {
      clearTimeout(disconnectTimer.current)
      disconnectTimer.current = null
    }

    if (status === 'connected') {
      setVisible(false)
      return
    }

    // For disconnected status after being connected, delay showing indicator
    // to suppress transient network blips
    if (status === 'disconnected' && prev === 'connected') {
      disconnectTimer.current = setTimeout(() => {
        disconnectTimer.current = null
        setVisible(true)
      }, TRANSIENT_THRESHOLD_MS)
      return
    }

    // All other non-connected states show immediately
    setVisible(true)

    return () => {
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current)
        disconnectTimer.current = null
      }
    }
  }, [status])

  const config = STATUS_CONFIG[status]
  if (!visible || !config) return null

  const label = status === 'error' && error ? error : config.label

  return (
    <div
      data-testid="connection-status"
      className={cn(
        'pointer-events-auto fixed left-1/2 top-16 z-50 -translate-x-1/2',
        'flex items-center gap-2 rounded-full border px-3 py-1.5',
        'text-xs font-medium text-foreground shadow-lg bg-background/95',
        'animate-in fade-in slide-in-from-top-2 duration-300',
        config.className,
      )}
    >
      {config.icon}
      <span>{label}</span>
    </div>
  )
}
