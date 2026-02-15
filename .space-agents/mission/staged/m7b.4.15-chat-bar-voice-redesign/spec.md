# Exploration: Chat Bar & Voice Interaction Redesign

**Date:** 2026-02-15
**Status:** Ready for planning

---

## Problem

The current voice interaction has a split input surface — the user speaks into the orb and their transcript appears in a floating pill above it, separate from the textarea where they'd normally type. This creates two competing input areas, means users can't edit STT mistakes before sending, and adds visual noise to the bottom of the canvas.

Additionally, a code audit of the voice system revealed several bugs: race conditions on rapid tap (orphaned mic streams), missing cleanup on WebSocket disconnect, TTS triggering on non-voice interactions, a 30-second Deepgram token TTL that silently kills long recordings, and zero keyboard accessibility.

---

## Solution

Unify the input surface: voice transcript flows directly into the textarea. Reposition the hover pill from above the orb to the left of the orb, inline with the chat bar. Simplify pill contents (remove mic toggle — the orb IS the mic). Add Escape key to stop recording. Fix the bugs found in the audit.

**New layout:**
```
[ + ]  [textarea / "Ask anything..."]  [🔊 speaker] [■ stop] [|||| bars]  [orb]
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       hover pill (left of orb), inline
```

**Recording-state pill (left to right):** speaker toggle, stop button, voice bars, then orb.

**Idle-state pill (hover only):** speaker toggle only.

---

## Requirements

### UX Redesign
- [ ] Voice transcript streams into the textarea (not a separate floating pill)
- [ ] Textarea is editable while recording — user can correct STT in real-time
- [ ] Hover pill renders to the LEFT of the orb (not above), inline with the bar
- [ ] Hover pill is hover-reveal (not always visible), positioned left of orb
- [ ] Idle pill contents: speaker toggle only (mic toggle removed entirely)
- [ ] Recording pill contents: speaker toggle + stop button + voice bars (in that order, left to right)
- [ ] Pill expands/contracts smoothly when transitioning between idle and recording states
- [ ] Orb tap during recording = send message immediately (fast path)
- [ ] Stop button = stop recording, keep text in textarea for editing (edit path)
- [ ] Escape key = stop recording, keep text in textarea (same as stop button)
- [ ] When sending during recording, flush any buffered/interim STT transcript before sending
- [ ] Remove the old floating transcript pill above the orb entirely

### Orb Flow (revised state machine)

| State | Textarea | Pill (left of orb) | Orb tap | Escape key |
|-------|----------|-------------------|---------|------------|
| Idle, no text | empty, placeholder | hover: `[🔊]` | start recording | — |
| Idle, has text | user's text | hover: `[🔊]` | send message | — |
| Recording, no text yet | empty / cursor | `[🔊] [■] [\|\|\|\|]` | go to idle (nothing to send) | stop recording |
| Recording, has text | live transcript | `[🔊] [■] [\|\|\|\|]` | send message + stop recording | stop recording, keep text |
| Thinking | clears | hover: `[🔊]` | — (no action) | — |
| Speaking (TTS) | — | hover: `[🔊]` | interrupt TTS | — |

### Bug Fixes
- [ ] **STT race condition**: Add cancellation token (AbortController or generation counter) to `startListening` so rapid start/stop doesn't orphan mic streams, Deepgram connections, or keepAlive intervals
- [ ] **Double-invocation guard**: Add `if (isListening) return` guard to `startListening` to prevent double mic/connection creation
- [ ] **WS disconnect cleanup**: When WebSocket disconnects and persona goes to `asleep`, also call `stopListening()` to release mic and Deepgram connection
- [ ] **Deepgram error/close cleanup**: Error handler should call `stopListening()` (not just set error state). Close handler should stop MediaRecorder and mic stream.
- [ ] **TTS only for voice interactions**: Add a `voiceSessionActive` flag (or similar) so TTS only triggers on agent responses to voice-initiated messages, not text-typed ones
- [ ] **Deepgram token TTL**: Increase from 30s to 120s (or implement token refresh mid-recording)
- [ ] **TTS error surface**: Add `error` state to `useTTS` hook so failures can be surfaced (currently all TTS errors silently disappear)
- [ ] **Deepgram token fetch timeout**: Add AbortController with timeout to the `/api/voice/deepgram-token` fetch so users aren't stuck indefinitely on "Listening..."
- [ ] **Test assertions**: Fix `persona-orb.test.tsx` lines 80 and 162 — `toRiveState('idle')` returns `'idle'` not `'thinking'`, `toRiveState('asleep')` returns `'idle'` not `'thinking'`
- [ ] **VoiceBars performance**: Throttle `setLevels()` to ~15fps instead of every animation frame (~60fps). Remove competing CSS `transition-[height]` when using rAF-driven updates.

---

## Non-Requirements

- Not adding responsive/mobile layout (hardcoded 500px bar stays for now)
- Not adding full ARIA/keyboard accessibility beyond Escape key (tracked separately)
- Not changing the Rive Persona animation variants or adding new states
- Not persisting `ttsEnabled` across page loads (intentional privacy-first default)
- Not adding interim/partial transcript display (only `is_final` results shown)
- Not changing the TTS voice, model, or streaming approach
- Not refactoring the overall component hierarchy (VoiceProvider, MaybeVoiceProvider stay as-is)

---

## Architecture

### Component Changes

