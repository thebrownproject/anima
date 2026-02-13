# Feature: Voice Integration (Deepgram STT + OpenAI TTS + Persona Orb)

**Goal:** Add bidirectional voice to the desktop chat interface — users speak to the agent (STT) and optionally hear responses (TTS) — with a Persona orb as the visual interaction point.

## Overview

Voice is a browser I/O layer on top of the existing chat pipeline. The Sprite agent stays the brain. Raw audio never touches Bridge or Sprite — STT goes browser-direct to Deepgram via WebSocket with temporary tokens, TTS goes through a thin Next.js API route proxy to OpenAI. The Vercel AI Elements Persona component (Rive animation) provides visual state feedback.

**Providers:** Deepgram Nova-3 (STT, $0.008/min), OpenAI gpt-4o-mini-tts with fable voice (TTS, ~$0.015/min)
**New packages:** `@deepgram/sdk`, `@rive-app/react-canvas`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`
**Scope:** Frontend only — no Bridge or Sprite changes. Existing WebSocket protocol unchanged.

## Tasks

### Task: Setup — deps, Vitest, Persona, voice-config, feature flag

**Goal:** Install all dependencies, set up test infrastructure, create the feature flag/env validation module, and install the Persona component.
**Files:** Create `frontend/vitest.config.ts`, `frontend/lib/voice-config.ts`, `frontend/components/ai-elements/persona.tsx` (via npx). Modify `frontend/package.json`.
**Depends on:** None

**Steps:**
1. Install npm packages: `@deepgram/sdk`, `@rive-app/react-canvas`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
2. Create `vitest.config.ts` with jsdom environment and `@` path alias
3. Create `lib/voice-config.ts` with `isVoiceEnabled()` (reads `NEXT_PUBLIC_VOICE_ENABLED`) and `validateVoiceEnv()` (checks `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`)
4. Run `npx ai-elements@latest add persona` to scaffold Persona component
5. Add env vars to `.env.local`: `DEEPGRAM_API_KEY`, `OPENAI_API_KEY` (server-only), `NEXT_PUBLIC_VOICE_ENABLED=false`
6. Verify `next build` succeeds
7. Measure `@rive-app/react-canvas` bundle impact

**Tests:**
- [ ] `isVoiceEnabled()` returns false when env var missing
- [ ] `isVoiceEnabled()` returns true when set to "true"
- [ ] `validateVoiceEnv()` returns invalid when API keys missing
- [ ] `validateVoiceEnv()` returns valid when all keys present
- [ ] App builds successfully with new deps

### Task: Voice store (Zustand state machine)

**Goal:** Create the central voice state store with enforced state transitions and independent toggles.
**Files:** Create `frontend/lib/stores/voice-store.ts`
**Depends on:** None

**Steps:**
1. Define `PersonaState` type: `'asleep' | 'idle' | 'listening' | 'thinking' | 'speaking'`
2. Create Zustand store with state: `personaState` (default `'asleep'`), `micEnabled` (false), `ttsEnabled` (false), `transcript` ('')
3. Implement `VALID_TRANSITIONS` map as single source of truth for state machine
4. Implement actions: `setPersonaState()` (validates transitions), `toggleMic()`, `toggleTts()`, `setTranscript()`, `clearTranscript()`
5. Follow chat-store pattern: flat store, no middleware, no persist, named export `useVoiceStore`

**Valid transitions:**
- asleep → idle (WS connects)
- idle → listening (tap orb)
- listening → thinking (tap orb, sends transcript)
- listening → idle (cancel/typing)
- thinking → speaking (TTS on, agent responds)
- thinking → idle (TTS off, agent responds)
- speaking → idle (done/interrupt)
- ANY → asleep (WS disconnects)

**Tests:**
- [ ] Default state: personaState 'asleep', micEnabled false, ttsEnabled false, transcript ''
- [ ] Valid transitions succeed (asleep→idle, idle→listening, listening→thinking, thinking→speaking, speaking→idle)
- [ ] Invalid transitions rejected (asleep→listening, idle→speaking)
- [ ] Any state → asleep always succeeds
- [ ] toggleMic flips independently of ttsEnabled
- [ ] toggleTts flips independently of micEnabled
- [ ] setTranscript/clearTranscript work correctly

### Task: API routes (Deepgram token + TTS proxy)

**Goal:** Create two authenticated Next.js API routes for voice provider communication.
**Files:** Create `frontend/app/api/voice/deepgram-token/route.ts`, `frontend/app/api/voice/tts/route.ts`
**Depends on:** Setup (Deepgram SDK installed)

**Steps:**
1. Create `/api/voice/deepgram-token` GET route: Clerk auth → validateVoiceEnv → Deepgram SDK `createClient(key).auth.grantToken()` → return `{ token, expires_in }`
2. Create `/api/voice/tts` POST route: Clerk auth → check OPENAI_API_KEY → parse `{ text }` body → fetch OpenAI `/v1/audio/speech` (model: gpt-4o-mini-tts, voice: fable, format: mp3) → stream response body through
3. Both routes: 401 for no auth, 503 for missing API keys, proper error responses

**Tests:**
- [ ] Deepgram route: 401 without auth, 503 without API key, 200 with token on success
- [ ] TTS route: 401 without auth, 503 without API key, 400 without text, 200 with audio/mpeg on success
- [ ] TTS response is streamed (ReadableStream pass-through), not buffered
- [ ] No API keys in any response body

### Task: use-stt hook (Deepgram streaming STT)

**Goal:** Create the speech-to-text hook that manages mic capture, Deepgram streaming, and real-time transcript updates.
**Files:** Create `frontend/components/voice/use-stt.ts`
**Depends on:** Voice store, API routes (Deepgram token)

**Steps:**
1. `startListening()`: fetch temp token from `/api/voice/deepgram-token`
2. Request mic via `navigator.mediaDevices.getUserMedia({ audio: true })`
3. Create Deepgram client with temp token, open streaming WS: `deepgram.listen.live({ model: 'nova-3', language: 'en', smart_format: true, interim_results: true })`
4. Create `MediaRecorder(stream, { mimeType: 'audio/webm' })`, start with 250ms chunks
5. On `MediaRecorder.ondataavailable`, send chunk to Deepgram connection
6. On `LiveTranscriptionEvents.Transcript`, update `voice-store.transcript`
7. `stopListening()`: stop MediaRecorder, stop mic tracks, close Deepgram WS
8. Handle mic permission denied gracefully (set error, don't crash)

**Tests:**
- [ ] startListening fetches temp token from /api/voice/deepgram-token
- [ ] startListening requests microphone access
- [ ] Mic permission denied sets error message
- [ ] Deepgram transcript events update voice-store.transcript
- [ ] stopListening stops tracks and closes Deepgram connection
- [ ] Cleanup on unmount (stream stopped, WS closed)

### Task: use-tts hook (OpenAI audio playback)

**Goal:** Create the text-to-speech hook that sends text to the TTS proxy, plays audio, manages a queue, and supports interruption.
**Files:** Create `frontend/components/voice/use-tts.ts`
**Depends on:** Voice store, API routes (TTS proxy)

**Steps:**
1. `speak(text)`: push to queue, set isSpeaking true, call `playNext()`
2. `playNext()`: shift from queue → `fetch('/api/voice/tts', { text })` → `AudioContext.decodeAudioData()` → `createBufferSource()` → `source.start()`
3. `source.onended`: call `playNext()` recursively until queue empty, then set isSpeaking false
4. `interrupt()`: `source.stop()` (try/catch), clear queue, set isSpeaking false
5. AudioContext created lazily on first `speak()` call (iOS Safari user gesture requirement)
6. `playingRef` flag prevents race conditions during async fetch

**Buffering strategy:** Full-response-then-speak for MVP. No sentence-level chunking. Optimize later.

**Tests:**
- [ ] speak() calls /api/voice/tts with text body
- [ ] speak() sets isSpeaking to true
- [ ] Multiple speak() calls queue and play sequentially
- [ ] interrupt() stops current audio and clears queue
- [ ] After interrupt, isSpeaking is false
- [ ] AudioContext created lazily (not on mount)

### Task: Voice provider (React context)

**Goal:** Create the composition layer that wires STT output to chat and chat output to TTS.
**Files:** Create `frontend/components/voice/voice-provider.tsx`
**Depends on:** use-stt, use-tts, Voice store

**Steps:**
1. Create `VoiceContext` with `{ startVoice, stopVoice, interruptTTS }`
2. `startVoice()`: set personaState 'listening', call `startListening()`
3. `stopVoice()`: call `stopListening()`, read transcript from store, send as chat message via WebSocket, clear transcript, set personaState 'thinking'
4. `interruptTTS()`: call `interrupt()`, set personaState 'idle'
5. Subscribe to `useChatStore` — when `isAgentStreaming` flips true→false and ttsEnabled, call `speak()` with last agent message and set personaState 'speaking'
6. Sync WS status → personaState: disconnected→asleep, connected+asleep→idle
7. When `isSpeaking` becomes false and personaState is 'speaking', transition to 'idle'
8. Cleanup on unmount: stopListening + interrupt
9. Export `MaybeVoiceProvider` that passes through children when `isVoiceEnabled()` is false
10. Export `useVoice()` hook for context consumers

**Tests:**
- [ ] STT transcript is sent as chat message via WebSocket
- [ ] Agent message completion triggers TTS when ttsEnabled
- [ ] Agent message completion does NOT trigger TTS when ttsEnabled is false
- [ ] PersonaState transitions correctly through the full flow
- [ ] WS disconnected sets personaState to asleep
- [ ] Cleanup on unmount

### Task: Persona orb component

**Goal:** Create the visual Persona orb with animation state mapping, tap interactions, and toggle buttons.
**Files:** Create `frontend/components/voice/persona-orb.tsx`
**Depends on:** Setup (Persona component), Voice provider

**Steps:**
1. Dynamic import Persona with `ssr: false` (Rive needs WebGL2)
2. Map personaState to Persona animation states via `STATE_MAP` record
3. Tap handler: idle→startVoice, listening→stopVoice, speaking→interruptTTS, asleep→disabled
4. Mic toggle: `GlassIconButton` with Microphone/MicrophoneOff icons
5. TTS toggle: `GlassIconButton` with Volume/VolumeOff icons
6. Transcript preview: glass pill above orb, visible when listening + transcript non-empty
7. Orb sized to fit mic button footprint (~36-48px)

**Tests:**
- [ ] Persona animation reflects current personaState
- [ ] Tap in idle starts voice, tap in listening stops, tap in speaking interrupts
- [ ] Tap in asleep does nothing (button disabled)
- [ ] Mic and TTS toggles work independently
- [ ] Transcript preview shows during listening

### Task: Chat integration + feature gate

**Goal:** Wire PersonaOrb into chat-bar, wrap desktop page in VoiceProvider, gate behind feature flag.
**Files:** Modify `frontend/components/desktop/chat-bar.tsx`, `frontend/app/(desktop)/desktop/page.tsx`
**Depends on:** Persona orb, Voice provider

**Steps:**
1. In chat-bar.tsx: import PersonaOrb, isVoiceEnabled, useVoice, useVoiceStore
2. Replace mic GlassIconButton with: `isVoiceEnabled() ? <PersonaOrb /> : <GlassIconButton icon={Microphone} />`
3. In textarea onChange: if personaState === 'listening', call stopVoice() (typing cancels recording)
4. In page.tsx: import MaybeVoiceProvider, nest inside WebSocketProvider
5. Verify icons barrel has Volume/VolumeOff exports, add if missing
6. No-regression verification: Enter-to-send, Shift+Enter newline, chips, panel toggle all still work

**Tests:**
- [ ] PersonaOrb renders when NEXT_PUBLIC_VOICE_ENABLED=true
- [ ] Original mic button renders when NEXT_PUBLIC_VOICE_ENABLED=false
- [ ] Typing during listening cancels recording
- [ ] Full E2E flow: tap orb → speak → transcript → agent responds → TTS plays
- [ ] Keyboard-only chat flow unchanged (no regression)
- [ ] VoiceProvider nested inside WebSocketProvider in page tree

## Sequence

1. Setup (no deps) — can parallel with Voice store
2. Voice store (no deps) — can parallel with Setup
3. API routes (depends on Setup)
4. use-stt (depends on Voice store + API routes)
5. use-tts (depends on Voice store + API routes)
6. Voice provider (depends on use-stt + use-tts)
7. Persona orb (depends on Setup + Voice provider)
8. Chat integration (depends on Persona orb + Voice provider)

**Critical path:** Setup → API routes → use-stt → Voice provider → Persona orb → Chat integration (6 tasks)

**Parallelism (single dev):** Tasks 1+2 can be done in one session. Tasks 4+5 are sequential in practice (shared store interface). All other tasks are sequential.

```
Setup (1) ─────┐
               ├──> API routes (3) ──> use-stt (4) ──┐
