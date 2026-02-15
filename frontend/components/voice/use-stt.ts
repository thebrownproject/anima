'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createClient,
  LiveTranscriptionEvents,
  type LiveTranscriptionEvent,
} from '@deepgram/sdk'
import { useVoiceStore } from '@/lib/stores/voice-store'
import {
  acquireMic,
  releaseMic,
  connectAnalyser,
} from './audio-engine'

interface STTControls {
  startListening: () => Promise<void>
  stopListening: () => void
  isListening: boolean
  error: string | null
  analyser: AnalyserNode | null
}

// ─── Token cache ─────────────────────────────────────────────────────────────

interface CachedToken { token: string; expiresAt: number }

async function fetchDeepgramToken(signal?: AbortSignal): Promise<CachedToken> {
  const res = await fetch('/api/voice/deepgram-token', { signal })
  if (!res.ok) throw new Error('token-failed')
  const data = await res.json()
  return { token: data.token, expiresAt: Date.now() + (data.expires_in - 10) * 1000 }
}

// ─── Deepgram Nova-3 STT ─────────────────────────────────────────────────────

export function useSTT(): STTControls {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const connectionRef = useRef<ReturnType<ReturnType<typeof createClient>['listen']['live']> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const generationRef = useRef(0)
  const audioBufferRef = useRef<Blob[]>([])
  const wsOpenRef = useRef(false)
  const tokenCacheRef = useRef<CachedToken | null>(null)

  // Pre-fetch token on mount
  useEffect(() => {
    let cancelled = false
    fetchDeepgramToken().then(cached => {
      if (!cancelled) tokenCacheRef.current = cached
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const stopListening = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    connectionRef.current?.requestClose()
    recorderRef.current = null
    connectionRef.current = null
    audioBufferRef.current = []
    wsOpenRef.current = false

    // Release mic (stops tracks, disconnects analyser) — frees audio pipeline for TTS
    releaseMic()
    setAnalyser(null)
    setIsListening(false)
  }, [])

  const startListening = useCallback(async () => {
    if (connectionRef.current || recorderRef.current) return

    setError(null)
    generationRef.current += 1
    const thisGen = generationRef.current

    // 1. Resolve token + acquire mic in parallel
    const cached = tokenCacheRef.current
    const tokenIsFresh = cached && cached.expiresAt > Date.now()

    const fetchCtrl = new AbortController()
    const fetchTimeout = tokenIsFresh ? null : setTimeout(() => fetchCtrl.abort(), 10_000)

    const [tokenResult, micResult] = await Promise.allSettled([
      tokenIsFresh
        ? Promise.resolve(cached.token)
        : fetchDeepgramToken(fetchCtrl.signal).then(c => { tokenCacheRef.current = c; return c.token }),
      acquireMic(),
    ])
    if (fetchTimeout) clearTimeout(fetchTimeout)

    if (generationRef.current !== thisGen) return

    if (tokenResult.status === 'rejected' || micResult.status === 'rejected') {
      if (tokenResult.status === 'rejected') {
        const err = tokenResult.reason
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError('Voice connection timed out')
        } else {
          setError('Failed to get voice token')
        }
      } else if (micResult.status === 'rejected') {
        const err = micResult.reason
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone access denied' : 'Microphone unavailable'
        )
      }
      return
    }

    const token = tokenResult.value
    const stream = micResult.value

    // Background-refresh token when past half-life
    if (cached && cached.expiresAt - Date.now() < 55_000) {
      fetchDeepgramToken().then(c => { tokenCacheRef.current = c }).catch(() => {})
    }

    // 2. AnalyserNode for voice bars (shared context, no new AudioContext)
    const node = connectAnalyser()
    if (node) setAnalyser(node)

    // 3. Deepgram WS connection
    const client = createClient({ accessToken: token })
    const connection = client.listen.live({
      model: 'nova-3',
      interim_results: true,
      smart_format: true,
      utterance_end_ms: 1000,
      endpointing: 300,
      vad_events: true,
    })
    connectionRef.current = connection

    // 4. MediaRecorder — buffer audio until Deepgram WS opens
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.addEventListener('dataavailable', (e: BlobEvent) => {
      if (e.data.size === 0) return
      if (wsOpenRef.current) {
        connection.send(e.data)
      } else {
        audioBufferRef.current.push(e.data)
        if (audioBufferRef.current.length > 100) {
          setError('Voice connection took too long')
          stopListening()
        }
      }
    })
    try {
      recorder.start(100)
    } catch {
      setError('Microphone recording failed to start')
      stopListening()
      return
    }
    setIsListening(true)

    // 5. Flush buffer when Deepgram WS opens
    connection.addListener(LiveTranscriptionEvents.Open, () => {
      if (generationRef.current !== thisGen) { stopListening(); return }
      if (!stream.active) { stopListening(); return }
      for (const chunk of audioBufferRef.current) connection.send(chunk)
      audioBufferRef.current = []
      wsOpenRef.current = true
      keepAliveRef.current = setInterval(() => connection.keepAlive(), 10_000)
    })

    connection.addListener(LiveTranscriptionEvents.Transcript, (data: LiveTranscriptionEvent) => {
      if (generationRef.current !== thisGen) return // stale session
      const text = data.channel.alternatives[0]?.transcript
      if (text && data.is_final) {
        const store = useVoiceStore.getState()
        const prev = store.transcript
        store.setTranscript(prev ? `${prev} ${text}` : text)
      }
    })

    connection.addListener(LiveTranscriptionEvents.Error, (err: unknown) => {
      if (generationRef.current !== thisGen) return // stale session
      console.error('[deepgram] error:', err)
      setError('Voice transcription error')
      stopListening()
    })

    connection.addListener(LiveTranscriptionEvents.Close, () => {
      if (generationRef.current !== thisGen) return // stale session — don't nuke new recording's state
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current)
        keepAliveRef.current = null
      }
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      recorderRef.current = null
      connectionRef.current = null
      audioBufferRef.current = []
      wsOpenRef.current = false
      setIsListening(false)
    })
  }, [stopListening])

  // On unmount: stop session + release mic
  useEffect(() => {
    return () => {
      stopListening()
      releaseMic()
    }
  }, [stopListening])

  return { startListening, stopListening, isListening, error, analyser }
}
