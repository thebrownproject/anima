# Feature: Chat Bar & Voice Interaction Redesign

**Goal:** Unify voice input into the textarea, reposition the pill inline left of the orb, and fix all voice system bugs found in audit.

## Overview

The current voice interaction splits input across two surfaces — a floating pill above the orb for STT transcript, and the textarea for typed text. This redesign merges them: transcript flows into the textarea, the pill moves inline to the left of the orb (showing speaker/stop/bars), and several voice system bugs are fixed.

**Spec:** `.space-agents/exploration/ideas/2026-02-15-chat-bar-voice-redesign/spec.md`

---

## Tasks

### Task A: Fix STT bugs (race condition, guards, error handlers, token TTL)

**Goal:** Eliminate orphaned mic streams, Deepgram connections, and keepAlive intervals caused by rapid start/stop, error events, and close events. Increase token TTL for longer recordings.

**Files:**
- Modify: `frontend/components/voice/use-stt.ts`
- Modify: `frontend/app/api/voice/deepgram-token/route.ts`
- Modify: `frontend/components/voice/__tests__/use-stt.test.ts`

**Depends on:** None

**Steps:**

1. **Generation counter for startListening.** Add a `generationRef = useRef(0)` to `useDeepgramSTT`. Increment at the top of `startListening`. Capture `const thisGen = generationRef.current` at the start. Before every async continuation point (after token fetch, after getUserMedia, after Deepgram connection opens), check `if (generationRef.current !== thisGen) { /* clean up partial resources and return */ }`. This ensures a stale invocation can't overwrite refs that a newer invocation or a `stopListening` call has already cleared.

2. **Double-invocation guard.** At the very top of `startListening`, add: `if (connectionRef.current || recorderRef.current) return` — prevents a second call from creating duplicate resources. The generation counter handles the harder race (start → stop → start), this guard handles the simple case (double-click).

3. **Token fetch timeout.** Wrap the `/api/voice/deepgram-token` fetch in an AbortController with a 10-second timeout:
   ```typescript
   const fetchCtrl = new AbortController()
   const fetchTimeout = setTimeout(() => fetchCtrl.abort(), 10_000)
   try {
     const res = await fetch('/api/voice/deepgram-token', { signal: fetchCtrl.signal })
     clearTimeout(fetchTimeout)
     // ...
   } catch (err) {
     clearTimeout(fetchTimeout)
     if (err instanceof DOMException && err.name === 'AbortError') {
       setError('Voice connection timed out')
     } else {
       setError('Failed to get voice token')
     }
     return
   }
   ```

4. **Error handler cleanup.** Replace the Deepgram `LiveTranscriptionEvents.Error` handler (currently just `setError(...)`) with a full cleanup call:
   ```typescript
   connection.addListener(LiveTranscriptionEvents.Error, (err) => {
     console.error('[STT] Deepgram error:', err)
     setError('Voice transcription error')
     stopListening()
   })
   ```

5. **Close handler cleanup.** Replace the Deepgram `LiveTranscriptionEvents.Close` handler (currently just `setIsListening(false)`) with:
   ```typescript
   connection.addListener(LiveTranscriptionEvents.Close, () => {
     // Connection closed (token expired, network issue, etc.)
     // Clean up mic and recorder — stopListening is idempotent
     if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
     streamRef.current?.getTracks().forEach(t => t.stop())
     audioCtxRef.current?.close()
     recorderRef.current = null
     streamRef.current = null
     audioCtxRef.current = null
     setAnalyser(null)
     setIsListening(false)
   })
   ```
   Note: don't call `connectionRef.current?.requestClose()` here since the connection is already closed.

6. **Token TTL.** In `deepgram-token/route.ts` line 13, change `ttl_seconds: 30` to `ttl_seconds: 120`.

**Tests:**
- [ ] Calling startListening while already listening (connectionRef is set) returns immediately
- [ ] Rapid start/stop/start: first session's resources are cleaned up, second session works
- [ ] Token fetch timeout after 10s sets error state
- [ ] Deepgram error event triggers full stopListening cleanup
- [ ] Deepgram close event releases mic tracks and MediaRecorder
- [ ] Token TTL is 120s (update route test or add one)

