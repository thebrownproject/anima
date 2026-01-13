# Phase 2.1: Auto-Trigger Metadata Generation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically trigger metadata generation after OCR completes, so documents get display_name/tags/summary without user action.

**Architecture:** Fire-and-forget pattern using FastAPI `BackgroundTasks` to spawn metadata generation after OCR succeeds. Failures are logged but don't affect the upload response.

**Tech Stack:** FastAPI BackgroundTasks, Claude Agent SDK (document_processor_agent)

---

## Context

Phase 2 created:
- `POST /api/document/metadata` endpoint for manual metadata generation
- `document_processor_agent` that reads OCR text and writes metadata to `documents` table

This phase adds automatic triggering so metadata appears via Supabase Realtime subscription without frontend action.

**Key Files:**
- `backend/app/routes/document.py` - Contains `upload_and_ocr()` and `retry_ocr()` endpoints
- `backend/app/agents/document_processor_agent/agent.py` - Contains `process_document_metadata()` async generator

---

## Task 1: Add BackgroundTasks Import and Create Helper Function

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py:12` (imports section)
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py` (add helper function after imports, before routes)

**Step 1: Add BackgroundTasks to the fastapi import**

Find this line (around line 12):

```python
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
```

Replace with:

```python
from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Form, HTTPException
```

**Step 2: Create the helper function**

Add this function after line 24 (after `logger = logging.getLogger(__name__)`) and before the first route (`@router.post("/document/upload")`):

```python
async def _run_metadata_background(
    document_id: str,
    user_id: str,
) -> None:
    """
    Run metadata generation in background (fire-and-forget).

    Consumes all events from the agent and logs completion/errors.
    Does not propagate exceptions - upload already succeeded.
    """
    try:
        supabase = get_supabase_client()
        async for event in process_document_metadata(
            document_id=document_id,
            user_id=user_id,
            db=supabase,
        ):
            # Log tool usage for debugging (optional, can remove if too noisy)
            if "tool" in event:
                logger.debug(f"Metadata tool: {event['tool']} for doc {document_id}")
            elif "complete" in event:
                logger.info(f"Metadata generation complete for document {document_id}")
            elif "error" in event:
                logger.error(f"Metadata generation failed for document {document_id}: {event['error']}")
    except Exception as e:
        # Log but don't propagate - upload already succeeded
        logger.error(f"Background metadata task failed for document {document_id}: {e}")
```

**Step 3: Verify file saves correctly**

