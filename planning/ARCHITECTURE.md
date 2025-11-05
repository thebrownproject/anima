# System Architecture

## Data Flow Diagram

### Full System
```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
│                                                              │
│  Next.js Frontend (Vercel)                                  │
│  • Upload documents                                          │
│  • View document library (grid)                              │
│  • Edit extraction results                                   │
│  • Download CSV/JSON                                         │
│  • Supabase Auth client                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS (REST API)
                         │ (Upload files, trigger extraction)
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Railway/Render)                │
│                                                              │
│  API Endpoints:                                              │
│  • POST /api/upload          (store file → Supabase Storage)│
│  • POST /api/extract         (trigger extraction job)       │
│  • GET  /api/documents       (list user's documents)        │
│  • GET  /api/extractions/:id (get extraction results)       │
│  • PUT  /api/extractions/:id (update edited fields)         │
│  • POST /api/re-extract      (run extraction again)         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    Background Task: Extract Document                 │   │
│  │                                                      │   │
│  │  1. Fetch file from Supabase Storage                │   │
│  │  2. Mistral OCR: Text extraction (mistral-ocr-latest) │   │
│  │  3. Save raw OCR → ocr_results table                │   │
│  │  4. LangChain + Claude: Structured extraction       │   │
│  │  5. Save results → extractions table                │   │
│  │  6. Update document status → completed/failed       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             │ SQL Queries                   │ File Storage API
             │ (Store/retrieve data)         │ (Upload/download files)
             ↓                               ↓
┌─────────────────────────┐     ┌────────────────────────────┐
│  Supabase PostgreSQL    │     │   Supabase Storage (S3)    │
│                         │     │                            │
│  Tables:                │     │  Buckets:                  │
│  • users (auth.users)   │     │  • documents/              │
│  • documents            │     │    - {user_id}/{doc_id}.pdf│
│  • ocr_results          │     │    - Access controlled     │
│  • extractions          │     │    - Signed URLs           │
└─────────────────────────┘     └────────────────────────────┘
             ↑                               ↑
             │                               │
             └───────────────┬───────────────┘
                             │
                    ┌────────▼────────┐
                    │  Supabase Auth  │
                    │                 │
                    │  • Email/pass   │
                    │  • JWT tokens   │
                    └─────────────────┘
```

---

## Message Flow Patterns

### Pattern 1: Upload Document (User → Storage)
```
User drags PDF file into upload zone
    ↓
Next.js: POST /api/upload (multipart/form-data)
    Body: { file: invoice.pdf, user_id: "uuid", mode: "auto" }
    ↓
FastAPI receives upload
    ↓
FastAPI → Supabase Storage: Upload file to bucket
    Bucket: documents/{user_id}/{document_id}.pdf
    ↓
FastAPI → PostgreSQL: Insert document record
    INSERT INTO documents (id, user_id, filename, file_path, status, mode)
    VALUES ('doc_123', 'user_456', 'invoice.pdf', 'documents/user_456/doc_123.pdf', 'processing', 'auto')
    ↓
FastAPI returns document_id to Next.js
    Response: { document_id: "doc_123", status: "processing" }
    ↓
Next.js updates UI: Show document card with "Processing..." status
```

### Pattern 2: Extract Data (Background Processing)
```
FastAPI triggers BackgroundTask: extract_document(document_id)
    ↓
Task starts (async, non-blocking)
    ↓
1. Fetch file from Supabase Storage
   GET https://supabase.co/storage/v1/object/sign/documents/user_456/doc_123.pdf
    ↓
2. Mistral OCR: Extract text via Mistral Direct API
   - Encode PDF/image as base64
   - Send to Mistral OCR API
   ocr_response = client.ocr.process(
       model="mistral-ocr-latest",
       document={"type": "document_base64", "document_base64": pdf_base64}
   )
   text = ocr_response.text
    ↓
2a. Save OCR result to database
   INSERT INTO ocr_results (document_id, user_id, raw_text, page_count, token_usage, processing_time_ms)
    ↓
3. Build LangChain prompt based on mode:

   IF mode == "auto":
     prompt = "Extract all relevant fields from this document"

   IF mode == "custom":
     fields = ["vendor_name", "invoice_date", "total_amount"]
     prompt = f"Extract these specific fields: {fields}"
    ↓
4. Claude extracts structured data
   chain = prompt | llm.with_structured_output(ExtractionSchema)
   extraction = chain.invoke({"text": text})

   Result: {
     "vendor_name": "Acme Corp",
     "invoice_date": "2025-11-01",
     "total_amount": 1250.00,
     "line_items": [
       {"description": "Widget A", "quantity": 10, "price": 125.00}
     ],
     "confidence_scores": {
       "vendor_name": 0.95,
       "invoice_date": 0.98,
       "total_amount": 0.92
     }
   }
    ↓
5. Save extraction to database
   INSERT INTO extractions (id, document_id, user_id, extracted_fields, confidence_scores, mode, processing_time_ms)
    ↓
6. Update document status
   UPDATE documents SET status='completed', processed_at=NOW() WHERE id='doc_123'
    ↓
Done ✓
```