---

### Task B: Fix TTS error surfacing

**Goal:** Add an `error` state to the TTS hook so failures are observable instead of silently swallowed.

**Files:**
- Modify: `frontend/components/voice/use-tts.ts`
- Modify: `frontend/components/voice/__tests__/use-tts.test.ts`

**Depends on:** None

**Steps:**

1. Add `const [error, setError] = useState<string | null>(null)` to `useTTS`.

2. At the start of `speak()`, add `setError(null)` to clear previous errors.

3. In the fetch response check (after `await fetch`), if `!response.ok`, set `setError('Speech generation failed')` and `setIsSpeaking(false)`, then return.

4. In the catch block (line ~156), change the non-AbortError path from just `setIsSpeaking(false)` to also `setError('Speech playback error')`.

5. Add `error` to the return object: `return { speak, interrupt, isSpeaking, error }`.

6. Update the `TTSControls` type/interface if one exists (or define inline).

**Tests:**
- [ ] `error` is initially null
- [ ] When fetch returns non-ok, `error` is set and `isSpeaking` is false
- [ ] `error` resets to null when `speak()` is called again
- [ ] Existing tests still pass with the new field

---

### Task C: Fix VoiceBars performance

**Goal:** Reduce React re-renders from ~60fps to ~15fps by throttling state updates while keeping smooth frequency sampling.

**Files:**
- Modify: `frontend/components/voice/voice-bars.tsx`
- Create: `frontend/components/voice/__tests__/voice-bars.test.tsx`

**Depends on:** None

**Steps:**

1. Add a `lastUpdateRef = useRef(0)` timestamp tracker.

2. In the `tick()` function, keep the `getByteFrequencyData` and smoothing logic at full rAF speed. But gate the `setLevels(raw)` call:
   ```typescript
   const now = performance.now()
   if (now - lastUpdateRef.current >= 66) { // ~15fps
     setLevels(raw)
     lastUpdateRef.current = now
   }
   ```

3. Remove `transition-[height] duration-75` from the bar div className (line 54). The rAF-driven smoothing already handles visual smoothness — CSS transitions at 75ms fight the 66ms update interval.

4. Create `voice-bars.test.tsx` with basic rendering tests:
   - Renders 4 bars when analyser is null (min-height state)
   - Renders with correct className (no transition-[height])
   - Calls requestAnimationFrame when analyser is provided

**Tests:**
- [ ] Renders 4 bar divs
- [ ] No `transition-[height]` class in output
- [ ] setLevels called at most ~15 times per second (mock rAF + performance.now)

---

### Task D: Fix persona-orb test assertions

**Goal:** Correct two wrong test expectations so the test suite reflects actual `toRiveState` behavior.

**Files:**
- Modify: `frontend/components/voice/__tests__/persona-orb.test.tsx`

**Depends on:** None

**Steps:**

1. Line ~80: Change `expect(screen.getByTestId('persona').getAttribute('data-state')).toBe('thinking')` to `.toBe('idle')`. Update the comment from "idle maps to thinking" to "idle passes through as idle".

2. Line ~162: Change the `asleep` state assertion from expecting `'thinking'` to expecting `'idle'`. Update the comment — `toRiveState('asleep')` returns `'idle'`, not `'thinking'`.

3. Run tests to verify all 10 pass.

**Note:** Task F will later rewrite most of these tests when the PersonaOrb is refactored. This task ensures the current tests are correct before that happens, which validates that `toRiveState` works as intended.

**Tests:**
- [ ] All 10 persona-orb tests pass
- [ ] Assertions match actual `toRiveState` behavior

---

### Task E: Add stopRecordingOnly, voiceSessionActive, and WS disconnect cleanup

**Goal:** Create the new voice-provider functions that Tasks F and G depend on. Gate TTS so it only fires for voice-initiated interactions.

**Files:**
- Modify: `frontend/components/voice/voice-provider.tsx`
- Modify: `frontend/components/voice/__tests__/voice-provider.test.tsx`

**Depends on:** None (but gates F and G)

**Steps:**

