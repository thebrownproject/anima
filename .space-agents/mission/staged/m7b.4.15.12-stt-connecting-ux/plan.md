# Feature: STT Connecting UX + Word-Loss Fix

**Goal:** Add a `connecting` state to the voice FSM so the UI shows a spinner during Deepgram WS setup, MediaRecorder only starts after WS opens (fixing word loss on 2nd+ recordings), and the audio buffer mechanism is removed entirely.

## Overview

When users tap the PersonaOrb, the system currently pretends to be listening before the Deepgram WebSocket is connected. On 2nd+ recordings, the lazy SDK import is cached (0ms), so the MediaRecorder starts immediately after `getUserMedia()` — before the audio pipeline's DSP (noiseSuppression, echoCancellation) has stabilized. This causes the first 1-3 chunks to contain silence/garbled audio, which Deepgram can't transcribe. The first recording works because the SDK load delay (~200-400ms) accidentally gives the audio pipeline time to warm up.

The fix: add a `connecting` PersonaState between `idle` and `listening`. Show a spinner during connection setup. Start the MediaRecorder only after the Deepgram WS `Open` event fires. This gives the audio pipeline time to warm up, eliminates the buffer mechanism, and gives honest UX feedback.

## Tasks

### Task: Add connecting state to voice-store FSM

**Goal:** Add `'connecting'` to the PersonaState union type and update VALID_TRANSITIONS to enforce `idle → connecting → listening` (removing direct `idle → listening`).
**Files:** Modify `lib/stores/voice-store.ts`, Modify `lib/stores/__tests__/voice-store.test.ts`
**Depends on:** None

**Steps:**
1. Write failing tests: connecting transitions (idle→connecting, connecting→listening, connecting→idle), idle→listening rejection, update allStates array
2. Add `'connecting'` to PersonaState type
3. Update VALID_TRANSITIONS: `idle: ['connecting', 'thinking']`, `connecting: ['listening', 'idle']`
4. Verify all tests pass

**Tests:**
- [ ] `idle → connecting` succeeds
- [ ] `connecting → listening` succeeds
- [ ] `connecting → idle` succeeds (cancel path)
- [ ] `idle → listening` is rejected (must go through connecting)
- [ ] `connecting → thinking` is rejected
- [ ] `connecting → asleep` succeeds (universal asleep bypass)
- [ ] All existing valid transitions still pass

### Task: Refactor use-stt — onOpen callback, remove buffer, delay MediaRecorder

**Goal:** Add optional `onOpen` callback to `startListening()`, move `recorder.start(100)` into the WS Open handler, remove the entire buffer mechanism (audioBufferRef, wsOpenRef, flush logic, overflow check). Audio goes directly to Deepgram with zero buffering.
**Files:** Modify `components/voice/use-stt.ts`, Modify `components/voice/__tests__/use-stt.test.ts`
**Depends on:** Add connecting state to voice-store FSM

**Steps:**
1. Write failing tests: MediaRecorder not started until WS Open, onOpen callback fires, direct send (no buffer), isListening only true after WS Open
2. Add `onOpen?: () => void` parameter to `startListening`
3. Remove `audioBufferRef` and `wsOpenRef` refs entirely
4. Construct MediaRecorder eagerly but move `.start(100)` into the WS Open handler
5. In Open handler: stale check, stream.active check, recorder.start(100), setIsListening(true), startKeepalive, onOpen?.()
6. Simplify ondataavailable to just `connection.send(e.data)` (no buffer check)
7. Remove buffer-related cleanup from stopListening (audioBufferRef.current = [], wsOpenRef.current = false)
8. Keep connectAnalyser() before WS connection (VoiceBars ready during connecting)
9. Keep token pre-fetch, generation guards, all error handling
10. Remove buffer overflow test, update existing tests that assumed isListening before WS Open

**Tests:**
- [ ] MediaRecorder is NOT started until Deepgram WS fires Open
- [ ] `onOpen` callback fires when Deepgram WS opens
- [ ] `ondataavailable` sends directly to `connection.send(e.data)` with no buffer logic
- [ ] `isListening` is set true only after WS Open fires
- [ ] `connectAnalyser()` still runs before WS connection
- [ ] `audioBufferRef` and `wsOpenRef` do not exist in the file
- [ ] Generation guards still prevent stale sessions
- [ ] stopListening still cleans up properly
- [ ] Empty data chunks (`e.data.size === 0`) still ignored

### Task: Update voice-provider — connecting state + onOpen callback

**Goal:** Wire `startVoice` to set `personaState('connecting')` on start and pass an `onOpen` callback to `startListening` that transitions to `'listening'`. Handle cancel during connecting.
**Files:** Modify `components/voice/voice-provider.tsx`, Modify `components/voice/__tests__/voice-provider.test.tsx`
**Depends on:** Refactor use-stt — onOpen callback, remove buffer, delay MediaRecorder

**Steps:**
1. Write failing tests: startVoice sets 'connecting', onOpen transitions to 'listening', stopRecordingOnly from connecting returns to idle
2. In `startVoice`: change `setPersonaState('listening')` to `setPersonaState('connecting')`
3. Pass onOpen callback to startListening: `startListening(() => useVoiceStore.getState().setPersonaState('listening'))`
4. Verify stopRecordingOnly works from both connecting and listening (connecting→idle is valid in new FSM)
5. Update existing tests that expect 'listening' immediately after startVoice