### Pattern 3: View Document Library (User → API → DB)
```
User navigates to dashboard
    ↓
Next.js: GET /api/documents?user_id=user_456&limit=20&offset=0
    ↓
FastAPI queries PostgreSQL:
    SELECT d.id, d.filename, d.upload_date, d.status,
           e.extracted_fields->>'vendor_name' as vendor,
           e.extracted_fields->>'total_amount' as amount,
           e.extracted_fields->>'invoice_date' as date
    FROM documents d
    LEFT JOIN extractions e ON e.document_id = d.id AND e.is_latest = true
    WHERE d.user_id = 'user_456'
    ORDER BY d.upload_date DESC
    LIMIT 20
    ↓
FastAPI returns document list with key fields:
    Response: [
      {
        "document_id": "doc_123",
        "filename": "invoice_acme.pdf",
        "status": "completed",
        "upload_date": "2025-11-02T10:30:00Z",
        "preview_fields": {
          "vendor": "Acme Corp",
          "amount": 1250.00,
          "date": "2025-11-01"
        },
        "thumbnail_url": "https://supabase.co/storage/.../thumb.jpg"
      },
      ...
    ]
    ↓
Next.js renders grid view with document cards
```

### Pattern 4: Edit Extraction (User → API → DB)
```
User clicks "Edit" on document card
    ↓
Next.js: GET /api/extractions/{extraction_id}
    ↓
FastAPI returns full extraction data:
    Response: {
      "extraction_id": "ext_789",
      "document_id": "doc_123",
      "extracted_fields": {
        "vendor_name": "Acme Corp",
        "invoice_date": "2025-11-01",
        "total_amount": 1250.00,
        "line_items": [...]
      },
      "confidence_scores": {...}
    }
    ↓
Next.js opens edit modal/sidebar with form pre-filled
    ↓
User edits: "Acme Corp" → "ACME Corporation"
    ↓
User clicks "Save"
    ↓
Next.js: PUT /api/extractions/{extraction_id}
    Body: {
      "extracted_fields": {
        "vendor_name": "ACME Corporation",  // Updated
        "invoice_date": "2025-11-01",
        "total_amount": 1250.00,
        ...
      }
    }
    ↓
FastAPI updates database:
    UPDATE extractions
    SET extracted_fields = $1, updated_at = NOW()
    WHERE id = 'ext_789'
    ↓
FastAPI returns success
    Response: { "success": true }
    ↓
Next.js updates UI with new values
```

### Pattern 5: Re-extract Document (New Extraction)
```
User views document with auto extraction
    ↓
User clicks "Re-extract with Custom Fields"
    ↓
Next.js shows custom fields form
    ↓
User enters fields: ["vendor_name", "invoice_date", "total_amount", "payment_terms"]
    ↓
User clicks "Re-extract"
    ↓
Next.js: POST /api/re-extract
    Body: {
      "document_id": "doc_123",
      "mode": "custom",
      "custom_fields": ["vendor_name", "invoice_date", "total_amount", "payment_terms"]
    }
    ↓
FastAPI creates new extraction record:
    INSERT INTO extractions (document_id, user_id, mode, custom_fields, status)
    VALUES ('doc_123', 'user_456', 'custom', '["vendor_name", ...]', 'processing')
    ↓
FastAPI triggers BackgroundTask: extract_document() (same as Pattern 2)
    ↓
New extraction saved to database (keeps history)
    • extraction_1: auto mode (original)
    • extraction_2: custom mode (new) ← Set as is_latest=true
    ↓
Next.js polls for completion: GET /api/extractions/{extraction_id}/status
    ↓
When status='completed', Next.js displays new extraction results
```

