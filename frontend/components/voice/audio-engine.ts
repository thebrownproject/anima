// Shared audio engine — single AudioContext for both STT analysis and TTS playback.
//
// Two independent subgraphs in one audio graph:
//   MIC:  MediaStream → MediaStreamSource → AnalyserNode (dead end)
//   TTS:  AudioWorkletNode (PCM processor) → ctx.destination
//
// MediaRecorder reads directly from the MediaStream (not the audio graph),
// so the AudioContext never needs to close between recordings.

const SAMPLE_RATE = 24_000 // matches OpenAI TTS PCM output

const WORKLET_CODE = `
class PcmStreamPlayer extends AudioWorkletProcessor {
  constructor() {
    super()
    this.chunks = []
    this.offset = 0
    this.streamDone = false
    this.fadeInSamples = 1200   // 50ms fade-in at 24kHz
    this.preBuffer = 14400     // 600ms at 24kHz — covers OpenAI's burst-then-pause gap
    this.started = false
    this.samplesPlayed = 0
    this.port.onmessage = (e) => {
      if (e.data.type === 'audio') {
        this.chunks.push(e.data.samples)
      } else if (e.data.type === 'end') {
        this.streamDone = true
      } else if (e.data.type === 'clear') {
        this.chunks = []
        this.offset = 0
        this.started = false
        this.samplesPlayed = 0
        this.streamDone = true
      }
    }
  }
  process(inputs, outputs) {
    const out = outputs[0][0]
    // Pre-buffer: output silence until enough data has accumulated
    if (!this.started) {
      if (this.streamDone) { this.started = true }
      else {
        let queued = 0
        for (let i = 0; i < this.chunks.length; i++) queued += this.chunks[i].length
        queued -= this.offset
        if (queued < this.preBuffer) return true
        this.started = true
      }
    }
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
    if (this.samplesPlayed < this.fadeInSamples) {
      for (let i = 0; i < written; i++) {
        const s = this.samplesPlayed + i
        if (s < this.fadeInSamples) {
          out[i] *= s / this.fadeInSamples
        }
      }
    }
    this.samplesPlayed += written
    if (this.streamDone && this.chunks.length === 0) {
      this.port.postMessage({ type: 'done' })
      return false
    }
    return true
  }
}
try { registerProcessor('pcm-stream-player', PcmStreamPlayer) } catch(e) {}
`

// ─── Module-level singleton state ────────────────────────────────────────────

let ctx: AudioContext | null = null
let stream: MediaStream | null = null
let source: MediaStreamAudioSourceNode | null = null
let analyser: AnalyserNode | null = null
let workletLoaded = false
let blobUrl: string | null = null

// ─── AudioContext ────────────────────────────────────────────────────────────

/** Get or lazily create the shared 24kHz AudioContext. */
export function getOrCreateContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new (window.AudioContext || (window as /* eslint-disable-line */ any).webkitAudioContext)({
      sampleRate: SAMPLE_RATE,
    })
    workletLoaded = false // new context needs fresh worklet registration
  }
  return ctx
}

/** Resume a suspended context (requires user gesture). */
export async function ensureResumed(): Promise<AudioContext> {
  const c = getOrCreateContext()
  if (c.state === 'suspended') await c.resume()
  return c
}

// ─── AudioWorklet ────────────────────────────────────────────────────────────

/** Load the PCM stream player worklet module (idempotent). */
export async function loadWorkletModule(): Promise<void> {
  const c = getOrCreateContext()
  if (workletLoaded) return
  const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
  blobUrl = URL.createObjectURL(blob)
  await c.audioWorklet.addModule(blobUrl)
  workletLoaded = true
}

// ─── Microphone ──────────────────────────────────────────────────────────────

/** Acquire mic stream (reuses active stream if available). */
export async function acquireMic(): Promise<MediaStream> {
  if (stream?.active) return stream
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { noiseSuppression: true, echoCancellation: true },
  })
  return stream
}

/** Release mic stream and disconnect source/analyser nodes. */
export function releaseMic(): void {
  stream?.getTracks().forEach((t) => t.stop())
  if (source) { try { source.disconnect() } catch { /* already disconnected */ } }
  source = null
  analyser = null
  stream = null
}

// ─── AnalyserNode (for VoiceBars) ────────────────────────────────────────────

/** Connect mic to analyser on the shared context. Returns the AnalyserNode. */
export function connectAnalyser(): AnalyserNode | null {
  const c = getOrCreateContext()
  if (!stream?.active) return null
  try {
    if (!source) source = c.createMediaStreamSource(stream)
    if (!analyser) {
      analyser = c.createAnalyser()
      analyser.fftSize = 256
    }
    source.connect(analyser)
    return analyser
  } catch {
    return null
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/** Full teardown — close context, release mic, revoke blob URL. */
export function destroy(): void {
  releaseMic()
  if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null }
  if (ctx && ctx.state !== 'closed') { ctx.close().catch(() => {}) }
  ctx = null
  workletLoaded = false
}
