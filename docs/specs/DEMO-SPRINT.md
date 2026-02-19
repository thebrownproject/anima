# Demo Sprint Plan — Saturday Startup Event
**Date:** 2026-02-18 (Wednesday night)
**Deadline:** Saturday morning
**Working days:** Thursday + Friday
**Goal:** Live 3-minute demo — drag file onto canvas → agent reads it → structured data card appears

---

## The Demo Flow

1. Open the app (no sign-in needed for demo)
2. Drag a PDF/invoice onto the desktop canvas
3. File appears as a **processing card** on the canvas immediately
4. Agent reads and extracts the document
5. A second **extraction card** appears — table of structured data (line items, totals, etc.)
6. User asks a follow-up question in the chat bar — agent answers
7. File tree panel shows the uploaded file

That's it. Three minutes. Non-technical. Impressive.

---

## Current State (as of 2026-02-18)

### What already works ✅
- WebSocket connection: browser ↔ Bridge ↔ Sprite
- Agent responds in chat (text, TTS, STT)
- `canvas_update` renders cards on the frontend (`ws-provider.tsx:102`)
- `create_card`, `update_card`, `close_card` tools on Sprite (`tools/canvas.py`)
- Block renderer: 8 types — heading, stat, key-value, table, badge, progress, text, separator
- `FileUploadMessage` protocol defined on all three layers
- `size` field (small/medium/large/full) already in protocol — card sizing is free
- Sprite gateway has `file_upload` route — currently a stub

### What needs building 🔨
| Area | Current state | Needs |
|------|--------------|-------|
| Chat bar + button | Renders but no onClick | Wire file input + send |
| Viewport drag-and-drop | No handlers | Add onDrop/onDragOver |
| Sprite upload handler | Stub (log + ack only) | Decode, save, trigger agent |
| OCR integration | Not implemented | Mistral OCR via Bridge proxy |
| Extraction agent | Not implemented | Agent → canvas table card |
| Documents panel | Hardcoded stub | Wire to actual uploaded files |

---

## Day 1 — Thursday: Upload Pipeline

### Task 1 — Frontend: File upload trigger
**Files:** `frontend/components/desktop/chat-bar.tsx`, `frontend/components/desktop/desktop-viewport.tsx`

**Chat bar + button** (`chat-bar.tsx`):
- The + button exists but is only visible when `voiceActive && hoverOnly`. Make it always visible in the input row.
- Add a hidden `<input type="file" accept=".pdf,.png,.jpg,.jpeg" />` ref
- Wire `onClick` → trigger file input click
- On file selected: validate size (≤25MB), read as base64, send `file_upload` message

**Drag-and-drop on viewport** (`desktop-viewport.tsx`):
- Add `onDragOver` (prevent default, show visual indicator)
- Add `onDrop` on the main viewport div
- Same logic: validate → base64 → `file_upload` message
- Check `id="desktop-canvas-bg"` to avoid conflicts with pan pointer handlers

**Shared upload logic** — extract into a hook `use-file-upload.ts`:
```typescript
// Returns a sendUpload(file: File) function
// Validates: type (PDF/PNG/JPG/JPEG), size (≤25MB)
// Reads as base64 via FileReader
// Calls send({ type: 'file_upload', payload: { filename, mime_type, data } })
// Returns boolean (false = not connected)
```

**WS send pattern** (from `ws-provider.tsx:223`):
```typescript
const { send } = useWebSocket()
send({ type: 'file_upload', payload: { filename, mime_type, data } })
// id + timestamp auto-appended by WebSocketManager
```

---

### Task 2 — Sprite: Receive file and create processing card
**File:** `sprite/src/gateway.py` → `_handle_file_upload()`

Replace the stub with:
```python
async def _handle_file_upload(self, msg: dict, req_id: str | None) -> None:
    payload = msg.get("payload", {})
    filename = payload.get("filename", "unknown")
    mime_type = payload.get("mime_type", "")
    data_b64 = payload.get("data", "")

    # 1. Decode + save
    doc_id = _new_id()
    upload_dir = Path("/workspace/uploads")
    upload_dir.mkdir(exist_ok=True)
    file_path = upload_dir / f"{doc_id}_{filename}"
    file_bytes = base64.b64decode(data_b64)
    file_path.write_bytes(file_bytes)

    # 2. Send processing card to canvas immediately
    await self._send_canvas_processing_card(doc_id, filename)

    # 3. ACK to browser
    await self._send_ack("file_upload_received", req_id)

    # 4. Trigger extraction in background (don't await)
    asyncio.create_task(
        self._run_extraction(doc_id, filename, mime_type, str(file_path))
    )
```

