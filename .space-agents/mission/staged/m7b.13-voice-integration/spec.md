# Exploration: Voice Integration

**Date:** 2026-02-13
**Status:** Ready for planning

---

## Problem

Stackdocs users interact with their agent by typing in a chat interface. For a product positioned as a "personal AI computer," voice interaction is a natural evolution — users should be able to speak to their agent and hear responses, especially when their hands are occupied reviewing documents or Canvas data.

Voice input removes friction from the primary interaction loop (ask question → get answer → review data). Voice output makes the agent feel more alive and present, reinforcing the "personal computer" mental model where the agent is a colleague, not a text box.

---

## Solution

Add bidirectional voice capability to the frontend chat interface. Users can speak to the agent (speech-to-text) and optionally hear the agent's responses spoken aloud (text-to-speech). The Sprite agent remains the brain — voice is purely an I/O layer in the browser, with two thin Next.js API routes for provider authentication and CORS.

The Vercel AI Elements **Persona** component provides a visual state indicator (idle/listening/thinking/speaking/asleep) that replaces the microphone button in the chat bar, serving as both the interaction trigger and state feedback.

---

## Requirements

- [ ] **STT (Speech-to-Text)**: User taps Persona orb to start recording, taps again to stop and send. Browser requests a temporary Deepgram token from `/api/voice/deepgram-token`, then streams audio to Deepgram Nova-3 via WebSocket. Real-time transcription preview appears in the chat input field as user speaks. Final transcript is sent to the Sprite agent over existing WebSocket as a normal chat message.
- [ ] **TTS (Text-to-Speech)**: When TTS toggle is enabled, agent text responses are sent to the Next.js API route `/api/voice/tts` which proxies to OpenAI `gpt-4o-mini-tts` (voice: `fable`). Streaming audio is returned to the browser for playback. Persona state transitions to `speaking` during playback.
- [ ] **Persona component**: Vercel AI Elements Persona installed via `npx ai-elements@latest add persona` into `components/ai-elements/`. Integrated inline in the chat bar, right side (replacing mic icon). Layout toggle (sidebar/bottom bar) relocated to chat panel top bar. States: `idle` (default), `listening` (recording), `thinking` (waiting for agent), `speaking` (TTS playing), `asleep` (Sprite disconnected/waking).
- [ ] **Separate toggles**: Microphone toggle (enable/disable voice input) and speaker toggle (enable/disable TTS output) are independent controls.
- [ ] **Chat transcript**: All voice input appears as text messages in chat history. Voice is never a separate channel — it produces the same text messages as typing.
- [ ] **Streaming TTS**: Agent text responses are buffered and sent to TTS progressively (buffering strategy decided during implementation — sentence-level chunking likely).
- [ ] **Interruption**: User can tap Persona orb or start typing to stop TTS playback mid-sentence.
- [ ] **Transcription preview**: While recording, real-time transcription from Deepgram appears in the chat input field, replacing the placeholder text. Gives the user immediate feedback that their speech is being captured.

---

## Non-Requirements

