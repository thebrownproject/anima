## Claude Agent SDK Migration (Planned)

**Status**: Planning
**Goal**: Migrate from Anthropic Python SDK to Claude Agent SDK for agentic extraction with session persistence.

### Why This Migration

| Current (Anthropic SDK)      | Target (Agent SDK)               |
| ---------------------------- | -------------------------------- |
| Single API call, no memory   | Session-based with memory        |
| Manual streaming handling    | Built-in streaming               |
| No conversation context      | Full conversation resume         |
| User correction = fresh call | User correction = resume session |

### What We Gain

1. **Session Persistence**: Each extraction creates a session. User corrections resume that session - Claude remembers what it extracted.
2. **Agentic Behavior**: Claude thinks through the document, explains its reasoning, then extracts. Like Claude Code.
3. **Built-in Streaming**: Text thinking streams automatically, no manual delta handling.
4. **Fork Sessions**: Can branch off to try different extraction approaches without losing original.

### Prerequisites

- [ ] Install Claude Code CLI globally: `npm install -g @anthropic-ai/claude-code`
- [ ] Install Agent SDK: `pip install claude-agent-sdk`
- [ ] Node.js 18+ available in backend environment
- [ ] Update `backend/requirements.txt`

### Database Changes

- [ ] Add `session_id` column to `documents` table

  ```sql
  ALTER TABLE documents ADD COLUMN session_id TEXT;
  CREATE INDEX idx_documents_session_id ON documents(session_id);
  ```

- [ ] Add `session_id` column to `extractions` table
  ```sql
  ALTER TABLE extractions ADD COLUMN session_id TEXT;
  ```

### Backend Changes

#### 1. New Dependencies (`requirements.txt`)

```diff
- anthropic>=0.40.0
+ claude-agent-sdk>=1.0.0
```

#### 2. Rewrite `extractor.py`

**Old (Anthropic SDK):**

```python
from anthropic import AsyncAnthropic
client = AsyncAnthropic()
response = await client.messages.create(...)
```

**New (Agent SDK):**

```python
from claude_agent_sdk import query, ClaudeAgentOptions, tool, create_sdk_mcp_server

# Define extraction tool
@tool("save_extracted_data", "Save structured extraction from document", {
    "extracted_fields": dict,
    "confidence_scores": dict
})
async def save_extraction(args: dict) -> dict:
    return {
        "content": [{"type": "text", "text": f"Saved extraction with {len(args['extracted_fields'])} fields"}]
    }

# Create tool server
extraction_server = create_sdk_mcp_server(
    name="extraction-tools",
    tools=[save_extraction]
)

async def extract_document_with_agent(ocr_text: str, mode: str, custom_fields: list[str] | None = None):
    """Run agentic extraction with session tracking."""

    prompt = build_extraction_prompt(ocr_text, mode, custom_fields)
    session_id = None
    thinking_chunks = []
    extraction_result = None

    options = ClaudeAgentOptions(
        model="claude-haiku-4-5-20250514",
        mcp_servers={"extraction": extraction_server},
        allowed_tools=["mcp__extraction__save_extracted_data"],
        system_prompt=EXTRACTION_SYSTEM_PROMPT,
        max_turns=3
    )

    async for message in query(prompt=prompt, options=options):
        # Capture session ID from init message
        if hasattr(message, 'subtype') and message.subtype == 'init':
            session_id = message.data.get('session_id')

        # Stream thinking text
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    thinking_chunks.append(block.text)
                    yield {"type": "thinking", "text": block.text}
                elif isinstance(block, ToolUseBlock):
                    if block.name == "mcp__extraction__save_extracted_data":
                        extraction_result = block.input

    yield {
        "type": "complete",
        "session_id": session_id,
        "extraction": extraction_result,
        "thinking": "".join(thinking_chunks)
    }


async def re_extract_with_session(session_id: str, instruction: str):
    """Resume session for user corrections."""

    async for message in query(
        prompt=instruction,
        options=ClaudeAgentOptions(
            resume=session_id,  # Claude remembers the document + previous extraction
            allowed_tools=["mcp__extraction__save_extracted_data"]
        )
    ):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    yield {"type": "thinking", "text": block.text}
                elif isinstance(block, ToolUseBlock):
                    yield {"type": "complete", "extraction": block.input}
```

#### 3. Update `process.py` Endpoints

**New Streaming Endpoint:**

