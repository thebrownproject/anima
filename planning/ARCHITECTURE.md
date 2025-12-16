# System Architecture

**Last Updated**: 2025-12-16
**Status**: Backend complete, Frontend not started

---

## Hybrid Architecture

StackDocs uses a hybrid architecture where the frontend connects directly to Supabase for data operations, while FastAPI handles only AI processing.

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
├─────────────────────────────────────────────────────────────┤
│  Supabase Client (Direct)     │    FastAPI (AI Only)        │
│  ─────────────────────────    │    ──────────────────       │
│  • Auth (login/signup)        │    • POST /api/process      │
│  • Read documents             │    • POST /api/re-extract   │
│  • Read extractions           │                             │
│  • Edit extractions           │                             │
│  • Realtime subscriptions     │                             │
└───────────────┬───────────────┴─────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐  ┌─────────────────────────┐
│      Supabase Platform        │  │   FastAPI Backend       │
│  • PostgreSQL (RLS enforced)  │  │  • Mistral OCR API      │
│  • Storage (documents)        │  │  • Anthropic SDK        │
│  • Auth (JWT tokens)          │  │  • Background tasks     │
│  • Realtime (status updates)  │  └─────────────────────────┘
└───────────────────────────────┘
```

**Why hybrid?**
- Only 2 FastAPI endpoints to maintain (vs 10+ in traditional architecture)
- Supabase Realtime for instant status updates (no polling)
- Direct Anthropic SDK = simpler code, fewer dependencies
- RLS policies enforce security at database level

---

## Data Flows

### Process Flow (Upload → OCR → Extract)

```
1. Frontend: POST /api/process (file + mode + user_id)
2. Backend:  Upload file to Supabase Storage
3. Backend:  Create document record (status='processing')
4. Backend:  Return document_id immediately
5. Background task:
   a. Mistral OCR → save to ocr_results (cached)
   b. Anthropic Claude → extract structured data
   c. Save extraction to extractions table
   d. Update document status='completed'
6. Frontend: Receives update via Supabase Realtime
```

### Re-extract Flow (Cached OCR → New Extraction)

```
1. Frontend: POST /api/re-extract (document_id + mode + fields)
2. Backend:  Fetch cached OCR from ocr_results (no API call)
3. Backend:  Run Claude extraction with new parameters
4. Backend:  Save new extraction record
5. Backend:  Return extraction result
```

**Key insight**: Re-extraction skips OCR entirely, saving ~$0.002 per document.

---

## API Surface

### FastAPI Endpoints (AI processing only)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/process` | POST | Upload + OCR + Extract (background) |
| `/api/re-extract` | POST | New extraction from cached OCR |

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

### Anthropic SDK (not LangChain)

**Choice**: Direct Anthropic SDK with tool use for structured output

**Why**:
- Simpler: No abstraction layer, easier debugging
- Guaranteed structure: Tool use forces JSON schema compliance
- Direct billing: No OpenRouter middleman
- Easier upgrades: Direct access to new Claude models

**Implementation**:
```python
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    tools=[EXTRACTION_TOOL],
    tool_choice={"type": "tool", "name": "save_extracted_data"},
    messages=[{"role": "user", "content": prompt}]
)
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

| Table | Purpose |
|-------|---------|
| `users` | User profile, usage limits, subscription tier |
| `documents` | Uploaded file metadata, processing status |
| `ocr_results` | Cached OCR text (for re-extraction) |
| `extractions` | Extracted fields, confidence scores, mode |

**Key relationships**:
- `users` 1:N `documents`
- `documents` 1:N `extractions` (history preserved)
- `documents` 1:1 `ocr_results` (cached)

See `planning/SCHEMA.md` for full table definitions.

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Quick reference for Claude Code |
| `planning/SCHEMA.md` | Database schema with SQL |
| `planning/PRD.md` | Product requirements |
| `planning/TASKS.md` | Task breakdown + migration history |