**Tests:**
- [ ] `startVoice()` sets personaState to `'connecting'` (not `'listening'`)
- [ ] After Deepgram WS opens (onOpen fires), personaState transitions to `'listening'`
- [ ] `stopRecordingOnly()` from `'connecting'` transitions to `'idle'`
- [ ] `stopRecordingForSend()` from `'connecting'` works correctly
- [ ] Full flow: `idle → connecting → listening → thinking → speaking → idle`

### Task: Update persona-orb — connecting state mapping

**Goal:** Map `'connecting'` to Rive `'listening'` animation, show 'Connecting...' tooltip, and allow tap-to-cancel during connecting.
**Files:** Modify `components/voice/persona-orb.tsx`, Modify `components/voice/__tests__/persona-orb.test.tsx`
**Depends on:** Add connecting state to voice-store FSM

**Steps:**
1. Write failing tests: toRiveState mapping, tooltip text, tap-to-cancel, no pointer-events-none
2. Add `if (state === 'connecting') return 'listening'` to `toRiveState()`
3. Add `case 'connecting': return 'Connecting...'` to `orbTooltip()`
4. Add `case 'connecting':` (fall through to `case 'listening':`) in `handleTap()` for tap-to-cancel
5. Verify orb is interactive (not pointer-events-none) during connecting

**Tests:**
- [ ] `toRiveState('connecting')` returns `'listening'`
- [ ] Tooltip shows 'Connecting...' during connecting
- [ ] Tap when connecting + no text calls `stopRecordingOnly` (cancel)
- [ ] Tap when connecting + hasText calls `onSendMessage`
- [ ] Orb is interactive during connecting (not disabled)

### Task: Update chat-bar — spinner, controls, and input wiring for connecting state

**Goal:** Show a loading spinner (Loader2 animate-spin) in place of VoiceBars during connecting. Voice controls visible during connecting. Textarea expands, Escape cancels, Send stops voice, transcript only appends during listening (not connecting), linger works on connecting→idle.
**Files:** Modify `components/desktop/chat-bar.tsx`, Modify `components/desktop/__tests__/chat-bar.test.tsx`
**Depends on:** Update voice-provider — connecting state + onOpen callback

**Steps:**
1. Write failing tests: spinner visible during connecting, VoiceBars during listening, stop button during connecting, Escape cancel, Send behavior, textarea expand, linger on cancel
2. Derive `isConnecting` from `personaState === 'connecting'`
3. Update `controlsVisible`: `isListening || isConnecting || showControls || lingerVisible`
4. Conditional render in VoiceBars slot: connecting → `<Icons.Loader2 className="size-5 animate-spin text-white/60" />` in same-size container; listening → VoiceBars
5. Stop button visible during both connecting and listening
6. Update handleSend to also stop voice during connecting: `if (voice && (isListening || isConnecting))`
7. Update Escape handler: `if (voice && (isListening || isConnecting)) voice.stopRecordingOnly()`
8. Update textarea expand effect to trigger on `isListening || isConnecting`
9. Keep transcript delta-append gated on `isListening` only (no audio during connecting)
10. Update caret-transparent class: `(isListening || isConnecting) && 'caret-transparent'`
11. Update typing-cancels-recording: `if (voice && (isListening || isConnecting)) voice.stopRecordingOnly()`
12. Add `data-testid="connecting-spinner"` to spinner element for test targeting

**Tests:**
- [ ] Spinner (Loader2 with animate-spin) visible during connecting
- [ ] VoiceBars shown during listening (not spinner)
- [ ] Stop button visible and clickable during connecting
- [ ] Voice controls expand during connecting
- [ ] Textarea expands during connecting
- [ ] Escape during connecting calls `stopRecordingOnly`
- [ ] Send during connecting stops voice + sends text
- [ ] Transcript delta-append only runs during listening (not connecting)
- [ ] Linger logic triggers on connecting→idle transition
- [ ] Caret hidden during connecting

## Sequence

1. **Task 1: voice-store FSM** (no dependencies — foundation)
2. **Task 2: use-stt refactor** (depends on Task 1)
3. **Task 3: voice-provider** (depends on Tasks 1 + 2)
4. **Task 4: persona-orb** (depends on Task 1 — can run after Task 1, parallel with Tasks 2-3)
5. **Task 5: chat-bar** (depends on Tasks 1 + 3 — must run after Task 3)

```
Task 1 → Task 2 → Task 3 → Task 5
Task 1 → Task 4 (parallel with 2-3)
```

Critical path: Task 1 → Task 2 → Task 3 → Task 5

## Success Criteria

- [ ] Tapping the orb shows a spinner in the chat bar within 50ms
- [ ] Spinner transitions to VoiceBars when Deepgram connection is established
- [ ] First words are captured on 2nd+ recordings (no more word loss)
- [ ] User can cancel during connecting (tap stop, tap orb, press Escape) and return to idle
- [ ] No audio buffer code remains in use-stt.ts (audioBufferRef, wsOpenRef removed)
- [ ] All voice-related tests pass (voice-store, use-stt, voice-provider, persona-orb, chat-bar)
- [ ] PersonaOrb shows listening animation during both connecting and listening states