Run: `python -m py_compile /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

Expected: No output (syntax OK)

---

## Task 2: Add Auto-Trigger to upload_and_ocr()

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py:28-31` (function signature)
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py:95-98` (success path)

**Step 1: Add BackgroundTasks parameter to function signature**

Find this function definition (around line 27-31):

```python
@router.post("/document/upload")
async def upload_and_ocr(
    file: UploadFile = File(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
```

Replace with:

```python
@router.post("/document/upload")
async def upload_and_ocr(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
```

**Step 2: Add background task after OCR success**

Find this block (around line 95-98):

```python
        # Increment usage counter
        await increment_usage(user_id)

        logger.info(f"OCR complete for document {document_id}")
```

Replace with:

```python
        # Increment usage counter
        await increment_usage(user_id)

        logger.info(f"OCR complete for document {document_id}")

        # Fire-and-forget: spawn metadata generation in background
        # Note: BackgroundTasks runs AFTER response returns, so upload latency unaffected.
        # Trade-off: No way to track completion from this request (client uses Realtime instead).
        background_tasks.add_task(_run_metadata_background, document_id, user_id)
```

**Step 3: Verify file compiles**

Run: `python -m py_compile /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

Expected: No output (syntax OK)

---

## Task 3: Add Auto-Trigger to retry_ocr()

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py:125-129` (function signature)
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py:180` (success path)

**Step 1: Add BackgroundTasks parameter to function signature**

Find this function definition (around line 125-129):

```python
@router.post("/document/retry-ocr")
async def retry_ocr(
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
```

Replace with:

```python
@router.post("/document/retry-ocr")
async def retry_ocr(
    background_tasks: BackgroundTasks,
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
```

**Step 2: Add background task after retry OCR success**

Find this block (around line 180):

```python
        logger.info(f"OCR retry complete for document {document_id}")

        return {
```

Replace with:

```python
        logger.info(f"OCR retry complete for document {document_id}")

        # Fire-and-forget: spawn metadata generation in background
        background_tasks.add_task(_run_metadata_background, document_id, user_id)

        return {
```

**Step 3: Verify file compiles**

Run: `python -m py_compile /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

Expected: No output (syntax OK)

---

## Task 4: Manual Test

**Step 1: Start the backend server**

```bash
cd /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend && uvicorn app.main:app --reload --port 8000
```

**Step 2: Upload a test document via Swagger**

1. Open http://localhost:8000/docs
2. Authenticate if needed (or set DEBUG=True in .env for testing)
3. Use `/api/document/upload` with a test PDF
4. Watch server logs for:
   - `OCR complete for document <uuid>`
   - `Metadata tool: read_ocr for doc <uuid>`
   - `Metadata tool: save_metadata for doc <uuid>`
   - `Metadata generation complete for document <uuid>`

**Step 3: Verify metadata in database**

Check `documents` table for the uploaded document. Should have:
- `display_name` - AI-generated name
- `tags` - Array of tags
- `summary` - 1-2 sentence description

**Step 4: Stop server**

Ctrl+C to stop uvicorn

---

## Task 5: Update Backend CLAUDE.md

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/CLAUDE.md`

**Step 1: Update the endpoints table**

Find the API Endpoints table:

```markdown
## API Endpoints

| Route File | Endpoints |
|------------|-----------|
| `document.py` | `/api/document/upload`, `/api/document/retry-ocr` |
```

Replace with:

```markdown
## API Endpoints

| Route File | Endpoints |
|------------|-----------|
| `document.py` | `/api/document/upload`, `/api/document/retry-ocr`, `/api/document/metadata` |
```

**Step 2: Add Document Processing Flow section**

Add this section after the API Endpoints table:

```markdown
## Document Processing Flow

```
Upload → OCR (sync) → Return response
                  ↘
                   Metadata generation (fire-and-forget background task)
```

1. `upload_and_ocr()` runs OCR synchronously and returns immediately
2. On success, schedules `BackgroundTasks.add_task()` for metadata generation (runs after response)
3. Metadata agent reads OCR, writes `display_name`, `tags`, `summary` to `documents` table
4. Frontend receives updates via Supabase Realtime subscription
5. Manual "Regenerate" available via `POST /api/document/metadata`
```

---

## Task 6: Update Routes CLAUDE.md

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/CLAUDE.md`

**Step 1: Update endpoint description**

Find this line in the Endpoints table:

```markdown
| `/api/document/upload` | POST | JWT | Upload file, run OCR, save to `ocr_results` |
```

Replace with:

```markdown
| `/api/document/upload` | POST | JWT | Upload file, run OCR, auto-trigger metadata generation |
```

**Step 2: Add Background Tasks pattern**

Find the "Key Patterns" section and add this bullet after "Usage Limits":

```markdown
- **Background Tasks**: After OCR success, metadata generation spawns via FastAPI `BackgroundTasks.add_task()` (fire-and-forget pattern). Runs after response returns; failures are logged but don't affect upload response.
```

---

## Task 7: Commit

**Step 1: Stage and commit**

```bash
cd /Users/fraserbrown/stackdocs/.worktrees/documents-redesign && git add backend/app/routes/document.py backend/CLAUDE.md backend/app/routes/CLAUDE.md && git commit -m "$(cat <<'EOF'
feat(backend): auto-trigger metadata generation after OCR

- Add _run_metadata_background() helper function
- Add BackgroundTasks parameter to upload_and_ocr() and retry_ocr()
- Schedule metadata task via background_tasks.add_task() after OCR success
- Fire-and-forget pattern: runs after response, failures logged but don't fail upload
- Update CLAUDE.md docs with new flow
EOF
)"
```

---

## Summary

After completing all tasks, the flow will be:

1. User uploads document
2. OCR runs synchronously (existing behavior)
3. Response returns to frontend (existing behavior)
4. **NEW:** BackgroundTasks schedules metadata generation (runs after response)
5. **NEW:** Metadata appears in database via agent tools
6. Frontend sees updates via Realtime subscription (existing subscription)
7. Manual "Regenerate" still works via `/api/document/metadata` (existing endpoint)

**Files Modified:**
- `backend/app/routes/document.py` - Added BackgroundTasks parameter + helper + 2 add_task() calls
- `backend/CLAUDE.md` - Added processing flow documentation
- `backend/app/routes/CLAUDE.md` - Updated endpoint description + pattern

---

## Future Exploration: Full Background Chain Architecture

> **Note:** Explore this in a future session before implementing Phase 2.1.

### Current Architecture (Phase 2.1)
```
Upload + OCR (synchronous, user waits 3-5s) → Metadata (background)
```

### Proposed Architecture (Better Long-Term)
```
Upload (instant return) → OCR (background) → Metadata (background)
```

### Questions to Resolve

1. **Can we still stream SSE events to frontend with background tasks?**
   - Current `/api/document/metadata` returns SSE stream
   - If OCR + Metadata both run in background, how does frontend see progress?
   - Options: Realtime subscription only? Separate SSE endpoint? Polling?

2. **Status flow changes:**
   - Current: `processing` → `ocr_complete` → (metadata runs) → stays `ocr_complete`
   - New: `uploading` → `processing` (OCR) → `ocr_complete` → `generating_metadata` → `completed`?

3. **Error handling:**
   - What if OCR fails? User already got success response
   - What if metadata fails? Same issue
   - Need clear error states and retry mechanisms

4. **Chaining mechanism:**
   - How does OCR completion trigger metadata?
   - Option A: OCR background task spawns metadata task at end
   - Option B: Database trigger / Supabase function
   - Option C: Frontend watches for `ocr_complete`, calls metadata endpoint

5. **Tradeoffs:**
   | Aspect | Sync OCR (Current) | Background Chain |
   |--------|-------------------|------------------|
   | Response time | Slow (3-5s) | Instant |
   | Complexity | Simple | More complex |
   | Error visibility | Immediate | Delayed (via status) |
   | SSE streaming | Works naturally | Needs alternative |
   | User experience | Waits, sees result | Instant, watches progress |

### Decision Needed

Before implementing Phase 2.1, decide:
- **Keep sync OCR** (simpler, Phase 2.1 as planned) OR
- **Refactor to full chain** (better UX, more work, need to solve SSE question)