**`persona-orb.tsx`** — Major refactor:
- Remove the floating pill above the orb (the `absolute bottom-full` positioned div)
- Remove mic toggle (`toggleMic`, `micEnabled` no longer needed in this component)
- Remove transcript display from the orb (moves to textarea)
- Add `onStopRecording` callback prop (called by stop button and Escape)
- Voice bars and stop button render in the new pill position

**`chat-bar.tsx`** — Major refactor:
- Accept live STT transcript and append it to the textarea value
- Handle Escape key (`onKeyDown`) to stop recording
- New pill component renders to the left of the orb, inside the action bar row
- Pill morphs between idle (speaker only) and recording (speaker + stop + bars) states

**`voice-provider.tsx`** — Bug fixes:
- New `stopRecordingOnly()` function: stops STT, keeps text, sets state to `idle` (for stop button / Escape)
- Existing `stopVoice()` updated: stops STT + sends message (for orb tap during recording)
- Add `voiceSessionActive` flag to discriminate voice vs text interactions for TTS trigger
- Disconnect handling: call `stopListening()` when WS disconnects

**`use-stt.ts`** — Bug fixes:
- Add generation counter or AbortController to `startListening` for cancellation
- Add `isListening` guard against double invocation
- Deepgram error handler: call full `stopListening()` cleanup
- Deepgram close handler: stop MediaRecorder + mic stream
- Token fetch: add timeout via AbortController

**`use-tts.ts`** — Bug fix:
- Add `error: string | null` to return type
- Surface TTS failures instead of silently swallowing them

**`voice-store.ts`** — Minor:
- Remove `micEnabled` and `toggleMic` (mic toggle removed from UI)
- Or keep for future use but remove from pill UI

**`voice-bars.tsx`** — Performance:
- Throttle `setLevels()` to ~15fps
- Remove CSS `transition-[height]` to avoid fighting rAF

### Data Flow (Recording)

```
1. User taps orb
2. voice-provider.startVoice() → voiceStore.setPersonaState('listening')
3. use-stt.startListening() → Deepgram connection opens, mic starts
4. Deepgram sends is_final transcripts → voiceStore.setTranscript(text)
5. chat-bar reads voiceStore.transcript → appends to textarea value
6. User sees text appearing in textarea as they speak

SEND PATH (orb tap):
7a. User taps orb → voice-provider.stopVoice()
8a. Flush any buffered transcript → send message via WS → clear textarea → state='thinking'

EDIT PATH (stop button or Escape):
7b. User clicks stop or presses Escape → voice-provider.stopRecordingOnly()
8b. Stop STT → state='idle' → text stays in textarea for editing
9b. User edits text → presses Enter or taps orb → sends normally
```

### Pill Layout (inline, left of orb)

```
Action bar row in chat-bar.tsx:
┌─────────────────────────────────────────────────────────────┐
│ [+]  [textarea]                    [pill: 🔊 ■ ||||] [orb] │
└─────────────────────────────────────────────────────────────┘

Pill is a GlassPill, hover-reveal, positioned in the flex row
to the left of the orb spacer/container.
```

---

## Constraints

- Pill must remain outside `overflow-hidden` on the glass bar (or the bar's overflow must be adjusted)
- Voice bars require `AnalyserNode` from STT layer — must be passed through to the pill's new position
- `GlassPill` primitive reused for the new pill (same glass styling)
- Rive Persona component unchanged — only accepts `idle`, `listening`, `thinking`, `speaking`, `asleep`
- WebSocket protocol unchanged — still sends `{ type: 'mission', payload: { text } }`
- Deepgram `is_final` only (no interim results) — transcript appears in chunks, not character-by-character
- Must not break embedded ChatBar mode (inside ChatPanel) — pill behavior should work in both standalone and embedded

---

## Success Criteria

- [ ] Voice transcript appears in the textarea as the user speaks
- [ ] User can edit transcript in textarea while still recording
- [ ] Tapping orb during recording sends the message immediately
- [ ] Stop button and Escape key stop recording but keep text for editing
- [ ] No floating pill above the orb — pill is to the left, inline
- [ ] Pill shows speaker toggle on hover (idle), speaker + stop + bars when recording
- [ ] Rapid double-tap on orb does not orphan mic streams or Deepgram connections
- [ ] WebSocket disconnect releases mic and Deepgram resources
- [ ] TTS only triggers for voice-initiated interactions (not text-typed)
- [ ] Recordings longer than 30 seconds work (token TTL increased or refreshed)
- [ ] All existing voice tests updated and passing
- [ ] `persona-orb.test.tsx` assertions corrected

---

## Open Questions

1. **Textarea cursor position during STT** — Should new transcript text always append at the end, or insert at cursor position? Appending at end is simpler and avoids cursor-jumping issues. *Recommendation: append at end.*
2. **Long transcript overflow** — Textarea auto-expands with the grid-rows animation. Should there be a max height before it scrolls? The current textarea has no max-height. *Recommendation: keep current behavior, revisit if it becomes a problem.*
3. **`micEnabled` store field** — Remove entirely from voice-store, or keep for potential future use (e.g., programmatic mute)? *Recommendation: keep in store, just remove from UI.*

---

## Next Steps

1. `/plan` to create implementation tasks from this spec
2. Tasks should be sequenced: bug fixes first (STT race condition, cleanup), then UX redesign (pill reposition, transcript-in-textarea)
3. Test updates alongside each change