1. **Add `voiceSessionActive` ref.** In `VoiceProvider`, add `const voiceSessionRef = useRef(false)`. Set `true` at the start of `startVoice()`. Set `false` at the end of `stopVoice()` (after sending or going idle). Set `false` at the end of the new `stopRecordingOnly()` too.

2. **Create `stopRecordingOnly()`.** This is the "edit path" — stops STT but keeps text for editing:
   ```typescript
   const stopRecordingOnly = useCallback(() => {
     stopListening()
     voiceSessionRef.current = false
     useVoiceStore.getState().setPersonaState('idle')
     // NOTE: Do NOT clear transcript here — ChatBar reads it for textarea value
     // NOTE: Do NOT send message — user will edit and send manually
   }, [stopListening])
   ```
   Key difference from `stopVoice()`: no `addMessage`, no `send`, no `clearTranscript`, no `setPersonaState('thinking')`. Just stops STT and goes to idle.

3. **Gate TTS trigger.** In the `isAgentStreaming` effect (the `true → false` edge), wrap the `speak()` call:
   ```typescript
   if (ttsEnabled && voiceSessionRef.current) {
     // Only speak if this was a voice-initiated interaction
     const last = messages[messages.length - 1]
     if (last?.role === 'agent' && last.content) {
       setPersonaState('speaking')
       speak(last.content)
     }
   }
   ```
   This prevents TTS from firing when the user sends a text message with TTS enabled.

4. **WS disconnect cleanup.** In the `status !== 'connected'` effect, add `stopListening()` before setting `asleep`:
   ```typescript
   useEffect(() => {
     if (status !== 'connected') {
       stopListening() // Release mic + Deepgram connection
       voiceSessionRef.current = false
       useVoiceStore.getState().setPersonaState('asleep')
     }
   }, [status, stopListening])
   ```

5. **Update context interface.** Add `stopRecordingOnly` to `VoiceContextValue` and the context provider value object.

**Tests:**
- [ ] `stopRecordingOnly()` calls stopListening, sets persona to idle, does NOT send message
- [ ] `stopRecordingOnly()` does NOT clear voiceStore.transcript
- [ ] TTS does NOT trigger when agent responds to a text-typed message (voiceSessionRef is false)
- [ ] TTS DOES trigger when agent responds to a voice-initiated message (voiceSessionRef is true)
- [ ] WS disconnect calls stopListening to release mic
- [ ] voiceSessionRef is false after stopVoice completes
- [ ] voiceSessionRef is false after stopRecordingOnly completes

---

### Task F: Strip floating pill from PersonaOrb

**Goal:** Simplify PersonaOrb to orb-only. Remove all pill UI, hover timer, transcript display, mic toggle, and VoiceBars. Update tap handler for new interaction model.

**Files:**
- Modify: `frontend/components/voice/persona-orb.tsx`
- Modify: `frontend/components/voice/__tests__/persona-orb.test.tsx`

**Depends on:** Task E (needs `stopRecordingOnly` in voice context)

**Steps:**

1. **Remove imports:** `GlassPill`, `GlassIconButton`, `GlassTooltip/Trigger/Content`, `VoiceBars`, `Icons`. Keep: `useVoiceStore`, `useVoice`, `Persona` (dynamic), `cn`.

2. **Remove state/refs:** `showPill`, `hoverTimer`, `micEnabled`, `toggleMic`, `transcript`, `ttsEnabled`, `toggleTts`. Keep: `personaState`, `riveReady`, `mountRive`.

3. **Remove hover handlers:** `handleMouseEnter`, `handleMouseLeave`, the hover delay constants. Remove `onMouseEnter`/`onMouseLeave` from the wrapper div.

4. **Remove the entire pill div** (lines 106-141) — the `absolute bottom-full` positioned div with conditional GlassPill rendering.

