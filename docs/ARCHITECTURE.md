# System Architecture

**Last Updated**: 2025-12-21
**Status**: Agent SDK integration in progress, Frontend planned

---

## Hybrid Architecture

StackDocs uses a hybrid architecture where the frontend connects directly to Supabase for data operations, while FastAPI handles AI agent operations via streaming.

```
┌─────────────────────────────────────────────────────────────┐
│              Next.js Frontend (www.stackdocs.io)            │
├─────────────────────────────────────────────────────────────┤
│  Supabase Client (Direct)     │    FastAPI (Agents Only)    │
│  ─────────────────────────    │    ──────────────────       │
│  • Auth (login/signup)        │    • POST /api/document/*   │
│  • Read documents             │    • POST /api/stack/*      │
│  • Read extractions           │                             │
│  • Edit extractions           │                             │
│  • Realtime subscriptions     │                             │
└───────────────┬───────────────┴─────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐  ┌─────────────────────────┐
│      Supabase Platform        │  │   FastAPI Backend       │
│  • PostgreSQL (RLS enforced)  │  │  (api.stackdocs.io)     │
│  • Storage (documents)        │  │  • Mistral OCR API      │
│  • Auth (JWT tokens)          │  │  • Claude Agent SDK     │
│  • Realtime (status updates)  │  │  • SSE streaming        │
└───────────────────────────────┘  └─────────────────────────┘
```

**Why hybrid?**
- FastAPI only handles agent triggers (upload, extract, update)
- Supabase Realtime for instant status updates (no polling)
- Claude Agent SDK = agentic workflow with session memory
- RLS policies enforce security at database level

---

## Data Flows

### Document Upload Flow

```
1. Frontend: POST /api/document/upload (file + user_id)
2. Backend:  Upload file to Supabase Storage
3. Backend:  Create document record (status='processing')
4. Backend:  Return document_id immediately
5. Background task:
   a. Mistral OCR → save to ocr_results (cached)
   b. Update document status='ready'
6. Frontend: Receives update via Supabase Realtime
```

### Document Extraction Flow (Agent-based, Streaming)

```
1. Frontend: POST /api/document/extract (document_id + user_id + mode)
2. Backend:  Fetch cached OCR from ocr_results
3. Backend:  Trigger extraction_agent with SSE streaming
4. Agent:    Reads OCR → extracts structured data → writes to extractions
5. Frontend: Receives real-time thinking via SSE stream
6. Backend:  Returns session_id for future corrections
```

### Document Update Flow (Session Resume)

```
1. Frontend: POST /api/document/update (document_id + instruction)
2. Backend:  Resume agent session (Claude remembers context)
3. Agent:    Reads instruction → updates extraction fields
4. Frontend: Receives updated extraction via SSE stream
```

### Stack Extraction Flow

```
1. Frontend: POST /api/stack/extract (stack_id + user_id)
2. Backend:  Trigger stack_agent with SSE streaming
3. Agent:
   a. Reads stack_documents to get document list
   b. Reads OCR for each document
   c. Creates/updates stack_tables schema
   d. Extracts rows to stack_table_rows
4. Frontend: Receives progress via SSE stream
```

**Key insight**: OCR is cached. Extraction and updates only cost Claude API, not Mistral OCR.

---

## API Surface

### FastAPI Endpoints (api.stackdocs.io)

Endpoints trigger agents with scoped context (user_id, document_id/stack_id).

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/document/upload` | POST | Upload file + run OCR (background) |
| `/api/document/extract` | POST | Trigger extraction_agent (SSE streaming) |
| `/api/document/update` | POST | Update extraction via session resume |
| `/api/stack/extract` | POST | Trigger stack_agent (SSE streaming) |
| `/api/stack/update` | POST | Update stack extraction via session |

### Frontend Direct Supabase Access

```typescript
// Documents list
supabase.from('documents').select('*').eq('user_id', userId)

// Document with extractions
supabase.from('documents').select('*, extractions(*)').eq('id', docId)

// Latest extraction (by created_at, no is_latest flag)
supabase.from('extractions')
  .select('*')
  .eq('document_id', docId)
  .order('created_at', { ascending: false })
  .limit(1)

// Edit extraction
supabase.from('extractions')
  .update({ extracted_fields: newFields })
  .eq('id', extractionId)

// Realtime subscription
supabase.channel('doc-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'documents',
    filter: `id=eq.${documentId}`
  }, callback)
  .subscribe()
