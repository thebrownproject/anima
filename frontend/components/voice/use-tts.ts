import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureResumed, loadWorkletModule, destroy } from './audio-engine'

interface TTSControls {
  speak: (text: string) => void
  interrupt: () => void
  isSpeaking: boolean
  error: string | null
  analyser: AnalyserNode | null
}

/** Read PCM stream, decode Int16→Float32, feed to AudioWorklet.
 *  Node is connected before streaming — the worklet handles pre-buffering internally
 *  so that process() doesn't consume samples before audio reaches speakers. */
async function streamPCMToWorklet(body: ReadableStream, node: AudioWorkletNode, ctx: AudioContext, analyserNode: AnalyserNode) {
  node.connect(analyserNode)
  analyserNode.connect(ctx.destination)
  const reader = body.getReader()
  let carry: number | null = null

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
  }

  node.port.postMessage({ type: 'end' })
}

export function useTTS(): TTSControls {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cleanupAudio = useCallback(() => {
    workletNodeRef.current?.port.postMessage({ type: 'clear' })
    workletNodeRef.current?.disconnect()
    workletNodeRef.current = null
    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
      setAnalyser(null)
    }
  }, [])

  const speak = useCallback((text: string) => {
    // Interrupt any current playback
    if (abortRef.current) {
      abortRef.current.abort()
      cleanupAudio()
    }

    setError(null)
    setIsSpeaking(true)

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      try {
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

        const ttsAnalyser = ctx.createAnalyser()
        ttsAnalyser.fftSize = 256
        analyserRef.current = ttsAnalyser
        setAnalyser(ttsAnalyser)

        const node = new AudioWorkletNode(ctx, 'pcm-stream-player')
        workletNodeRef.current = node
        node.port.onmessage = (e) => {
          if (e.data.type === 'done') {
            cleanupAudio()
            setIsSpeaking(false)
          }
        }

        await streamPCMToWorklet(res.body, node, ctx, ttsAnalyser)
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError('Speech playback error')
          setIsSpeaking(false)
        }
      }
    })()
  }, [cleanupAudio])

  const interrupt = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    cleanupAudio()
    setIsSpeaking(false)
  }, [cleanupAudio])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      workletNodeRef.current?.disconnect()
      analyserRef.current?.disconnect()
      destroy()
    }
  }, [])

  return { speak, interrupt, isSpeaking, error, analyser }
}