5. **Update tap handler** for new interaction model:
   ```typescript
   function handleTap(): void {
     const { stopRecordingOnly } = voice  // destructure new function

     // Send when text exists (typed or transcribed)
     if (hasText && onSendMessage) {
       if (personaState === 'listening') {
         // Recording + has text → send (which stops recording too)
         // stopVoice handles: stop STT + send message
       }
       onSendMessage()
       return
     }

     switch (personaState) {
       case 'idle':
         startVoice()
         break
       case 'listening':
         // No text → just stop recording (go back to idle)
         stopRecordingOnly()
         break
       case 'speaking':
         interruptTTS()
         break
     }
   }
   ```
   Key changes:
   - `listening + hasText` → call `onSendMessage()` (ChatBar's handleSend will call stopVoice)
   - `listening + no text` → call `stopRecordingOnly()` (stop mic, stay idle, no send)
   - `idle`, `speaking` → unchanged

6. **Simplify JSX.** The component becomes just:
   ```tsx
   <GlassTooltip open={hasText ? undefined : false}>
     <GlassTooltipTrigger asChild>
       <button onClick={handleTap} className={...}>
         {/* Placeholder + Rive animation — unchanged */}
       </button>
     </GlassTooltipTrigger>
     <GlassTooltipContent side="right">Send message</GlassTooltipContent>
   </GlassTooltip>
   ```
   Actually, check if GlassTooltip is still needed. It shows "Send message" when hasText is true. Keep it for that purpose. Remove the wrapping `<div>` with `onMouseEnter/Leave` if hover is no longer needed on the orb itself (hover is now on the pill in ChatBar).

7. **Rewrite tests.** Most existing tests check pill/transcript behavior that no longer exists. New tests:
   - Renders orb button (no pill elements in DOM)
   - Tap idle → startVoice
   - Tap listening + no text → stopRecordingOnly
   - Tap listening + hasText → onSendMessage
   - Tap speaking → interruptTTS
   - Tap thinking → no action
   - Asleep → pointer-events-none
   - Rive state mapping (keep the corrected assertions from Task D)

**Tests:**
- [ ] No GlassPill, VoiceBars, or transcript elements in rendered output
- [ ] Tap idle calls startVoice
- [ ] Tap listening with no text calls stopRecordingOnly
- [ ] Tap listening with text calls onSendMessage
- [ ] Tap speaking calls interruptTTS
- [ ] Asleep state has pointer-events-none

---

### Task G: Build inline pill in ChatBar + wire STT transcript to textarea

**Goal:** This is the core UX task. Build the new pill component inline to the left of the orb, wire voice transcript into the textarea, add Escape key and stop button handling.

**Files:**
- Modify: `frontend/components/desktop/chat-bar.tsx`
- Modify: `frontend/components/desktop/__tests__/chat-bar.test.tsx`

**Depends on:** Task E (stopRecordingOnly), Task F (old pill removed from PersonaOrb)

**Steps:**

#### Part 1: Wire STT transcript into textarea

1. **Subscribe to transcript.** In ChatBar, add:
   ```typescript
   const transcript = useVoiceStore((s) => s.transcript)
   const prevTranscriptRef = useRef('')
   ```

2. **Sync transcript deltas into inputValue.** Add a useEffect that appends new transcript text to the textarea's local state:
   ```typescript
   useEffect(() => {
     if (personaState !== 'listening') return
     const prev = prevTranscriptRef.current
     const curr = transcript
     if (curr.length > prev.length) {
       // New text from STT — append the delta to inputValue
       const delta = curr.slice(prev.length)
       setInputValue(v => v + delta)
     }
     prevTranscriptRef.current = curr
   }, [transcript, personaState])
   ```
   This approach:
   - Only appends during `listening` state
   - Preserves user edits (delta is appended, not replacing the full value)
   - Tracks previous transcript length to compute the delta
   - Does NOT clear inputValue when recording stops (text stays for editing)

3. **Auto-expand textarea during recording.** When recording starts and transcript begins flowing in, the textarea should be expanded. Add to the recording start path (or a useEffect watching personaState):
   ```typescript
   useEffect(() => {
     if (personaState === 'listening') {
       setInputActive(true)
       inputRef.current?.focus()
     }
   }, [personaState])
   ```

4. **Reset transcript tracking on stop.** When recording stops (personaState leaves `listening`), reset the transcript ref:
   ```typescript
   useEffect(() => {
     if (personaState !== 'listening') {
       prevTranscriptRef.current = ''
     }
   }, [personaState])
   ```

5. **Update onChange handler.** Currently (line 112-115), typing during recording calls `voice.stopVoice()`. Change to `voice.stopRecordingOnly()`:
   ```typescript
   onChange={(e) => {
     setInputValue(e.target.value)
     if (voice && personaState === 'listening') voice.stopRecordingOnly()
   }}
   ```
   This stops the mic but keeps the text for editing (instead of sending immediately on type).

6. **Update handleSend for recording state.** When sending during an active recording, stop STT first and flush transcript:
   ```typescript
   const handleSend = useCallback(() => {
     const text = inputValue.trim()
     if (!text) return

     // If recording, stop STT before sending
     if (personaState === 'listening') {
       voice?.stopRecordingOnly()
     }

     addMessage({ role: 'user', content: text, timestamp: Date.now() })
     send({ type: 'mission', payload: { text, context: { stack_id: activeStackId } } })
     setInputValue('')
     useVoiceStore.getState().clearTranscript()
     setInputActive(false)
     inputRef.current?.blur()
   }, [inputValue, personaState, voice, addMessage, send, activeStackId])
   ```

#### Part 2: Build inline pill

7. **Add pill state and hover logic.** Move the hover delay pattern from the removed PersonaOrb:
   ```typescript
   const [showPill, setShowPill] = useState(false)
   const pillHoverTimer = useRef<ReturnType<typeof setTimeout>>(null)
   const PILL_HOVER_DELAY = 400
   const PILL_HOVER_DELAY_TYPING = 800

   const handlePillMouseEnter = useCallback(() => {
     if (pillHoverTimer.current) clearTimeout(pillHoverTimer.current)
     const delay = inputActive ? PILL_HOVER_DELAY_TYPING : PILL_HOVER_DELAY
     pillHoverTimer.current = setTimeout(() => setShowPill(true), delay)
   }, [inputActive])

   const handlePillMouseLeave = useCallback(() => {
     if (pillHoverTimer.current) clearTimeout(pillHoverTimer.current)
     pillHoverTimer.current = setTimeout(() => setShowPill(false), PILL_HOVER_DELAY)
   }, [])
   ```

8. **Pill visibility logic.** Pill is always visible during recording, hover-reveal otherwise:
   ```typescript
   const isRecording = personaState === 'listening'
   const pillVisible = isRecording || showPill
   ```

9. **Render the pill in the action bar.** Insert between the center spacer and the orb spacer div. The pill is a `GlassPill` with conditional contents:
   ```tsx
   {/* Voice pill — left of orb */}
   {voiceActive && (
     <div
       onMouseEnter={handlePillMouseEnter}
       onMouseLeave={handlePillMouseLeave}
       className={cn(
         'mr-1 transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
         pillVisible
           ? 'scale-100 opacity-100'
           : 'scale-95 opacity-0 pointer-events-none',
       )}
     >
       <GlassPill className="h-10">
         {/* Speaker toggle — always present */}
         <GlassIconButton
           icon={ttsEnabled ? <Icons.Volume /> : <Icons.VolumeOff />}
           tooltip={ttsEnabled ? 'Mute speaker' : 'Unmute speaker'}
           tooltipSide="top"
           onClick={toggleTts}
           className="size-8"
         />
         {/* Stop button + Voice bars — only during recording */}
         {isRecording && (
           <>
             <GlassIconButton
               icon={<Icons.PlayerStop />}
               tooltip="Stop recording"
               tooltipSide="top"
               onClick={() => voice?.stopRecordingOnly()}
               className="size-8"
             />
             <VoiceBars analyser={voice?.analyser ?? null} className="mx-1" />
           </>
         )}
       </GlassPill>
     </div>
   )}
   ```
   Layout order left-to-right: `[🔊 speaker] [■ stop] [|||| bars]` then `[orb]`.

10. **Add imports.** ChatBar now needs: `GlassPill`, `VoiceBars`, `Icons.Volume`, `Icons.VolumeOff`, `Icons.PlayerStop` (or similar stop icon — check Tabler icons for `IconPlayerStop` or `IconSquare`).

#### Part 3: Escape key handling

11. **Update handleKeyDown.** Add Escape handling for stop-recording:
    ```typescript
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape' && personaState === 'listening') {
        e.preventDefault()
        voice?.stopRecordingOnly()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }
    ```

#### Part 4: Ensure no mic toggle in UI

12. **Verify.** The new pill only renders speaker toggle, stop button, and voice bars. No mic toggle anywhere. The `micEnabled`/`toggleMic` store fields are NOT imported or used in ChatBar. The `PersonaOrb` component (after Task F) also doesn't render a mic toggle.

**Tests:**
- [ ] Transcript text appears in textarea during recording (mock voiceStore.transcript changes)
- [ ] User can edit textarea while recording (onChange works, stopRecordingOnly called)
- [ ] Escape key during recording calls stopRecordingOnly
- [ ] Escape key when not recording does not call stopRecordingOnly
- [ ] Enter key sends message (unchanged behavior)
- [ ] Shift+Enter does not send (unchanged)
- [ ] Stop button click calls stopRecordingOnly
- [ ] Pill shows speaker toggle on hover when idle
- [ ] Pill shows speaker + stop + voice bars during recording
- [ ] Pill hidden when not hovered and not recording
- [ ] handleSend during recording stops STT first, then sends text
- [ ] No mic toggle button rendered anywhere
- [ ] Embedded mode renders correctly (no layout breaks at 400px)

---

### Task H: Integration smoke test

**Goal:** Run the full test suite, fix any remaining breakage, and verify success criteria from spec.

**Files:**
- All test files (run suite)
- Any files with remaining issues

**Depends on:** All previous tasks

**Steps:**

1. Run `npm run test:run` from `frontend/`. Fix any failing tests.
2. Run `npx tsc --noEmit` from `frontend/`. Fix any TypeScript errors.
3. Manual verification checklist:
   - [ ] Voice transcript appears in textarea as user speaks
   - [ ] User can edit transcript while still recording
   - [ ] Tapping orb during recording sends message immediately
   - [ ] Stop button stops recording, keeps text for editing
   - [ ] Escape key stops recording, keeps text for editing
   - [ ] No floating pill above the orb
   - [ ] Pill to the left of orb with speaker (idle) or speaker+stop+bars (recording)
   - [ ] Rapid double-tap does not orphan mic streams
   - [ ] WS disconnect releases mic resources
   - [ ] TTS only triggers for voice-initiated interactions
   - [ ] Recordings longer than 30 seconds work
   - [ ] Both standalone and embedded ChatBar modes work

**Tests:**
- [ ] All frontend tests pass (should be 74+)
- [ ] No TypeScript errors
- [ ] All manual checks pass

---

## Sequence

```
  Parallel group (independent bug fixes):
  ├── A. Fix STT bugs
  ├── B. Fix TTS error surfacing
  ├── C. Fix VoiceBars performance
  └── D. Fix persona-orb test assertions

  Sequential chain (UX redesign, critical path):
  E. VoiceProvider new functions (gates F+G)
    └── F. Strip PersonaOrb pill (depends on E)
        └── G. Build ChatBar inline pill + transcript wiring (depends on E+F)
            └── H. Integration smoke test (depends on all)
```

**Single-worker order:** A → B → C → D → E → F → G → H

**Parallel opportunity:** A, B, C, D, and E can all run simultaneously. The critical path is E → F → G → H (4 sequential steps).

---

## Success Criteria

- [ ] Voice transcript appears in the textarea as the user speaks
- [ ] User can edit transcript in textarea while still recording
- [ ] Tapping orb during recording sends the message immediately
- [ ] Stop button and Escape key stop recording but keep text for editing
- [ ] No floating pill above the orb — pill is inline to the left
- [ ] Pill shows speaker toggle on hover (idle), speaker + stop + bars when recording
- [ ] Rapid double-tap on orb does not orphan mic streams or Deepgram connections
- [ ] WebSocket disconnect releases mic and Deepgram resources
- [ ] TTS only triggers for voice-initiated interactions
- [ ] Recordings longer than 30 seconds work (token TTL increased)
- [ ] All frontend tests pass including updated assertions
- [ ] No mic toggle button appears anywhere in the UI