**Processing card** (sent immediately after save):
```python
# canvas_update: command=create_card, blocks=[heading, badge]
{
  "title": filename,
  "blocks": [
    { "type": "heading", "text": filename },
    { "type": "badge", "text": "Processing...", "variant": "default" }
  ],
  "size": "medium"
}
```

**Gotchas:**
- Import `base64`, `asyncio`, `pathlib.Path` at top of gateway.py
- Use `asyncio.create_task()` for extraction — do NOT await (blocks the event loop)
- `_new_id()` already exists in gateway.py

---

### Task 3 — Sprite: Add documents table to WorkspaceDB
**File:** `sprite/src/database.py`

Add `documents` table to `WorkspaceDB._create_tables()`:
```sql
CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT,
    file_path TEXT NOT NULL,
    card_id TEXT,          -- canvas card showing extraction
    status TEXT DEFAULT 'processing',
    created_at TEXT DEFAULT (datetime('now'))
)
```

Add methods:
- `create_document(doc_id, filename, mime_type, file_path, card_id?)` → dict
- `update_document_status(doc_id, status, card_id?)` → None
- `list_documents()` → list[dict]

---

## Day 2 — Friday: Extraction + File Tree

### Task 4 — Sprite: OCR + extraction agent
**File:** `sprite/src/gateway.py` → `_run_extraction()`

```python
async def _run_extraction(self, doc_id: str, filename: str, mime_type: str, file_path: str) -> None:
    try:
        # 1. OCR via Mistral (for PDFs/images) or Claude native PDF
        ocr_text = await self._run_ocr(file_path, mime_type)

        # 2. Cache OCR output
        ocr_dir = Path("/workspace/ocr")
        ocr_dir.mkdir(exist_ok=True)
        (ocr_dir / f"{doc_id}.md").write_text(ocr_text)

        # 3. Hand off to agent runtime with context
        context = f"A file was just uploaded: {filename}\n\nExtracted text:\n{ocr_text}\n\nPlease extract the key structured data and create a canvas card with a table showing the main fields."
        await self.runtime.handle_message(context, stack_id=self._active_stack_id)

    except Exception as e:
        logger.error("Extraction failed for %s: %s", filename, e)
        # Update processing card to show error
        await self._update_card_status(doc_id, "failed")
```

**OCR via Mistral** (through Bridge API proxy):
```python
async def _run_ocr(self, file_path: str, mime_type: str) -> str:
    # POST to Bridge API proxy at ANTHROPIC_BASE_URL (env var)
    # Mistral OCR endpoint: /v1/ocr
    # For MVP: use Claude's read_file tool directly if possible
    # Fallback: read text files directly
    ...
```

**Simpler MVP approach for demo:** Skip Mistral OCR for now — inject file path and let the agent use its Bash tool to read the file directly. The agent already has `bypassPermissions` + `cwd=/workspace`.

Revised context:
```python
context = (
    f"A file was just uploaded and saved to {file_path}.\n"
    f"Filename: {filename}\n"
    f"Please read the file, extract the key structured data, and create a canvas card "
    f"with a table showing the main fields (e.g. invoice number, date, line items, total)."
)
```

This lets the agent use its own Bash/Read tools — simpler than wiring Mistral for the demo.

---

### Task 5 — Frontend: Wire the documents panel
**File:** `frontend/components/desktop/documents-panel.tsx`

Replace hardcoded file tree with dynamic list. Approach: **track uploaded files in the WS provider** (ephemeral, simplest for demo).

In `ws-provider.tsx`, handle a new inbound message type `file_list` or track upload acks:
```typescript
// When file_upload_received ack comes back, add to a files store
// OR: on connect, Sprite sends current file list via state_sync
```

