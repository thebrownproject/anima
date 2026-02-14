import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { useVoiceStore } from '@/lib/stores/voice-store'

interface STTControls {
  startListening: () => Promise<void>
  stopListening: () => void
  isListening: boolean
  error: string | null
}

export function useSTT(): STTControls {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectionRef = useRef<ReturnType<ReturnType<typeof createClient>['listen']['live']> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopListening = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    connectionRef.current?.requestClose()

    recorderRef.current = null
    streamRef.current = null
    connectionRef.current = null
    setIsListening(false)
  }, [])

  const startListening = useCallback(async () => {
    setError(null)

    // 1. Fetch temp token
    const res = await fetch('/api/voice/deepgram-token')
    if (!res.ok) {
      setError('Failed to get voice token')
      return
    }
    const { token } = await res.json()

    // 2. Request mic access
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied'
        : 'Microphone unavailable'
      setError(msg)
      return
    }
    streamRef.current = stream

    // 3. Create Deepgram streaming connection
    const client = createClient({ accessToken: token })
    const connection = client.listen.live({
      model: 'nova-3',
      interim_results: true,
      smart_format: true,
    })
    connectionRef.current = connection

    // 4. Handle transcript events
    connection.on(LiveTranscriptionEvents.Transcript, (data: {
      is_final?: boolean
      channel: { alternatives: { transcript: string }[] }
    }) => {
      const text = data.channel.alternatives[0]?.transcript
      if (text && data.is_final) {
        useVoiceStore.getState().setTranscript(text)
      }
    })

    // 5. MediaRecorder — 250ms chunks sent to Deepgram
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) connection.send(e.data)
    }
    recorder.start(250)
    recorderRef.current = recorder

    setIsListening(true)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopListening()
  }, [stopListening])

  return { startListening, stopListening, isListening, error }
}