```

---

## Key Design Decisions

### Mistral OCR Direct API

**Choice**: Mistral OCR (`mistral-ocr-latest`) via API

**Why**:
- Fast: 5-10s per document
- Accurate: 98.96% on scanned documents
- Cost-effective: ~$0.002 per page
- No infrastructure: Pure API, no GPU dependencies

**Trade-off**: API dependency, but mitigated by caching OCR results for re-extraction.

### Claude Agent SDK (not raw Anthropic SDK)

**Choice**: Claude Agent SDK for agentic extraction workflow

**Why**:
- Agentic: Agent autonomously reads, decides, and writes (like Claude Code)
- Session memory: Resume sessions for corrections without re-explaining context
- Custom tools: Agent uses database tools to read OCR and write extractions
- SSE streaming: Real-time thinking visible to users
- Built-in tool execution: No manual tool loop implementation

**Agentic Workflow**:
```
1. User gives task → "Extract data from this document"
2. Agent reads data → Uses tools to fetch OCR text, current state
3. Agent acts via tools → Tools perform real DB operations
4. Agent summarizes → Tells user what was accomplished
```

**Custom Database Tools** (not filesystem tools):
```python
# extraction_agent tools
read_ocr(document_id)         # Fetch from ocr_results
get_extraction(document_id)   # Read extractions JSONB
create_extraction(data)       # Write new extraction
set_field(path, value)        # Surgical JSONB update
delete_field(path)            # Remove from JSONB

# stack_agent tools (see CLAUDE.md for full list)
get_stack_documents(stack_id) # List documents in stack
get_tables(stack_id)          # Read table definitions
create_table(schema)          # Create new table
add_column(table_id, col)     # Add column to table
create_row(table_id, data)    # Insert to stack_table_rows
set_row_field(row_id, path, value)  # Surgical row update
```

**Session Resume**:
```python
# Initial extraction returns session_id
async for msg in query(prompt="Extract from document", options=...):
    session_id = msg.session_id

# Later correction resumes same session
async for msg in query(prompt="Fix vendor name", options=ClaudeAgentOptions(resume=session_id)):
    # Claude remembers original document and extraction
```

### Supabase Realtime (not polling)

**Choice**: Subscribe to document status changes via Supabase Realtime

**Why**:
- Instant: Updates arrive immediately when status changes
- Efficient: No wasted API calls checking status
- Built-in: Supabase handles reconnection, retries

**When polling made sense**: Early prototyping, but Realtime is cleaner for production.

### FastAPI BackgroundTasks (not Celery)

**Choice**: Use FastAPI's built-in BackgroundTasks

**Why**:
- Simple: No Redis/RabbitMQ infrastructure
- Good enough: Most extractions complete in <30s
- Easy migration: Can switch to Celery later if needed

**Limitations**: Tasks lost on restart, no distributed queue. Acceptable for MVP scale.

### JSONB for Extracted Fields

**Choice**: Store extraction results as JSONB, not relational tables

**Why**:
- Flexible: Every document type has different fields
- No migrations: New field types don't require schema changes
- Fast queries: PostgreSQL JSONB supports indexing

**Trade-off**: Less type safety, but acceptable for MVP. Can normalize later.

---

## Supabase Storage Configuration

**Bucket**: `documents` (private)

**Limits**:
- File size: 10 MB max
- MIME types: `application/pdf`, `image/png`, `image/jpeg`

**File path structure**:
```
documents/{user_id}/{document_id}_{filename}
```

**RLS Policies**:
- SELECT: Users can only view their own files
- INSERT: Users can only upload to their own folder
- DELETE: Users can only delete their own files

---

## Database Tables

**Core Tables:**

| Table | Purpose |
|-------|---------|
| `users` | User profile, usage limits, subscription tier |
| `documents` | Uploaded file metadata, processing status, session_id |
| `ocr_results` | Cached OCR text (for re-extraction) |
| `extractions` | Extracted JSONB fields, confidence scores, mode |

**Stacks Tables:**

| Table | Purpose |
|-------|---------|
| `stacks` | Stack metadata (collection of documents) |
| `stack_documents` | Junction table: documents ↔ stacks (many-to-many) |
| `stack_tables` | Table definitions within stacks (columns JSONB) |
| `stack_table_rows` | Extracted row data (row_data JSONB) |

**Key relationships**:
- `users` 1:N `documents`
- `documents` 1:N `extractions` (history preserved)
- `documents` 1:1 `ocr_results` (cached)
- `stacks` N:M `documents` (via `stack_documents`)
- `stacks` 1:N `stack_tables`
- `stack_tables` 1:N `stack_table_rows`

See `SCHEMA.md` for full table definitions.

---

## Frontend Stack

**Deployment**: `www.stackdocs.io` (Vercel)

**Technology**:
- Next.js 16 (App Router) + TypeScript + Tailwind
- shadcn/ui for components
- TanStack Table for data tables with dynamic columns

**Key Patterns**:
- SSE streaming for real-time agent thinking display
- Direct Supabase access for data reads/writes
- Dynamic column generation from extraction schema
- AI-first editing (corrections via natural language)

**Data Flow**:
```
Frontend (www.stackdocs.io)
    │
    ├── Direct to Supabase (reads, writes, realtime)
    │
    └── SSE to FastAPI (agent triggers)
            │
            └── api.stackdocs.io
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `SCHEMA.md` | Database schema with SQL |
| `PRD.md` | Product requirements |
| `ROADMAP.md` | Feature priorities |
| `plans/` | Feature plans (kanban structure) |
