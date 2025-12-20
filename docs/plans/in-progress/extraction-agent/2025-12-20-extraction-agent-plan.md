# Extraction Agent - Implementation Plan

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Design:** `2025-12-20-extraction-agent-design.md`
**Status:** Backend service working, frontend integration pending

---

## Current State

**Working:**
- `backend/app/services/agent_extractor.py` - Extraction with Claude Agent SDK
- `backend/app/routes/agent.py` - SSE streaming endpoints (to be deprecated)
- Session capture via `ResultMessage.session_id`
- Current routes: `/api/agent/extract`, `/api/agent/correct`, `/api/agent/health`
- Proposed routes: `/api/document/extract`, `/api/document/update`

**Agentic Tools (stubs ready):**
- `backend/app/agents/extraction_agent/tools/` - Tool stubs with proper naming convention
- Tools: `read_ocr`, `read_extraction`, `save_extraction`, `set_field`, `delete_field`, `complete`
- Implementation pending

---

## Remaining Tasks

### Phase 6: Backend Hardening

#### 6.1 Session Fallback Handling
- [ ] Detect expired/missing sessions in `/api/agent/correct`
- [ ] Fallback to stateless extraction using cached OCR + previous extraction as context
- [ ] Return appropriate error/fallback message to frontend

**Files:** `backend/app/routes/agent.py`, `backend/app/services/agent_extractor.py`

**Steps:**
1. Add try/catch around session resume in `correct_with_session()`
2. On session error, fetch previous extraction from DB
3. Create fallback prompt with previous extraction context
4. Run stateless extraction with context
5. Return result with `session_fallback: true` flag

#### 6.2 Integration Testing
- [ ] Test full flow: upload → OCR → extract → save → correct
- [ ] Test with various document types (invoice, receipt, contract)
- [ ] Verify session persistence works across multiple corrections
- [ ] Test error handling (OCR failure, extraction failure)

**Steps:**
1. Create test script `backend/tests/test_extraction_agent.py`
2. Use existing test documents or create sample PDFs
3. Test auto mode and custom mode
4. Test correction flow with session resume
5. Document any edge cases found

---

### Phase 7: Frontend Integration

#### 7.1 Create SSE Hook
- [ ] Create `useAgentExtraction` hook for SSE streaming
- [ ] Handle connection drops with reconnection
- [ ] Parse SSE events and update state

**File:** `frontend/src/hooks/useAgentExtraction.ts`

**Steps:**
1. Create hook with `fetch()` + `ReadableStream` (not EventSource - POST not supported)
2. State: `thinking`, `extraction`, `sessionId`, `isProcessing`, `error`
3. Parse SSE format: `data: {...}\n\n`
4. Handle `thinking`, `complete`, `error` event types
5. On connection drop, check document status via Supabase

#### 7.2 Processing View Component
- [ ] Create streaming thinking display
- [ ] Show status updates (OCR, Analyzing, Extracting)
- [ ] Display extraction results when complete
- [ ] Collapsible thinking panel

**File:** `frontend/src/components/ProcessingView.tsx`

**Steps:**
1. Use `useAgentExtraction` hook
2. Show status badge during processing
3. Stream thinking text with typing animation
4. Display extraction results in card/table format
5. Add collapse/expand for thinking panel

#### 7.3 Correction Input
- [ ] Add text input for natural language corrections
- [ ] Submit correction via `/api/agent/correct`
- [ ] Show streaming response for correction
- [ ] Update extraction display with changes

**File:** `frontend/src/components/CorrectionInput.tsx`

**Steps:**
1. Text input with submit button
2. Call `/api/agent/correct` with session_id + instruction
3. Show thinking while processing
4. Update extraction state with new result
5. Show diff/highlight of what changed (stretch goal)

#### 7.4 Connection Recovery
- [ ] Detect SSE connection drop
- [ ] Check document status via Supabase
- [ ] Subscribe to Realtime for updates if still processing
- [ ] Show appropriate message to user

**Steps:**
1. Wrap SSE stream in try/catch
2. On error, query document status from Supabase
3. If completed, fetch extraction
4. If processing, subscribe to Realtime channel
5. Show "Reconnecting..." message

---

## Verification

After each phase:
1. Run existing tests
2. Manual test via Swagger UI (backend)
3. Manual test in browser (frontend)
4. Check database state in Supabase

---

## Files Summary

**Backend (existing, may need updates):**
- `backend/app/services/agent_extractor.py`
- `backend/app/routes/agent.py`

**Frontend (new):**
- `frontend/src/hooks/useAgentExtraction.ts`
- `frontend/src/components/ProcessingView.tsx`
- `frontend/src/components/CorrectionInput.tsx`

**Tests (new):**
- `backend/tests/test_extraction_agent.py`

---

## Notes

- Session fallback is important for UX - users shouldn't see errors for expired sessions
- Frontend uses `fetch()` not `EventSource` because POST is needed
- Current endpoints (`/api/agent/*`) to be deprecated in favor of `/api/document/*`
- Agentic tool stubs are in place with proper naming convention - implementation is next step after frontend integration
