import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureResumed, loadWorkletModule, destroy } from './audio-engine'

interface TTSControls {
  speak: (text: string) => void
  interrupt: () => void
  isSpeaking: boolean
  error: string | null
}

export function useTTS(): TTSControls {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const speak = useCallback((text: string) => {
    // Interrupt any current playback
    if (abortRef.current) {
      abortRef.current.abort()
      workletNodeRef.current?.port.postMessage({ type: 'clear' })
      workletNodeRef.current?.disconnect()
      workletNodeRef.current = null
    }

    setError(null)
    setIsSpeaking(true)

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      try {
        // Lazy init — context + worklet only created on first speak()
        await loadWorkletModule()
        const ctx = await ensureResumed()

        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          setError('Speech generation failed')
          setIsSpeaking(false)
          return
        }

        const node = new AudioWorkletNode(ctx, 'pcm-stream-player')
        workletNodeRef.current = node
        node.port.onmessage = (e) => {
          if (e.data.type === 'done') {
            node.disconnect()
            workletNodeRef.current = null
            setIsSpeaking(false)
          }
        }

        const reader = res.body.getReader()
        let carry: number | null = null
        let connected = false
        let bufferedSamples = 0
        const PRE_BUFFER = 1200 // ~50ms at 24kHz

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          let bytes = value as Uint8Array
          if (carry !== null) {
            const combined = new Uint8Array(1 + bytes.length)
            combined[0] = carry
            combined.set(bytes, 1)
            bytes = combined
            carry = null
          }
          if (bytes.length % 2 !== 0) {
            carry = bytes[bytes.length - 1]
            bytes = bytes.subarray(0, bytes.length - 1)
          }
          if (bytes.length === 0) continue

          const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2)
          const float32 = new Float32Array(int16.length)
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
          node.port.postMessage({ type: 'audio', samples: float32 }, [float32.buffer])

          if (!connected) {
            bufferedSamples += int16.length
            if (bufferedSamples >= PRE_BUFFER) {
              node.connect(ctx.destination)
              connected = true
            }
          }
        }

        if (!connected) node.connect(ctx.destination)
        node.port.postMessage({ type: 'end' })
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError('Speech playback error')
          setIsSpeaking(false)
        }
      }
    })()
  }, [])

  const interrupt = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    workletNodeRef.current?.port.postMessage({ type: 'clear' })
    workletNodeRef.current?.disconnect()
    workletNodeRef.current = null
    setIsSpeaking(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      workletNodeRef.current?.disconnect()
      destroy()
    }
  }, [])

  return { speak, interrupt, isSpeaking, error }
}
