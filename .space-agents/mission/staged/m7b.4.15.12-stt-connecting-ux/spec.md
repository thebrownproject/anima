# Exploration: STT Connecting UX + Word-Loss Fix

**Date:** 2026-02-16
**Status:** Ready for planning

---

## Problem

When users tap the PersonaOrb to start voice recording, the system pretends to be listening before it's actually ready. The Rive animation transitions to "listening" immediately, but the Deepgram WebSocket hasn't connected yet. Audio captured during this gap is buffered and flushed when the connection opens.

This causes two problems:

**1. Words lost on 2nd+ recordings.** The first recording works fine because the lazy Deepgram SDK import (~200-400ms) accidentally gives the browser's audio pipeline (noiseSuppression, echoCancellation DSP) time to warm up before the MediaRecorder starts. On subsequent recordings, the SDK is cached (0ms delay), so the recorder starts almost immediately after `getUserMedia()` returns. The audio hardware hasn't stabilized yet, producing silence or garbled data in the first 1-3 chunks (100-300ms). These chunks get buffered and flushed to Deepgram, but contain no usable speech.

**2. No visual feedback during connection setup.** There's no distinction between "connecting" and "listening" in the UI. The user sees the listening animation and starts talking, but the system isn't ready. The VoiceBars frequency visualizer has no data to display during the WS handshake, creating a dead visual gap.

---

## Solution

Add a `connecting` state to the voice state machine. When the user taps the orb, show a spinner (shadcn spinner in a glass button) in the chat bar where VoiceBars normally appear. The spinner signals "getting ready." When the Deepgram WebSocket fires its `Open` event, transition to `listening` — start the MediaRecorder and show VoiceBars. All audio goes directly to Deepgram with zero buffering.

This solves both problems: the spinner gives honest UX feedback, and the delayed recorder start gives the audio pipeline time to warm up (200-500ms during WS handshake).

---

## Requirements

- [ ] New `connecting` PersonaState in voice-store FSM (`idle → connecting → listening`)
- [ ] `connecting → idle` transition supported (user cancels during connection)
- [ ] Voice provider sets `connecting` (not `listening`) when `startVoice()` is called
- [ ] Voice provider transitions to `listening` only when Deepgram WS `Open` event fires
- [ ] MediaRecorder starts only after WS `Open` (not before)
- [ ] Remove audio buffer mechanism entirely (audioBufferRef, wsOpenRef, flush logic, overflow check)
- [ ] Chat bar shows shadcn spinner in glass button during `connecting` state
- [ ] Chat bar shows VoiceBars during `listening` state (existing behavior)
- [ ] Stop button visible during both `connecting` and `listening` (user can cancel)
- [ ] PersonaOrb maps `connecting` to Rive `listening` animation (reuse, no Rive changes)

---

## Non-Requirements

- Not changing the Rive animation file (no new "connecting" animation in obsidian.riv)
- Not keeping the mic warm between recordings (Session 180 decided to release for TTS compatibility)
- Not adding a minimum spinner duration (show honest connection time, not fake delay)
- Not changing TTS behavior or the audio-engine singleton architecture
- Not fixing the 9 STT test failures from Session 180 (separate task)

---

## Architecture

### State Machine Change

```
BEFORE:  asleep → idle → listening → thinking → speaking → idle

AFTER:   asleep → idle → connecting → listening → thinking → speaking → idle
                           ↓
                          idle  (cancel)
```

Valid transitions added:
- `idle → connecting` (user taps orb)
- `connecting → listening` (WS open)
- `connecting → idle` (user cancels, error, or timeout)

### Flow Diagram

```
User taps orb
  │
  ▼
PersonaState = 'connecting'
Orb: listening animation
Chat bar: spinner in glass button + stop button
  │
  ├── parallel: fetchToken() + acquireMic() + getDeepgramSDK()
  ▼
  await all three
  │
  ▼
  client.listen.live() → WS handshake starts
  │                       (~200-500ms)
  ▼
  WS Open event fires
  │
  ▼
PersonaState = 'listening'
Chat bar: spinner → VoiceBars transition
MediaRecorder.start(100) → audio direct to Deepgram
  │
  ▼
  (user speaks, transcription flows)
  │
  ▼
User stops
  │
  ▼
PersonaState = 'idle'
Recorder stops, WS closes, mic released
```