### Pattern 6: Download CSV/JSON
```
User clicks "Download CSV" on document
    ↓
Next.js: GET /api/extractions/{extraction_id}/export?format=csv
    ↓
FastAPI fetches extraction from database
    ↓
FastAPI transforms data:

    IF format == "csv":
      - Flatten nested structures (line_items → multiple rows)
      - Convert to CSV format
      - Example:
        vendor_name,invoice_date,total_amount,line_item_description,line_item_qty,line_item_price
        "Acme Corp","2025-11-01",1250.00,"Widget A",10,125.00
        "Acme Corp","2025-11-01",1250.00,"Widget B",5,250.00

    IF format == "json":
      - Return nested structure as-is
      - Pretty-printed JSON
    ↓
FastAPI returns file:
    Response:
      Content-Type: text/csv or application/json
      Content-Disposition: attachment; filename="invoice_acme_2025-11-01.csv"
      Body: [CSV/JSON data]
    ↓
Browser triggers download
```

---

## REST API Endpoints (FastAPI)

### Documents Controller

```
POST /api/upload
     → Upload document file to Supabase Storage, create document record
     Body: multipart/form-data { file: File, mode: "auto"|"custom", custom_fields?: string[] }
     Response: { document_id: string, status: "processing" }

GET  /api/documents
     → List user's documents (paginated)
     Query params: user_id, limit (default 20), offset (default 0), status (optional filter)
     Response: [{ document_id, filename, status, upload_date, preview_fields, thumbnail_url }, ...]

GET  /api/documents/{document_id}
     → Get document details
     Response: { document_id, filename, file_path, status, upload_date, mode, extractions: [...] }

DELETE /api/documents/{document_id}
     → Delete document and all associated extractions
     Response: { success: true }
```

### Extractions Controller

```
POST /api/extract
     → Trigger extraction for uploaded document (called automatically after upload)
     Body: { document_id, mode: "auto"|"custom", custom_fields?: string[] }
     Response: { extraction_id, status: "processing" }

GET  /api/extractions/{extraction_id}
     → Get extraction results
     Response: { extraction_id, document_id, extracted_fields, confidence_scores, mode, created_at }

PUT  /api/extractions/{extraction_id}
     → Update extracted fields (after user edits)
     Body: { extracted_fields: {...} }
     Response: { success: true }

POST /api/re-extract
     → Create new extraction for existing document
     Body: { document_id, mode, custom_fields?: string[] }
     Response: { extraction_id, status: "processing" }

GET  /api/extractions/{extraction_id}/status
     → Poll extraction status (for frontend polling)
     Response: { status: "processing"|"completed"|"failed", progress?: number }

GET  /api/extractions/{extraction_id}/export?format=csv|json
     → Download extraction as CSV or JSON
     Response: File download (text/csv or application/json)
```

### Usage Controller

```
GET  /api/usage/current
     → Get user's current monthly usage
     Response: { documents_processed: 3, limit: 5, reset_date: "2025-12-01" }
```

### Health Check

```
GET  /health
     → Health check endpoint
     Response: { status: "ok", timestamp: "..." }
```

---

## Database Schema Overview

See `planning/SCHEMA.md` for full table definitions.

**Key tables:**
- `auth.users` (Managed by Supabase Auth)
- `documents` (Uploaded files metadata)
- `extractions` (Extraction results, multiple per document)
- `usage_tracking` (Monthly usage counter per user)

**Key relationships:**
- `users` 1:N `documents` (user uploads many documents)
- `documents` 1:N `extractions` (document can be extracted multiple times)
- `users` 1:1 `usage_tracking` (monthly usage counter)

---

## Supabase Storage Configuration

**Bucket Name:** `documents`

**Bucket Type:** Standard bucket (S3-compatible)

**Access Control:** Private (requires authentication)

**File Size Limit:** 10 MB (10,485,760 bytes)
- **Reasoning:** PDFs/invoices are typically 100KB-2MB. 10MB provides headroom for scanned documents without allowing abuse.
- **Enforcement:** Bucket-level restriction (no code-level validation needed)

**Allowed MIME Types:**
- `application/pdf` - PDF documents (primary use case)
- `image/png` - Scanned receipts
- `image/jpeg` - Scanned receipts
- `image/jpg` - Alternative JPEG extension

**File Path Structure:**
```
documents/
  {user_id}/
    {document_id}_{filename}.pdf
```