Voice store (2)┤                                      ├──> Voice provider (6) ──> Persona orb (7) ──> Chat integration (8)
               └──────────────────> use-tts (5) ──────┘
```

## Risks

1. **Deepgram SDK SSR compat** — `@deepgram/sdk` may break SSR. Test import in client component during Setup. Mitigation: `next/dynamic` or conditional import.
2. **Rive bundle size** — `@rive-app/react-canvas` is 200-400KB. Measure during Setup. Mitigation: `next/dynamic` with `ssr: false` (already planned).
3. **iOS Safari autoplay** — AudioContext must be created during user gesture. Mitigation: lazy creation in use-tts on first `speak()` call.
4. **TTS buffering** — Full-response-then-speak for MVP. Sentence-level chunking deferred.
5. **Component tree nesting** — VoiceProvider must be child of WebSocketProvider. MaybeVoiceProvider pattern handles feature flag gating.

## Success Criteria

- [ ] User can tap Persona orb, speak, and see real-time transcription in chat input
- [ ] Tapping orb again sends transcript as a chat message to Sprite agent
- [ ] Agent responds normally to voice input
- [ ] Persona transitions through asleep → idle → listening → thinking → speaking → idle
- [ ] TTS toggle on: agent responses spoken aloud via streaming audio
- [ ] Interruption works (tap orb or type to stop TTS)
- [ ] Mic and TTS toggles independent
- [ ] No API keys exposed to browser
- [ ] Feature gated behind NEXT_PUBLIC_VOICE_ENABLED
- [ ] No regressions in keyboard-only chat flow
