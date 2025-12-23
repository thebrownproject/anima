'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

export interface ExtractionUpdate {
  extracted_fields: Record<string, unknown>
  confidence_scores: Record<string, number>
}

interface UseExtractionRealtimeOptions {
  documentId: string
  onUpdate: (extraction: ExtractionUpdate) => void
}

export function useExtractionRealtime({
  documentId,
  onUpdate,
}: UseExtractionRealtimeOptions): { status: RealtimeStatus } {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onUpdateRef = useRef(onUpdate)

  // Keep onUpdate ref current to avoid stale closures
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    let supabaseClient: ReturnType<typeof createClerkSupabaseClient> | null = null
    let refreshInterval: NodeJS.Timeout | null = null

    const setupRealtime = async () => {
      // Get token first to ensure we have auth
      const token = await getToken()
      console.log('[Realtime] Token fetched:', token ? 'yes' : 'no')

      supabaseClient = createClerkSupabaseClient(() => getToken())

      // Explicitly set auth on realtime connection
      if (token) {
        supabaseClient.realtime.setAuth(token)
      }

      const channel = supabaseClient
        .channel(`extraction:${documentId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'extractions',
            filter: `document_id=eq.${documentId}`,
          },
          (payload) => {
            console.log('[Realtime] Received update')
            const newData = payload.new
            if (!newData || typeof newData !== 'object') {
              console.error('[Realtime] Invalid payload:', payload)
              return
            }

            const extracted_fields = (newData as Record<string, unknown>).extracted_fields as Record<string, unknown> | undefined
            const confidence_scores = (newData as Record<string, unknown>).confidence_scores as Record<string, number> | undefined

            onUpdateRef.current({
              extracted_fields: extracted_fields || {},
              confidence_scores: confidence_scores || {},
            })
          }
        )
        .subscribe((status, err) => {
          console.log('[Realtime] Status:', status, err || '')
          if (status === 'SUBSCRIBED') {
            setStatus('connected')
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setStatus('disconnected')
          }
        })

      channelRef.current = channel

      // Refresh auth every 50 seconds (before Clerk's 60s expiry)
      refreshInterval = setInterval(async () => {
        const newToken = await getToken()
        if (newToken && supabaseClient) {
          supabaseClient.realtime.setAuth(newToken)
          console.log('[Realtime] Token refreshed')
        }
      }, 50000)
    }

    setupRealtime()

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [documentId]) // getToken accessed via closure, not needed in deps

  return { status }
}