**Row-Level Security (RLS) Policies:**
- **SELECT:** Users can only view their own files (`user_id = auth.uid()`)
- **INSERT:** Users can only upload to their own folder (`user_id = auth.uid()`)
- **UPDATE:** Not allowed (files are immutable)
- **DELETE:** Users can only delete their own files (`user_id = auth.uid()`)

**Benefits of Bucket-Level Validation:**
- Defense in depth (enforced even if application code has bugs)
- Simpler FastAPI code (no need to validate file size/type)
- Clearer error messages (Supabase rejects invalid uploads directly)

---

## Key Design Decisions

### ✅ Mistral OCR Direct API

**Choice:** Use Mistral OCR (`mistral-ocr-latest`) through Mistral Direct API instead of self-hosted OCR

**Rationale:**
- **Fast processing:** 5-10s per document
- **No infrastructure overhead:** No GPU dependencies to manage
- **Cost-effective:** ~$2 per 1,000 pages
- **Large context window:** 128K tokens, handles up to 1000 pages
- **High accuracy:** 98.96% accuracy on scanned documents
- **Scales automatically:** Mistral handles infrastructure
- **Simpler deployment:** Pure API integration, minimal dependencies

**Trade-off:**
- API dependency (requires internet, subject to rate limits)
- Per-request costs (vs free self-hosted OCR)
- **Mitigation:** Cache OCR results in `ocr_results` table for re-extraction
- **Cost savings:** Re-extraction uses cached text (only LLM cost, no OCR cost)

---

### ✅ FastAPI BackgroundTasks for Async Processing

**Choice:** Use FastAPI's built-in BackgroundTasks instead of Celery

**Rationale:**
- **Simplicity:** No separate queue infrastructure (Redis, RabbitMQ)
- **Good enough for MVP:** Processes documents in background without blocking API
- **Easy to migrate:** Can switch to Celery later if needed

**How it works:**
```python
@app.post("/api/upload")
async def upload_document(file: UploadFile, background_tasks: BackgroundTasks):
    document_id = save_to_storage(file)
    background_tasks.add_task(extract_document, document_id)  # Runs after response sent
    return {"document_id": document_id, "status": "processing"}
```

**Limitations:**
- Tasks lost if server restarts (no persistence)
- No retry logic (need to implement manually)
- Can't distribute across multiple workers

**When to switch to Celery:**
- Processing >100 documents/hour
- Need guaranteed delivery (task persistence)
- Want distributed task queue

---

### ✅ Multiple Extractions Per Document

**Choice:** Store all extractions for a document (history), mark latest as `is_latest=true`

**Rationale:**
- User can re-extract with different modes (auto → custom)
- Keep history for comparison ("which extraction was better?")
- Supports iterative refinement
- Enables A/B testing different prompts/models

**Implementation:**
```sql
-- extractions table
CREATE TABLE extractions (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id),
    user_id UUID REFERENCES auth.users(id),
    extracted_fields JSONB NOT NULL,
    mode VARCHAR(20) NOT NULL,  -- 'auto' or 'custom'
    custom_fields TEXT[],  -- NULL for auto mode
    is_latest BOOLEAN DEFAULT false,  -- Only one per document
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Query for latest extraction:**
```sql
SELECT * FROM extractions
WHERE document_id = 'doc_123' AND is_latest = true
LIMIT 1;
```

---

### ✅ JSONB for Extracted Fields (Flexible Schema)

**Choice:** Store extracted data as JSONB instead of relational tables

**Rationale:**
- **Flexibility:** Every document type has different fields (invoices vs contracts vs forms)
- **No migrations:** Adding new field types doesn't require schema changes
- **Fast to build:** No need to design normalized tables upfront
- **PostgreSQL JSONB:** Fast indexing and querying (can index specific JSON keys)

**Trade-off:**
- Less type safety (no foreign keys within JSON)
- Harder to enforce data consistency
- **Acceptable for MVP:** Can migrate to relational tables later if needed (like spike's PageRank vision)

**Example extracted_fields:**
```json
{
  "vendor_name": "Acme Corp",
  "invoice_number": "INV-2025-001",
  "invoice_date": "2025-11-01",
  "total_amount": 1250.00,
  "currency": "AUD",
  "line_items": [
    {
      "description": "Widget A",
      "quantity": 10,
      "unit_price": 125.00,
      "total": 1250.00
    }
  ]
}
```

---


### ✅ LangChain for LLM Abstraction

**Choice:** Use LangChain instead of calling Claude API directly

**Rationale:**
- **Model flexibility:** Easy to swap Claude ↔ OpenAI ↔ other models
- **Structured outputs:** `with_structured_output()` handles JSON parsing automatically
- **Prompt templating:** Clean separation of prompts from code
- **Proven pattern:** Your spike already uses LangChain successfully

**Implementation:**
```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(
    model=settings.OPENROUTER_MODEL,
    temperature=0,
    openai_api_key=settings.OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1"
)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert document data extraction system..."),
    ("user", "{text}")
])

