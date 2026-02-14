import { useCallback, useEffect, useRef, useState } from 'react'

interface TTSControls {
  speak: (text: string) => void
  interrupt: () => void
  isSpeaking: boolean
}

const PROCESSOR_CODE = `
class PcmStreamPlayer extends AudioWorkletProcessor {
  constructor() {
    super()
    this.chunks = []
    this.offset = 0
    this.streamDone = false
    this.port.onmessage = (e) => {
      if (e.data.type === 'audio') {
        this.chunks.push(e.data.samples)
      } else if (e.data.type === 'end') {
        this.streamDone = true
      } else if (e.data.type === 'clear') {
        this.chunks = []
        this.offset = 0
        this.streamDone = true
      }
    }
  }
  process(inputs, outputs) {
    const out = outputs[0][0]
    let written = 0
    while (written < out.length && this.chunks.length > 0) {
      const chunk = this.chunks[0]
      const available = chunk.length - this.offset
      const needed = out.length - written
      const toCopy = Math.min(available, needed)
      out.set(chunk.subarray(this.offset, this.offset + toCopy), written)
      written += toCopy
      this.offset += toCopy
      if (this.offset >= chunk.length) {
        this.chunks.shift()
        this.offset = 0
      }
    }
    if (this.streamDone && this.chunks.length === 0) {
      this.port.postMessage({ type: 'done' })
      return false
    }
    return true
  }
}
registerProcessor('pcm-stream-player', PcmStreamPlayer)
`

export function useTTS(): TTSControls {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const moduleLoadedRef = useRef(false)

  const ensureContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
    }
    const ctx = audioContextRef.current
    if (!moduleLoadedRef.current) {
      const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' })
      blobUrlRef.current = URL.createObjectURL(blob)
      await ctx.audioWorklet.addModule(blobUrlRef.current)
      moduleLoadedRef.current = true
    }
    return ctx
  }, [])

  const speak = useCallback((text: string) => {
    // Interrupt any current playback
    if (abortRef.current) {
      abortRef.current.abort()
      workletNodeRef.current?.port.postMessage({ type: 'clear' })
      workletNodeRef.current?.disconnect()
      workletNodeRef.current = null
    }

    setIsSpeaking(true)

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      try {
        const ctx = await ensureContext()
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
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
        const PRE_BUFFER = 1200 // ~50ms at 24kHz — just enough to prevent initial stutter

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

        // Connect if stream ended before pre-buffer filled (short text)
        if (!connected) node.connect(ctx.destination)
        node.port.postMessage({ type: 'end' })
      } catch (err: any) {
        if (err?.name !== 'AbortError') setIsSpeaking(false)
      }
    })()
  }, [ensureContext])

  const interrupt = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    workletNodeRef.current?.port.postMessage({ type: 'clear' })
    workletNodeRef.current?.disconnect()
    workletNodeRef.current = null
    setIsSpeaking(false)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      workletNodeRef.current?.disconnect()
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      audioContextRef.current?.close()
    }
  }, [])

  return { speak, interrupt, isSpeaking }
}