Simpler demo approach: add a `useFilesStore` (Zustand, ephemeral):
```typescript
interface FileEntry {
  docId: string
  filename: string
  status: 'processing' | 'complete' | 'failed'
  cardId?: string
}
```

When `send({ type: 'file_upload', ... })` returns true → optimistically add entry to store.

In documents panel: render actual `FileEntry[]` instead of hardcoded items.

---

### Task 6 — Polish (Friday afternoon, if time permits)

**Card size UI:**
Protocol already has `size: 'small' | 'medium' | 'large' | 'full'`. Add a size picker to `desktop-card.tsx` header (4 icons, clicking sends `canvas_interaction` with `action: 'resize'`). The Sprite gateway already handles this.

**Glass glow:** Apply `clip-path: inset(0)` to static glass elements (proven fix from Session 185) — chat bar, top bar, side panels. Skip for draggable cards (unsolved, deferred).

**Demo prep:**
- Pre-upload a clean invoice PDF to the Sprite before the event (avoids upload latency during demo)
- Prepare 2-3 follow-up questions to ask the agent after extraction
- Test on the demo machine + browser (Chrome)
- Have a backup: screen recording of a perfect run

---

## File Checklist

### Thursday
- [ ] `frontend/hooks/use-file-upload.ts` — new hook (validate + base64 + send)
- [ ] `frontend/components/desktop/chat-bar.tsx` — wire + button, always visible, file input
- [ ] `frontend/components/desktop/desktop-viewport.tsx` — onDrop + onDragOver
- [ ] `sprite/src/gateway.py` — implement `_handle_file_upload()` + `_send_canvas_processing_card()`
- [ ] `sprite/src/database.py` — add `documents` table + 3 methods
- [ ] Deploy sprite code via `/sprite-deploy`

### Friday
- [ ] `sprite/src/gateway.py` — implement `_run_extraction()` (agent reads file → canvas card)
- [ ] `frontend/lib/stores/files-store.ts` — new ephemeral store for file list
- [ ] `frontend/components/desktop/documents-panel.tsx` — wire to files store
- [ ] `frontend/components/desktop/ws-provider.tsx` — track file upload acks
- [ ] Demo run-through x2, fix any sharp edges

### Optional (time permitting)
- [ ] `frontend/components/desktop/desktop-card.tsx` — card size picker UI
- [ ] Static glass glow fix (`clip-path: inset(0)` on non-draggable elements)

---

## Key Gotchas

- **Chat bar + button** only visible when `voiceActive && hoverOnly` — decouple from voice state
- **onDrop on viewport** — don't prevent default on `pointerdown` (breaks pan); only handle drag events
- **base64 encoding** — use `FileReader.readAsDataURL()` and strip the `data:...;base64,` prefix before sending
- **25MB limit** — enforce on frontend before reading (saves time on large files)
- **`asyncio.create_task()`** for extraction — must NOT await in gateway handler (blocks event loop)
- **Agent context injection** — pass file path in the message, not the full file bytes (agent reads via Bash)
- **Sprite deploy** — after any Python changes, run `/sprite-deploy` to push updated code
- **Demo day** — use Chrome, have charger plugged in, disable notifications, test WiFi beforehand

---

## Demo Script (3 minutes)

**0:00 — Hook (20s)**
*"What if your business documents could talk to you? Not just search — actually understand what's in them and organise the data for you."*

**0:20 — Show the canvas (20s)**
Open the app. Show the clean glass desktop. *"This is your workspace. Everything lives here."*

**0:40 — Upload the document (30s)**
Drag an invoice PDF onto the canvas. Processing card appears immediately.
*"I just dropped an invoice. Watch what happens."*

**1:10 — Extraction card appears (30s)**
Extraction card appears with structured table — line items, totals, date, vendor.
*"The agent read it, understood it, and pulled out every field. No template, no training."*

**1:40 — Ask a question (40s)**
Type (or speak): *"What's the total GST on this invoice?"*
Agent responds in chat.
*"And now I can just ask questions about it. Natural language."*

**2:20 — The bigger picture (30s)**
*"Every document you throw at it — invoices, contracts, receipts — it learns your business. And it remembers. Next week, you can ask 'what did we spend on software last quarter' and it knows."*

**2:50 — Close (10s)**
*"It's in early access. If this sounds useful, I'd love to chat."*