chain = prompt | llm.with_structured_output(ExtractionSchema)
extraction = chain.invoke({"text": document_text})
```

---

### ✅ Frontend Polling for Extraction Status

**Choice:** Next.js polls `/api/extractions/{id}/status` instead of WebSockets

**Rationale:**
- **Simplicity:** No WebSocket infrastructure needed
- **Good UX:** Poll every 2-3 seconds, most extractions complete in <30 seconds
- **Reliable:** Works through firewalls/proxies that block WebSockets

**Implementation:**
```typescript
// Next.js component
useEffect(() => {
  const interval = setInterval(async () => {
    const { status } = await fetch(`/api/extractions/${id}/status`);
    if (status === 'completed' || status === 'failed') {
      clearInterval(interval);
      fetchExtractionResults();
    }
  }, 2000);  // Poll every 2 seconds
}, [extractionId]);
```

**When to switch to WebSockets:**
- Processing >50 documents/hour (polling creates too many requests)
- Want real-time progress updates (e.g., "Processing page 5/20")

---

## Development Phases

### Phase 1: Backend Core (Week 1)
1. FastAPI project setup
2. Supabase PostgreSQL connection
3. Supabase Storage integration (file upload)
4. Document model + API endpoints (upload, list)
5. Auth middleware (validate Supabase JWT)
6. Deploy to Railway/Render staging

### Phase 2: Extraction Engine (Week 1-2)
1. Mistral OCR integration (`mistral-ocr-latest` via Mistral Python SDK)
2. OCR results caching (ocr_results table)
3. LangChain + OpenRouter setup (configurable LLM model)
4. Extraction logic (auto mode)
5. Custom fields mode (user-specified fields)
6. BackgroundTasks implementation
7. Extraction model + API endpoints
8. Test with 10 sample documents

### Phase 3: Frontend MVP (Week 2)
1. Next.js project setup (App Router)
2. Supabase Auth integration (login/signup)
3. Upload component (drag-drop + file picker)
4. Mode selection (auto vs custom)
5. Document library (grid view with cards)
6. Extraction results display
7. Edit form (modal/sidebar)
8. CSV/JSON export
9. Deploy to Vercel staging

### Phase 4: Polish & Launch (Week 3)
1. Error handling (OCR failures, LLM timeouts)
2. Loading states and progress indicators
3. Usage tracking (5 free docs/month)
4. Limit enforcement (block uploads when limit reached)
5. Re-extraction feature
6. Mobile responsive design
7. Production deployment (Vercel + Railway)
8. Soft launch (beta users)

### Phase 5: Stripe Integration (Week 4)
1. Stripe setup (subscription plans)
2. Upgrade flow (free → paid)
3. Billing dashboard
4. Usage reset logic (monthly)
5. Payment success/failure handling

---

## Tech Stack Summary

**Frontend:**
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase Auth client
- Deployed on Vercel

**Backend:**
- FastAPI (Python 3.11+)
- LangChain (OpenRouter integration)
- Mistral OCR (`mistral-ocr-latest` via Mistral Python SDK)
- Deployed on Railway/Render/Fly.io

**Database:**
- Supabase PostgreSQL (with JSONB)
- Supabase Storage (S3-backed)
- Supabase Auth (JWT tokens)

**AI/LLM:**
- OpenRouter (model-agnostic: Claude, GPT-4, Gemini, etc.)
- Default: anthropic/claude-3.5-sonnet (configurable via env)
- Mistral OCR via Mistral Direct API (~$2 per 1,000 pages)

---

## Related Documentation

- **Functional requirements**: `planning/PRD.md`
- **Database schema**: `planning/SCHEMA.md` (table definitions, indexes, relationships)
- **Development tasks**: `planning/TASKS.md` (week-by-week build plan)