```python
from fastapi.responses import StreamingResponse

@router.post("/process/stream")
async def process_document_stream(
    file: UploadFile = File(...),
    mode: str = Form(...),
    user_id: str = Form(...),
    custom_fields: str | None = Form(None),
):
    """Process document with streaming agent output."""

    # Upload and OCR (same as before)
    upload_result = await upload_document(user_id, file)
    signed_url = await create_signed_url(upload_result["file_path"])
    ocr_result = await extract_text_ocr(signed_url)

    # Save OCR to cache
    await save_ocr_result(upload_result["document_id"], ocr_result)

    async def event_generator():
        yield f"data: {json.dumps({'type': 'status', 'message': 'Analyzing document...'})}\n\n"

        session_id = None

        async for event in extract_document_with_agent(
            ocr_text=ocr_result["text"],
            mode=mode,
            custom_fields=parse_custom_fields(custom_fields)
        ):
            if event["type"] == "thinking":
                yield f"data: {json.dumps(event)}\n\n"
            elif event["type"] == "complete":
                session_id = event["session_id"]

                # Save extraction + session_id to database
                await save_extraction(
                    document_id=upload_result["document_id"],
                    user_id=user_id,
                    extraction=event["extraction"],
                    session_id=session_id
                )

                # Update document with session_id
                await update_document_session(
                    document_id=upload_result["document_id"],
                    session_id=session_id,
                    status="completed"
                )

                yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


@router.post("/re-extract/stream")
async def re_extract_stream(
    document_id: str = Form(...),
    user_id: str = Form(...),
    instruction: str = Form(...),  # e.g., "Change vendor to Acme Corp"
):
    """Re-extract with session resume - Claude remembers previous extraction."""

    # Get stored session_id
    doc = await get_document(document_id, user_id)
    if not doc.session_id:
        raise HTTPException(400, "No session found for this document")

    async def event_generator():
        async for event in re_extract_with_session(
            session_id=doc.session_id,
            instruction=instruction
        ):
            yield f"data: {json.dumps(event)}\n\n"

            if event["type"] == "complete":
                # Save new extraction (session_id stays the same)
                await save_extraction(
                    document_id=document_id,
                    user_id=user_id,
                    extraction=event["extraction"],
                    session_id=doc.session_id
                )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
```

### Frontend Changes

Update `useDocumentProcessing` hook to use new streaming endpoints:

```typescript
// hooks/useDocumentProcessing.ts
const processDocument = async (
  file: File,
  mode: string,
  customFields?: string[]
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  formData.append("user_id", userId);
  if (customFields) formData.append("custom_fields", customFields.join(","));

  const response = await fetch(`${API_URL}/api/process/stream`, {
    method: "POST",
    body: formData,
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      const data = JSON.parse(line.slice(6));

      switch (data.type) {
        case "thinking":
          setThinking((prev) => prev + data.text); // Stream Claude's reasoning
          break;
        case "complete":
          setExtraction(data.extraction);
          setSessionId(data.session_id); // Store for re-extraction
          setIsProcessing(false);
          break;
      }
    }
  }
};

const correctExtraction = async (instruction: string) => {
  // Resume the same session - Claude remembers everything
  const response = await fetch(`${API_URL}/api/re-extract/stream`, {
    method: "POST",
    body: new URLSearchParams({
      document_id: documentId,
      user_id: userId,
      instruction, // e.g., "Fix the vendor name to Acme Corporation"
    }),
  });
  // ... same streaming logic
};
```

### Migration Steps

1. **Phase 1: Setup** (Day 1)

   - [ ] Install Claude Code CLI and Agent SDK
   - [ ] Verify Node.js available in backend environment
   - [ ] Run database migrations for session_id columns

2. **Phase 2: Core Rewrite** (Day 2-3)

   - [ ] Rewrite `extractor.py` with Agent SDK
   - [ ] Create extraction tool with @tool decorator
   - [ ] Test session creation and resume locally

3. **Phase 3: Endpoints** (Day 3-4)

   - [ ] Update `/api/process` to streaming endpoint
   - [ ] Create `/api/re-extract/stream` endpoint
   - [ ] Test full flow: upload → extract → correct → re-extract

4. **Phase 4: Frontend** (Day 4-5)

   - [ ] Update hooks to use streaming endpoints
   - [ ] Display Claude's thinking in real-time
   - [ ] Add correction chat input
   - [ ] Store session_id in component state

5. **Phase 5: Testing** (Day 5)
   - [ ] Test session persistence across page reloads
   - [ ] Test multiple corrections on same document
   - [ ] Test session timeout/expiry behavior
   - [ ] Load test with concurrent extractions

### Rollback Plan

Keep old `extractor.py` as `extractor_legacy.py`. If Agent SDK has issues:

1. Revert imports in `process.py`
2. Re-add anthropic to requirements
3. Use legacy extractor

### Session Management Considerations

- **Session storage**: Sessions stored by Claude Agent SDK (likely in `~/.claude/projects/`)
- **Session expiry**: Check SDK docs for retention period (30 days per search results)
- **Cleanup**: May need periodic cleanup of old sessions
- **Multi-tenant**: Ensure sessions are isolated per user (check SDK behavior)

### Success Criteria

- [ ] Claude explains its reasoning before extracting (visible in UI)
- [ ] User corrections resume previous session (Claude remembers document)
- [ ] No regression in extraction quality
- [ ] Processing time comparable or better
- [ ] Session persists across browser refresh

---
