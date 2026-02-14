import { useCallback, useEffect, useRef, useState } from 'react'

interface TTSControls {
  speak: (text: string) => void
  interrupt: () => void
  isSpeaking: boolean
}

export function useTTS(): TTSControls {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const queueRef = useRef<string[]>([])
  const playingRef = useRef(false)

  const playNext = useCallback(async () => {
    const text = queueRef.current.shift()
    if (!text) {
      playingRef.current = false
      setIsSpeaking(false)
      return
    }

    playingRef.current = true

    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        playNext()
        return
      }

      const ctx = audioContextRef.current!
      const arrayBuf = await res.arrayBuffer()
      // OpenAI PCM: 24kHz mono 16-bit signed little-endian
      const int16 = new Int16Array(arrayBuf)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
      const audioBuffer = ctx.createBuffer(1, int16.length, 24000)
      audioBuffer.getChannelData(0).set(float32)
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      sourceRef.current = source
      source.onended = () => playNext()
      source.start()
    } catch {
      // Skip failed chunk, continue queue
      playNext()
    }
  }, [])

  const speak = useCallback((text: string) => {
    // Lazy AudioContext creation (iOS Safari user gesture requirement)
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    queueRef.current.push(text)
    setIsSpeaking(true)

    if (!playingRef.current) {
      playNext()
    }
  }, [playNext])

  const interrupt = useCallback(() => {
    queueRef.current = []
    try { sourceRef.current?.stop() } catch { /* already stopped */ }
    sourceRef.current = null
    playingRef.current = false
    setIsSpeaking(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      queueRef.current = []
      try { sourceRef.current?.stop() } catch { /* noop */ }
      sourceRef.current = null
      playingRef.current = false
      audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [])

  return { speak, interrupt, isSpeaking }
}
