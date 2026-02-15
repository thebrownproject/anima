import { useCallback, useEffect, useRef, useState } from 'react'
import { useVoiceStore } from '@/lib/stores/voice-store'

// Web Speech API types (not in all TS libs)
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

interface STTControls {
  startListening: () => Promise<void>
  stopListening: () => void
  isListening: boolean
  error: string | null
  analyser: AnalyserNode | null
}

export function useSTT(): STTControls {
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

    // Parallel mic stream for audio visualisation
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const node = ctx.createAnalyser()
      node.fftSize = 64
      source.connect(node)
      setAnalyser(node)
    } catch {
      // Visualiser is optional — continue without it
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onresult = (event: Event) => {
      const e = event as SpeechRecognitionEvent
      let finalTranscript = ''

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? ''
        }
      }

      if (finalTranscript) {
        const store = useVoiceStore.getState()
        const prev = store.transcript
        store.setTranscript(prev ? `${prev} ${finalTranscript}` : finalTranscript)
      }
    }

    recognition.onerror = (event: Event) => {
      const e = event as SpeechRecognitionErrorEvent
      if (e.error === 'not-allowed') {
        setError('Microphone access denied')
      } else if (e.error === 'no-speech') {
        // Not an error — just no speech detected, keep listening
        return
      } else {
        setError(`Speech recognition error: ${e.error}`)
      }
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopListening()
  }, [stopListening])

  return { startListening, stopListening, isListening, error, analyser }
}
