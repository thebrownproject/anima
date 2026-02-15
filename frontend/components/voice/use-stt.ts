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
    setAnalyser(null)
    setIsListening(false)
  }, [])

  const startListening = useCallback(async () => {
    // Double-invocation guard
    if (connectionRef.current || recorderRef.current) return

    setError(null)
    generationRef.current += 1
    const thisGen = generationRef.current

    // 1. Fetch temp token (with timeout)
    let token: string
    const fetchCtrl = new AbortController()
    const fetchTimeout = setTimeout(() => fetchCtrl.abort(), 10_000)
    try {
      const res = await fetch('/api/voice/deepgram-token', { signal: fetchCtrl.signal })
      clearTimeout(fetchTimeout)
      if (generationRef.current !== thisGen) return
      if (!res.ok) { setError('Failed to get voice token'); return }
      const data = await res.json()
      token = data.token
    } catch (err) {
      clearTimeout(fetchTimeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Voice connection timed out')
      } else {
        setError('Failed to get voice token')
      }
      return
    }

    // 2. Get mic stream + MediaRecorder
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true },
      })
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied' : 'Microphone unavailable'
      setError(msg)
      return
    }
    if (generationRef.current !== thisGen) {
      stream.getTracks().forEach(t => t.stop())
      return
    }
    streamRef.current = stream

    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder

    // 3. AnalyserNode for voice bars
    const audio = createAnalyser(stream)
    if (audio) {
      audioCtxRef.current = audio.ctx
      setAnalyser(audio.node)
    }

    // 4. Connect to Deepgram
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

    // 5. Start recording when connection opens
    connection.addListener(LiveTranscriptionEvents.Open, () => {
      if (generationRef.current !== thisGen) { stopListening(); return }
      setIsListening(true)
      recorder.addEventListener('dataavailable', (e: BlobEvent) => {
        if (e.data.size > 0) connection.send(e.data)
      })
      recorder.start(250)
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