- Not building a voice agent (ElevenLabs Conversational AI style) — the Sprite agent IS the agent
- Not routing raw audio through Bridge or Sprite — audio stays browser-side (only text crosses WebSocket)
- Not supporting wake words or always-listening mode
- Not building voice cloning or custom voice training
- Not adding voice-specific agent behavior (agent doesn't know if input came from voice or keyboard)
- Not handling multi-language voice switching (use provider defaults)
- Not determining pricing tier for voice (feature-flagged, decide later with usage data)
- Not building continuous conversation mode (auto-listen after TTS finishes, VAD-based utterance detection, echo cancellation) — this is a v2 enhancement after MVP validates voice UX
- Not adding cancel/discard recording (every recording gets sent; user can correct via text)
- Not implementing accessibility for Persona orb in MVP (ARIA labels, keyboard activation deferred)

---

## Architecture

### Audio Flow

```
USER SPEAKS                              AGENT RESPONDS
-----------                              ---------------
Browser mic                              Sprite agent sends text
    |                                         |
    v                                         v
Deepgram Nova-3 JS SDK          Next.js API route /api/voice/tts
(streaming STT via WebSocket)    (proxies to OpenAI gpt-4o-mini-tts)
    |                                         |
    v                                         v
Transcribed text                        Streaming audio response
(preview in chat input)                       |
    |                                         v
    v                                   Browser audio playback
Existing WebSocket                   (Persona → speaking state)
(text message to Sprite)
```

### Key Points

- **Raw audio never touches Bridge or Sprite.** Browser handles STT via Deepgram WebSocket (direct with temp token). TTS goes through a thin Next.js API route on Vercel.
- **Existing WebSocket protocol unchanged.** Voice input produces the same `chat_message` type as typing. The agent cannot distinguish voice from keyboard input.
- **API keys stay server-side.** Deepgram: temporary token minted by `/api/voice/deepgram-token` (30s TTL). OpenAI: key held by `/api/voice/tts` route, never sent to browser.
- **Persona component is the only new visual element.** It replaces the mic button in the chat bar. All state transitions are driven by the voice pipeline state machine.
- **`asleep` state maps to Sprite connection.** When Sprite is disconnected or waking, Persona shows `asleep` — free status indicator.

### State Machine

```
  ┌──────────┐
  │  ASLEEP  │  (Sprite disconnected/waking)
  └────┬─────┘
       │ sprite_ready
       v
┌─────────┐
│  IDLE   │<──────────────────────────┐
└────┬────┘                           │
     │ tap orb                        │
     v                                │
┌──────────────┐                      │
│  LISTENING   │  (recording, preview │
└──────┬───────┘   in chat input)     │
       │ tap orb again                │
       v                              │
┌──────────────┐                      │
│  THINKING    │  (transcript sent)   │
└──────┬───────┘                      │
       │ response                     │
  TTS off    TTS on                   │
  ┌──────────┤────────────┐           │
  │          │            │           │
  v          v            v           │
(idle)  ┌──────────┐                  │
        │ SPEAKING │──────────────────┘
        └──────────┘ (done/interrupt)
```

### Component Structure (Frontend)

```
frontend/
├── app/
│   └── api/
│       └── voice/
│           ├── deepgram-token/
│           │   └── route.ts        # NEW: Mint temporary Deepgram token (~20 lines)
│           └── tts/
│               └── route.ts        # NEW: Proxy OpenAI TTS, stream audio back (~30 lines)
├── components/
│   ├── ai-elements/
│   │   └── persona.tsx             # NEW: Installed via `npx ai-elements@latest add persona`
│   ├── desktop/
│   │   ├── chat-bar.tsx            # Modified: Persona orb replaces mic icon (right side), layout toggle removed
│   │   └── chat-panel.tsx          # Modified: Layout toggle relocated to top right header
│   └── voice/                      # NEW directory
│       ├── persona-orb.tsx         # Persona wrapper with voice state management
│       ├── voice-provider.tsx      # React context: Deepgram connection + TTS fetch
│       ├── use-stt.ts              # Hook: request temp token, Deepgram streaming STT
│       └── use-tts.ts              # Hook: call /api/voice/tts, manage audio playback queue
├── lib/
│   └── stores/
│       └── voice-store.ts          # NEW: Voice state (mic on/off, TTS on/off, persona state)
```

### Providers

| Role | Provider | SDK / Method | Cost |
|------|----------|-------------|------|
| STT | Deepgram Nova-3 | `@deepgram/sdk` (browser WebSocket with temp token) | $0.0077/min streaming |
| TTS | OpenAI `gpt-4o-mini-tts` (voice: `fable`) | Next.js API route → OpenAI REST (streaming) | $0.60/1M input tokens + $12/1M audio output tokens (~$0.015/min) |
| Visual | Vercel AI Elements Persona | `npx ai-elements@latest add persona` → `components/ai-elements/persona.tsx` | Free (Rive animation) |
| Token | Deepgram temp token | Next.js API route → Deepgram `/auth/grant` | Free (auth endpoint) |

### Dependencies (new packages)

| Package | Purpose | Notes |
|---------|---------|-------|
| `@deepgram/sdk` | Browser STT via WebSocket | Isomorphic SDK, browser-compatible |
| `@rive-app/react-canvas` | Rive runtime for Persona animations | ~200-400KB, must use `next/dynamic` with `ssr: false` |

---

## Constraints

- **Two thin Next.js API routes required** — `/api/voice/deepgram-token` and `/api/voice/tts`. No Bridge or Sprite changes.
- **Existing WebSocket protocol unchanged** — voice produces text messages identical to typed input
- **API keys server-side only** — `DEEPGRAM_API_KEY` and `OPENAI_API_KEY` as server env vars (NOT `NEXT_PUBLIC_*`). Temp Deepgram tokens have 30s TTL.
- **Persona requires Rive runtime** — WebGL2 dependency. Must use `next/dynamic` with `ssr: false` to code-split. Measure bundle impact.
- **Browser permissions** — microphone access requires HTTPS and user permission grant. Handle denial gracefully.
- **Mobile considerations** — Persona orb and toggles must work on touch. Test iOS Safari audio playback quirks (autoplay restrictions).
- **Build after m7b.12** — One Sprite Per User must be complete first. Voice depends on a working chat pipeline.

---

## Success Criteria

- [ ] User can tap Persona orb, speak, and see real-time transcription preview in chat input
- [ ] Tapping orb again sends final transcript as a chat message to Sprite agent
- [ ] Transcribed message is sent to Sprite agent and agent responds normally
- [ ] Persona transitions through asleep → idle → listening → thinking → (speaking) → idle correctly
- [ ] With TTS toggle on, agent responses are spoken aloud with streaming audio via /api/voice/tts
- [ ] User can interrupt TTS playback by tapping orb or typing
- [ ] Mic and TTS toggles work independently
- [ ] Voice works on Chrome, Safari, and Firefox
- [ ] No API keys exposed to browser (temp tokens only for Deepgram, proxy for OpenAI)
- [ ] No raw audio data flows through Bridge or Sprite WebSocket
- [ ] Feature can be gated behind a feature flag
- [ ] Persona shows `asleep` when Sprite is disconnected/waking

---

## Open Questions

1. **Persona component bundle size** — Rive runtime + animation assets. Need to verify this doesn't bloat the initial page load. Must use dynamic import / lazy loading.
2. **iOS Safari autoplay** — Safari restricts audio playback without user interaction. TTS playback may require a "user gesture" to unlock audio context. Test during implementation.
3. **TTS buffering strategy** — Agent streams text token-by-token, but OpenAI TTS needs complete text per API call. Sentence-level chunking is the likely approach, but exact strategy (boundary detection, markdown stripping, code block handling) to be decided during implementation.

---

## Next Steps

1. `/plan` to break into implementation tasks (after m7b.12 completes)
2. Test Persona component integration independently (bundle size, Rive runtime)
3. Set up Deepgram and OpenAI accounts with spending caps
