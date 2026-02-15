'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createClient,
  LiveTranscriptionEvents,
  type LiveTranscriptionEvent,
} from '@deepgram/sdk'
import { useVoiceStore } from '@/lib/stores/voice-store'

interface STTControls {
  startListening: () => Promise<void>
  stopListening: () => void
  isListening: boolean
  error: string | null
  analyser: AnalyserNode | null
}

// ─── Shared: mic stream + AnalyserNode setup ────────────────────────────────

function createAnalyser(stream: MediaStream): { ctx: AudioContext; node: AnalyserNode } | null {
  try {
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const node = ctx.createAnalyser()
    node.fftSize = 256
    source.connect(node)
    return { ctx, node }
  } catch {
    return null
  }
}

// ─── Deepgram Nova-3 STT (primary) ─────────────────────────────────────────

// ─── Token cache: fetch eagerly on mount, reuse until near expiry ───────────

interface CachedToken { token: string; expiresAt: number }

async function fetchDeepgramToken(signal?: AbortSignal): Promise<CachedToken> {
  const res = await fetch('/api/voice/deepgram-token', { signal })
  if (!res.ok) throw new Error('token-failed')
  const data = await res.json()
  // Expire 10s early to avoid using a nearly-expired token
  return { token: data.token, expiresAt: Date.now() + (data.expires_in - 10) * 1000 }
}

export function useDeepgramSTT(): STTControls {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const connectionRef = useRef<ReturnType<ReturnType<typeof createClient>['listen']['live']> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const generationRef = useRef(0)
  const audioBufferRef = useRef<Blob[]>([])
  const wsOpenRef = useRef(false)
  const tokenCacheRef = useRef<CachedToken | null>(null)

  // Pre-fetch token on mount so it's ready when user presses record
  useEffect(() => {
    let cancelled = false
    fetchDeepgramToken().then(cached => {
      if (!cancelled) tokenCacheRef.current = cached
    }).catch(() => { /* will fetch on-demand in startListening */ })
    return () => { cancelled = true }
  }, [])

  const stopListening = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()
    connectionRef.current?.requestClose()
    recorderRef.current = null
    streamRef.current = null
    audioCtxRef.current = null
    connectionRef.current = null
    audioBufferRef.current = []
    wsOpenRef.current = false
    setAnalyser(null)
    setIsListening(false)
  }, [])

  const startListening = useCallback(async () => {
    // Double-invocation guard
    if (connectionRef.current || recorderRef.current) return

    setError(null)
    generationRef.current += 1
    const thisGen = generationRef.current

    // 1+2. Use cached token (or fetch fresh) + acquire mic in parallel
    const cached = tokenCacheRef.current
    const tokenIsFresh = cached && cached.expiresAt > Date.now()

    const fetchCtrl = new AbortController()
    const fetchTimeout = tokenIsFresh ? null : setTimeout(() => fetchCtrl.abort(), 10_000)

    const [tokenResult, micResult] = await Promise.allSettled([
      tokenIsFresh
        ? Promise.resolve(cached.token)
        : fetchDeepgramToken(fetchCtrl.signal).then(c => { tokenCacheRef.current = c; return c.token }),
      navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true },
      }),
    ])
    if (fetchTimeout) clearTimeout(fetchTimeout)

    if (generationRef.current !== thisGen) {
      if (micResult.status === 'fulfilled') micResult.value.getTracks().forEach(t => t.stop())
      return
    }

    // Handle failures — clean up whichever succeeded if the other failed
    if (tokenResult.status === 'rejected' || micResult.status === 'rejected') {
      if (micResult.status === 'fulfilled') micResult.value.getTracks().forEach(t => t.stop())

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
    streamRef.current = stream

    // 3. AnalyserNode for voice bars
    const audio = createAnalyser(stream)
    if (audio) {
      audioCtxRef.current = audio.ctx
      setAnalyser(audio.node)
    }

    // 4. Connect to Deepgram (start WS handshake)
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

    // 5. Start recording immediately — buffer audio until Deepgram WS opens
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

    // 6. Flush buffered audio when connection opens
    connection.addListener(LiveTranscriptionEvents.Open, () => {
      if (generationRef.current !== thisGen) { stopListening(); return }
      if (!stream.active) { stopListening(); return }
      for (const chunk of audioBufferRef.current) connection.send(chunk)
      audioBufferRef.current = []
      wsOpenRef.current = true
      keepAliveRef.current = setInterval(() => connection.keepAlive(), 10000)
    })

    connection.addListener(LiveTranscriptionEvents.Transcript, (data: LiveTranscriptionEvent) => {
      const text = data.channel.alternatives[0]?.transcript
      if (text && data.is_final) {
        const store = useVoiceStore.getState()
        const prev = store.transcript
        store.setTranscript(prev ? `${prev} ${text}` : text)
      }
    })

    connection.addListener(LiveTranscriptionEvents.Error, (err: unknown) => {
      console.error('[deepgram] error:', err)
      setError('Voice transcription error')
      stopListening()
    })

    connection.addListener(LiveTranscriptionEvents.Close, () => {
      // Connection closed (token expired, network issue, etc.)
      // Clean up mic and recorder — don't call requestClose since already closed
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current)
        keepAliveRef.current = null
      }
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
      recorderRef.current = null
      streamRef.current = null
      audioCtxRef.current = null
      connectionRef.current = null
      audioBufferRef.current = []
      wsOpenRef.current = false
      setAnalyser(null)
      setIsListening(false)
    })
  }, [stopListening])

  useEffect(() => { return () => stopListening() }, [stopListening])

  return { startListening, stopListening, isListening, error, analyser }
}

// ─── Web Speech API STT (fallback — Chrome/Edge only, no API keys) ──────────

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export function useWebSpeechSTT(): STTControls {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()
    recognitionRef.current = null
    streamRef.current = null
    audioCtxRef.current = null
    setAnalyser(null)
    setIsListening(false)
  }, [])

  const startListening = useCallback(async () => {
    setError(null)

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition not supported in this browser')
      return
    }

    // Mic stream for AnalyserNode (voice bars)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audio = createAnalyser(stream)
      if (audio) {
        audioCtxRef.current = audio.ctx
        setAnalyser(audio.node)
      }
    } catch {
      // Visualiser is optional
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    recognition.onresult = (event: Event) => {
      const e = event as SpeechRecognitionEvent
      let finalTranscript = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) finalTranscript += result[0]?.transcript ?? ''
      }
      if (finalTranscript) {
        const store = useVoiceStore.getState()
        const prev = store.transcript
        store.setTranscript(prev ? `${prev} ${finalTranscript}` : finalTranscript)
      }
    }

    recognition.onerror = (event: Event) => {
      const e = event as SpeechRecognitionErrorEvent
      if (e.error === 'no-speech') return
      if (e.error === 'not-allowed') setError('Microphone access denied')
      else setError(`Speech recognition error: ${e.error}`)
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  useEffect(() => { return () => stopListening() }, [stopListening])

  return { startListening, stopListening, isListening, error, analyser }
}

// ─── Default: Deepgram (swap to useWebSpeechSTT if Deepgram unavailable) ────

export const useSTT = useDeepgramSTT