### Component Changes

| File | Change |
|------|--------|
| `lib/stores/voice-store.ts` | Add `connecting` to PersonaState type and transition map |
| `components/voice/voice-provider.tsx` | Set `connecting` on start, `listening` on WS open callback |
| `components/voice/use-stt.ts` | Accept `onOpen` callback, delay recorder until called, remove buffer mechanism |
| `components/desktop/chat-bar.tsx` | Render spinner vs VoiceBars based on `connecting` vs `listening` |
| `components/voice/persona-orb.tsx` | Map `connecting` → `listening` in `toRiveState()` |

### use-stt.ts Refactored Flow

```typescript
startListening(onOpen?: () => void): Promise<void>
  1. Guard: if connectionRef or recorderRef set, bail
  2. Reset error, bump generation
  3. Parallel: token + mic + SDK
  4. Stale check
  5. connectAnalyser() (for VoiceBars, ready when needed)
  6. client.listen.live() — start WS
  7. connectionRef = connection
  8. Register WS Open handler:
     - Stale check + stream active check
     - recorder = new MediaRecorder(stream)
     - recorder.start(100)
     - recorder.ondataavailable → connection.send(e.data) (direct, no buffer)
     - recorderRef = recorder
     - setIsListening(true)
     - startKeepalive()
     - onOpen?.() ← voice-provider uses this to transition connecting → listening
  9. Register Transcript, Error, Close handlers (with generation guards)
```

Key difference: MediaRecorder creation and start moved INSIDE the WS Open handler. No buffer needed because audio only flows when the connection is already open.

### Chat Bar Visual

```
connecting state:
┌─────────────────────────────────────────────────────┐
│  [textarea]  [speaker] [stop] [⟳ spinner] [orb]    │
└─────────────────────────────────────────────────────┘

listening state:
┌─────────────────────────────────────────────────────┐
│  [textarea]  [speaker] [stop] [▮▮▮ bars ] [orb]    │
└─────────────────────────────────────────────────────┘
```

The spinner uses a shadcn spinner component wrapped in a `GlassIconButton` (matching existing chat bar button style). It occupies the same space as VoiceBars.

---

## Constraints

- Must use existing glass-button/glass-icon-button component for spinner container (consistency with chat bar)
- Must follow voice-store FSM pattern (validated transitions with console.warn on invalid)
- PersonaOrb Rive file (`obsidian.riv`) cannot be modified (no design tooling available)
- `releaseMic()` must still be called on stop (TTS compatibility — Session 180 decision)
- `connectAnalyser()` should still run during `connecting` (prepares AnalyserNode for instant VoiceBars when transitioning to `listening`)
- Token pre-fetch on mount must still work (line 55-61 in use-stt.ts)
- Generation guard pattern must be preserved for all async handlers

---

## Success Criteria

- [ ] Tapping the orb shows a spinner in the chat bar within 50ms
- [ ] Spinner transitions to VoiceBars when Deepgram connection is established
- [ ] First words are captured on 2nd+ recordings (no more word loss)
- [ ] User can cancel during connecting (tap stop or orb) and return to idle
- [ ] No audio buffer code remains in use-stt.ts (audioBufferRef, wsOpenRef removed)
- [ ] Existing voice-provider and chat-bar tests updated for new connecting state
- [ ] PersonaOrb shows listening animation during both connecting and listening states

---

## Open Questions

1. **Spinner animation choice** — Should we use the shadcn `Loader2` spinning icon, or a custom CSS ring animation? Likely Loader2 since it's already available.
2. **Error during connecting** — If token fetch or mic acquisition fails during `connecting`, should we show the error in place of the spinner, or transition to idle and show a toast? Currently errors set state on the hook — need to surface them in the connecting UI.

---

## Next Steps

1. `/plan` to create implementation tasks from this spec
2. Tasks should cover: voice-store FSM, use-stt refactor, voice-provider changes, chat-bar UI, persona-orb mapping, test updates
3. Consider grouping with the 9 STT test fixes from Session 180 (separate but related)
