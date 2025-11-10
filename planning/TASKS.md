# Development Tasks & Timeline

**Product:** StackDocs MVP - Document Data Extractor
**Version:** 1.0
**Timeline:** 3-4 weeks to launch (soft launch Week 3, Stripe Week 4)
**Estimated Effort:** 90-120 hours total (30-40 hours/week)

---

## Document Purpose

This document breaks down the 3-4 week build plan into actionable tasks organized by development phase.

---

## Overview

The MVP is divided into 4 phases:

1. **Foundation** (Week 1) - Backend core + database setup
2. **Extraction Engine** (Week 1-2) - OCR + LLM extraction logic
3. **Frontend MVP** (Week 2-3) - User interface + document library
4. **Launch & Iteration** (Week 3-4) - Soft launch, then add Stripe

**P0 Features (Must Have):**

- Document upload + storage
- Auto extraction + custom fields modes
- Document library (grid view)
- Edit extraction results
- CSV/JSON export
- Usage limits (5 free docs/month)

**P1 Features (Post-MVP):**

- Stripe integration (Week 4)
- Batch upload
- Saved templates
- API access

---

## Phase 1: Foundation (Week 1, Days 1-3)

**Goal:** Set up infrastructure, database, and basic API skeleton. Nothing user-facing yet.

**Deliverable:** Backend API deployed, database live, file upload working.

### Infrastructure Setup (Day 1)

- [x] Create GitHub repository with monorepo structure

  - `/backend` (FastAPI)
  - `/frontend` (Next.js)
  - `/planning` (documentation)
  - `.gitignore` (exclude venv, .env, node_modules)
  - **Completed**: 2025-11-03

- [x] Set up Supabase project

  - Create new project in Supabase dashboard
  - Enable authentication (email/password)
  - Get project URL and anon key
  - Get service role key (for backend)
  - **Completed**: 2025-11-03
  - **Project**: stackdocs (Sydney region, ap-southeast-2)

- [~] Set up deployment platforms

  - Create Vercel account/project (frontend)
  - Create Railway/Render account (backend)
  - Configure GitHub integration for auto-deploy
  - **Note**: Skipping for now - will set up in Week 3 before soft launch

- [x] Environment variables setup
  - Backend `.env`:
    ```
    SUPABASE_URL=https://xxx.supabase.co
    SUPABASE_KEY=your_service_role_key
    ANTHROPIC_API_KEY=sk-ant-xxx
    ```
  - Frontend `.env.local`:
    ```
    NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
    NEXT_PUBLIC_API_URL=http://localhost:8000
    ```
  - **Completed**: 2025-11-03
  - **Note**: Created .env.example templates (committed) and actual .env files (gitignored)

### Database Setup (Day 1-2)

- [x] Run database migration SQL in Supabase SQL Editor

  - Copy SQL from `planning/SCHEMA.md`
  - Execute to create tables: users, documents, extractions (simplified to 3 tables)
  - Verify all indexes created
  - Enable Row-Level Security policies
  - **Completed**: 2025-11-03
  - **Note**: Created backend/migrations/001_initial_schema.sql and applied via MCP

- [x] Set up Supabase Storage bucket

  - Create `documents` bucket
  - Configure bucket as private (require auth)
  - Set up storage policies (users can only access their own files)
  - **Started**: 2025-11-03
  - **Completed**: 2025-11-03

- [x] Test RLS policies

  - Create test user in Supabase Auth
  - Insert test document as that user
  - Verify can't access documents from other users
  - **Started**: 2025-11-03
  - **Completed**: 2025-11-03
  - **Result**: All RLS policies verified working (storage + database tables)

- [x] Set up usage tracking trigger
  - Create trigger to auto-create usage_tracking record on user signup
  - Test by creating new user and verifying record created
  - **Completed**: 2025-11-03
  - **Note**: Trigger already created in 001_initial_schema.sql, verified working

### Backend API Setup (Day 2-3)

- [x] Initialize FastAPI project

  ```bash
  cd backend
  python -m venv venv
  source venv/bin/activate  # or venv\Scripts\activate on Windows
  pip install fastapi uvicorn python-dotenv supabase openai langchain-openai docling
  ```

  - **Completed**: 2025-11-03
  - **Note**: Updated to use OpenRouter (openai + langchain-openai) instead of Anthropic for model flexibility

- [x] Create project structure

  ```
  backend/
    app/
      __init__.py
      main.py           # FastAPI app entry point
      config.py         # Environment variables
      database.py       # Supabase client setup
      models.py         # Pydantic models
      routes/
        __init__.py
        documents.py    # Document endpoints
        extractions.py  # Extraction endpoints
        usage.py        # Usage tracking endpoints
      services/
        __init__.py
        storage.py      # Supabase Storage operations
        extractor.py    # OCR + LLM extraction logic
        usage.py        # Usage limit checking
    requirements.txt
    .env
  ```

  - **Completed**: 2025-11-03
  - **Note**: All files created with placeholder structure, ready for implementation

- [x] Set up Supabase client with config

  ```python
  # database.py
  from supabase import create_client, Client
  from app.config import settings

  supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
  ```

  - **Completed**: 2025-11-03
  - **Note**: Using cached get_supabase_client() function with lru_cache

- [x] Configure CORS for Next.js

  ```python
  # main.py
  from fastapi.middleware.cors import CORSMiddleware

  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:3000"],  # Next.js dev server
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

  - **Completed**: 2025-11-03
  - **Note**: CORS origins configurable via ALLOWED_ORIGINS in .env

- [x] Create base API endpoints (no logic yet, just routes)

  - `GET /health` - Health check ✅
  - `POST /api/upload` - Upload document (placeholder)
  - `GET /api/documents` - List user's documents (placeholder)
  - `GET /api/documents/{document_id}` - Get document details (placeholder)
  - `DELETE /api/documents/{document_id}` - Delete document (placeholder)
  - `GET /api/extractions/{extraction_id}` - Get extraction results (placeholder)
  - `PUT /api/extractions/{extraction_id}` - Update extraction (placeholder)
  - `GET /api/usage/current` - Get user's current usage (placeholder)
  - **Completed**: 2025-11-03
  - **Note**: Health check working, tested via Swagger. Route modules created with TODO comments for implementation

- [~] Deploy backend to Railway/Render staging
  - Connect GitHub repo
  - Set environment variables
  - Deploy and verify `/health` endpoint works

**Week 1 Checkpoint:**
✅ Database schema live in Supabase
✅ Supabase Storage bucket created
✅ Backend API skeleton deployed
✅ CORS configured for local development

---

## Phase 2: Extraction Engine (Week 1-2, Days 4-10)

**Goal:** Build core extraction logic - OCR + LLM integration, file upload, background processing.

**Deliverable:** Upload document → extraction completes → results saved to database.

### File Upload Service (Day 4)

- [x] Implement Supabase Storage service
  - **Completed**: 2025-11-03
  - Implemented upload_document(), download_document(), create_signed_url(), delete_document()
  - Code verified against official Supabase Python docs
  - All type checking errors resolved

- [x] Implement POST /api/upload endpoint
  - **Completed**: 2025-11-03
  - Accepts multipart/form-data (file + mode + user_id)
  - Uploads to Supabase Storage
  - Creates document record in database
  - Returns DocumentUploadResponse with document_id and status
  - Integrated with usage limit checking

- [x] Add usage limit check
  - **Completed**: 2025-11-03
  - Implemented check_usage_limit(), increment_usage(), reset_usage(), get_usage_stats()
  - Checks users.documents_processed_this_month vs documents_limit
  - Returns 403 if limit exceeded
  - Auto-increments counter after successful upload

- [x] Test file upload flow
  - **Completed**: 2025-11-03
  - Tested via Swagger UI with 2 PDF uploads
  - Verified files in Supabase Storage bucket
  - Verified document records in database
  - Confirmed usage counter increments correctly (0 → 1 → 2)

### ~~Docling~~ Mistral OCR Integration (Day 5)  **[MIGRATED]**

- [x] ~~Install Docling~~ → Migrated to Mistral OCR Direct API
  - **Original completion**: 2025-11-03
  - **Migration decision**: 2025-11-04 (Docling too slow: 10-90s per document)
  - **Reason**: Mistral OCR faster (5-10s), cost-effective (~$2 per 1,000 pages), 128K context window, 98.96% accuracy

- [x] ~~Create Docling OCR service~~ → Replaced with Mistral OCR service
  - **Original completion**: 2025-11-03
  - See migration tasks below for Mistral OCR implementation

- [x] Test OCR with sample documents
  - **Completed with Docling**: 2025-11-03
  - Tested with 2-page PDF resume (Fraser Brown Resume)
  - Perfect text extraction quality (5,277 characters)
  - Processing time: ~90 seconds first run, 10-30s subsequent (too slow)
  - **Will retest with Mistral OCR after migration**

---

### Mistral OCR Migration Tasks (Day 5-6)

- [x] Create database migration for `ocr_results` table
  - File: `backend/migrations/002_add_ocr_results.sql`
  - Table stores raw OCR text (markdown), model, usage_info, processing_time_ms, layout_data
  - Added model field for tracking OCR model version
  - Enables re-extraction without duplicate OCR API calls
  - **Completed**: 2025-11-06

- [x] Apply migration to Supabase database
  - Applied migration via Supabase MCP tool
  - Verified table created with correct indexes and RLS policies
  - Tested with 2 documents - OCR results saved successfully
  - **Completed**: 2025-11-06

- [x] Update `backend/app/config.py` with Mistral API settings
  - Add `MISTRAL_API_KEY` env var
  - Update `.env.example` with new variable
  - **Completed**: 2025-11-05

- [x] Create `backend/app/services/ocr.py` (renamed from ocr_mistral for flexibility)
  - Use Mistral Python SDK (`client.ocr.process()`)
  - Model: `mistral-ocr-latest`
  - Encode PDF/image as base64
  - Send to Mistral OCR API
  - Enhanced to capture usage_info, processing_time_ms, layout_data
  - Return OCRResult dict with full metadata
  - **Completed**: 2025-11-05

- [x] Update `backend/app/services/extractor.py`
  - Remove Docling imports and code
  - Converted to placeholder for LangChain implementation (Day 6-7)
  - **Completed**: 2025-11-05

- [x] Update `backend/requirements.txt`
  - Remove `docling==2.60.0`
  - Kept `mistralai==1.9.11` (already installed)
  - **Completed**: 2025-11-05

- [x] Test Mistral OCR extraction with uploaded document
  - Tested with Ubuntu CLI cheat sheet (3 pages) - SUCCESS
  - Tested with Fraser Brown Resume (2 pages) - SUCCESS
  - OCR quality excellent (markdown formatting preserved)
  - Processing time: <5s per document
  - Test endpoint working: `POST /api/test-ocr/{document_id}`
  - **Completed**: 2025-11-05

- [x] Optimize OCR to use Supabase signed URLs instead of file downloads
  - Refactored `extract_text_ocr()` to accept signed URLs directly
  - Eliminated temp file creation and base64 encoding overhead
  - Reduced code by 47 lines (81 deleted, 34 added)
  - Improved memory efficiency and scalability
  - Processing time: ~3.5s per document (acceptable for MVP)
  - **Completed**: 2025-11-06

- [x] Implement OCR result database caching
  - Added direct Supabase insert/upsert to test endpoint after OCR
  - Maps OCRResult fields to ocr_results table columns
  - Uses upsert for idempotency (one OCR per document)
  - Graceful error handling (logs errors but returns OCR result)
  - Tested with 2 documents - both cached successfully
  - **Completed**: 2025-11-06

- [x] Code cleanup and lint fixes for ocr.py
  - Moved `to_thread` import to top of file
  - Removed unnecessary f-string in logger
  - Improved text extraction with getattr() pattern
  - Fixed minor lint warnings
  - **Completed**: 2025-11-06

- [x] Refactor OCR endpoint into dedicated routes file
  - Created `backend/app/routes/ocr.py` for OCR-specific endpoints
  - Moved test-ocr endpoint from documents.py to ocr.py
  - Registered OCR router in main.py with /api prefix
  - Improved code organization (separation of concerns)
  - Endpoint verified working at new location via Swagger
  - **Completed**: 2025-11-06

- [x] Test re-extraction flow with cached OCR
  - Upload document → OCR runs
  - Re-extract with different mode → OCR fetched from cache
  - Verify no duplicate Mistral API calls (check request_id)
  - Created migration 003 to add `model` and `processing_time_ms` fields
  - Updated test endpoints to fetch OCR from cache automatically
  - Tested with resume PDF: auto extraction (17 fields, 11.3s) + custom extraction (5 fields, 2.5s)
  - Both extractions saved to database, OCR cached and reused
  - **Completed**: 2025-11-10

### LangChain + Claude Integration (Day 6-7)

- [x] Set up LangChain with ChatOpenAI + OpenRouter
  - Using existing `langchain-openai` package (already installed)
  - ChatOpenAI configured with OpenRouter base URL for Claude access
  - Pydantic ExtractedData model for structured output
  - Using `method="function_calling"` for proper JSON extraction
  - Temperature=0 for deterministic extraction
  - **Completed**: 2025-11-06

- [x] Implement auto extraction mode

  ```python
  async def extract_auto_mode(text: str) -> dict:
      """AI extracts all relevant fields automatically"""
      prompt = ChatPromptTemplate.from_messages([
          ("system", """You are an expert document data extraction system.
          Analyze the document and extract ALL relevant structured data.
          Return data as a dictionary with descriptive field names.
          Include confidence scores for each field (0.0 to 1.0)."""),
          ("user", "{text}")
      ])

      chain = prompt | llm.with_structured_output(ExtractedData)
      result = chain.invoke({"text": text})

      return {
          "extracted_fields": result.extracted_fields,
          "confidence_scores": result.confidence_scores
      }
  ```
  - Created `backend/app/services/extractor.py` with LangChain logic
  - Uses ChatPromptTemplate for system + user message structure
  - Extracts all relevant fields automatically with confidence scores
  - Tested successfully with Ubuntu CLI cheat sheet document
  - **Completed**: 2025-11-06

- [x] Implement custom fields mode

  ```python
  async def extract_custom_fields(text: str, custom_fields: list[str]) -> dict:
      """AI extracts only specified fields"""
      fields_str = ", ".join(custom_fields)

      prompt = ChatPromptTemplate.from_messages([
          ("system", f"""You are an expert document data extraction system.
          Extract ONLY these specific fields from the document: {fields_str}
          Return data as a dictionary with exactly these field names.
          Include confidence scores for each field."""),
          ("user", "{text}")
      ])

      chain = prompt | llm.with_structured_output(ExtractedData)
      result = chain.invoke({"text": text})

      return {
          "extracted_fields": result.extracted_fields,
          "confidence_scores": result.confidence_scores
      }
  ```
  - Accepts list of field names from user input
  - Dynamically builds prompt with requested fields
  - Returns only the specified fields in structured format
  - **Completed**: 2025-11-06

- [x] Create test endpoints for extraction
  - Added `POST /api/test-extract-auto` endpoint
  - Added `POST /api/test-extract-custom` endpoint (accepts comma-separated fields)
  - Created `backend/app/routes/extractions.py` router
  - Registered extractions router in main.py
  - Both endpoints tested and working via Swagger UI
  - **Completed**: 2025-11-06

- [x] Test extraction with sample documents
  - Tested auto mode with Ubuntu CLI cheat sheet (complex nested structure)
  - Successfully extracted 12 top-level fields with nested arrays
  - Confidence scores all >0.90 (excellent accuracy)
  - Verified structured output with complex data types (arrays of objects, URLs)
  - Ready for invoice/receipt testing
  - **Completed**: 2025-11-06

### Background Processing (Day 8)

- [ ] Implement extraction background task

  ```python
  # services/extractor.py
  async def extract_document(document_id: str, user_id: str, mode: str, custom_fields: list[str] = None):
      """Full extraction pipeline (OCR → LLM → save results)"""
      start_time = time.time()

      try:
          # 1. Fetch document from database
          doc = supabase.table('documents').select('*').eq('id', document_id).single().execute()

          # 2. Download file from Supabase Storage
          file_bytes = supabase.storage.from_('documents').download(doc.data['file_path'])

          # 3. OCR with Docling
          text = extract_text_from_document(file_bytes)

          # 4. LLM extraction
          if mode == 'auto':
              extraction_result = await extract_auto_mode(text)
          else:
              extraction_result = await extract_custom_fields(text, custom_fields)

          # 5. Save extraction to database
          processing_time = int((time.time() - start_time) * 1000)  # milliseconds

          supabase.table('extractions').insert({
              'document_id': document_id,
              'user_id': user_id,
              'extracted_fields': extraction_result['extracted_fields'],
              'confidence_scores': extraction_result['confidence_scores'],
              'mode': mode,
              'custom_fields': custom_fields,
              'is_latest': True,
              'processing_time_ms': processing_time
          }).execute()

          # 6. Update document status
          supabase.table('documents').update({
              'status': 'completed',
              'processed_at': datetime.now().isoformat()
          }).eq('id', document_id).execute()

          # 7. Increment usage counter
          supabase.rpc('increment_usage', {'user_id': user_id}).execute()

      except Exception as e:
          # Update document status to failed
          supabase.table('documents').update({
              'status': 'failed',
              'error_message': str(e)
          }).eq('id', document_id).execute()
  ```

- [ ] Update upload endpoint to trigger background task

  ```python
  from fastapi import BackgroundTasks

  @app.post("/api/upload")
  async def upload_document(
      file: UploadFile,
      mode: str,
      custom_fields: list[str] = None,
      background_tasks: BackgroundTasks,
      user_id: str = Depends(get_current_user)
  ):
      # Check usage limit
      if not await check_usage_limit(user_id):
          raise HTTPException(403, "Monthly limit reached")

      # Upload file
      upload_result = await upload_document_to_storage(user_id, file)

      # Trigger extraction in background
      background_tasks.add_task(
          extract_document,
          upload_result['document_id'],
          user_id,
          mode,
          custom_fields
      )

      return {
          "document_id": upload_result['document_id'],
          "status": "processing"
      }
  ```

- [ ] Test end-to-end extraction flow
  - Upload document via API
  - Wait for background task to complete
  - Query database to verify extraction saved
  - Verify document status updated to 'completed'
  - Verify usage counter incremented

### Extraction Endpoints (Day 9)

- [ ] Implement GET /api/extractions/{extraction_id}

  ```python
  @app.get("/api/extractions/{extraction_id}")
  async def get_extraction(extraction_id: str, user_id: str = Depends(get_current_user)):
      extraction = supabase.table('extractions').select('*').eq('id', extraction_id).eq('user_id', user_id).single().execute()
      return extraction.data
  ```

- [ ] Implement PUT /api/extractions/{extraction_id} (edit fields)

  ```python
  @app.put("/api/extractions/{extraction_id}")
  async def update_extraction(
      extraction_id: str,
      updated_fields: dict,
      user_id: str = Depends(get_current_user)
  ):
      supabase.table('extractions').update({
          'extracted_fields': updated_fields,
          'updated_at': datetime.now().isoformat()
      }).eq('id', extraction_id).eq('user_id', user_id).execute()

      return {"success": True}
  ```

- [ ] Implement GET /api/extractions/{extraction_id}/status (for polling)

  ```python
  @app.get("/api/extractions/{extraction_id}/status")
  async def get_extraction_status(extraction_id: str):
      doc = supabase.table('documents').select('status').eq('id', extraction_id).single().execute()
      return {"status": doc.data['status']}
  ```

- [ ] Implement CSV/JSON export endpoint

  ```python
  @app.get("/api/extractions/{extraction_id}/export")
  async def export_extraction(
      extraction_id: str,
      format: str = 'csv',
      user_id: str = Depends(get_current_user)
  ):
      extraction = supabase.table('extractions').select('*').eq('id', extraction_id).single().execute()

      if format == 'csv':
          csv_data = convert_to_csv(extraction.data['extracted_fields'])
          return Response(content=csv_data, media_type='text/csv')
      else:
          return extraction.data['extracted_fields']
  ```

### Document Endpoints (Day 10)

- [ ] Implement GET /api/documents (list with pagination)

  ```python
  @app.get("/api/documents")
  async def list_documents(
      limit: int = 20,
      offset: int = 0,
      status: str = None,
      user_id: str = Depends(get_current_user)
  ):
      query = supabase.table('documents').select('''
          id, filename, status, uploaded_at, mode,
          extractions!inner(extracted_fields, confidence_scores)
      ''').eq('user_id', user_id)

      if status:
          query = query.eq('status', status)

      result = query.order('uploaded_at', desc=True).range(offset, offset + limit - 1).execute()
      return result.data
  ```

- [ ] Implement GET /api/documents/{document_id}
- [ ] Implement DELETE /api/documents/{document_id}

**Week 2 Checkpoint:**
✅ File upload to Supabase Storage working
✅ Docling OCR extracting text from PDFs/images
✅ Claude extracting structured data (auto + custom modes)
✅ Background processing working
✅ Extractions saved to database
✅ All backend endpoints implemented

---

## Phase 3: Frontend MVP (Week 2-3, Days 11-18)

**Goal:** Build Next.js frontend with document library, upload flow, and extraction results display.

**Deliverable:** User can sign up, upload documents, see extraction results, edit, and download CSV.

### Project Setup (Day 11)

- [ ] Initialize Next.js project

  ```bash
  npx create-next-app@latest frontend --typescript --tailwind --app
  cd frontend
  npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
  ```

- [ ] Create project structure

  ```
  frontend/
    app/
      (auth)/
        login/
          page.tsx
        signup/
          page.tsx
      dashboard/
        page.tsx          # Document library
        [documentId]/
          page.tsx        # Document detail view
      layout.tsx
      page.tsx            # Landing page
    components/
      DocumentCard.tsx
      DocumentGrid.tsx
      UploadModal.tsx
      EditModal.tsx
      Header.tsx
    lib/
      supabase.ts         # Supabase client
      api.ts              # Backend API client
    .env.local
  ```

- [ ] Set up Supabase client

  ```typescript
  // lib/supabase.ts
  import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

  export const supabase = createClientComponentClient();
  ```

- [ ] Create API client wrapper

  ```typescript
  // lib/api.ts
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  export async function uploadDocument(
    file: File,
    mode: string,
    customFields?: string[]
  ) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    if (customFields) {
      formData.append("custom_fields", JSON.stringify(customFields));
    }

    const response = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${await getSessionToken()}`,
      },
    });

    return response.json();
  }
  ```

### Authentication (Day 11-12)

- [ ] Build login page

  - Email/password form
  - Call Supabase Auth signInWithPassword()
  - Redirect to /dashboard on success
  - Show error messages

- [ ] Build signup page

  - Email/password form
  - Call Supabase Auth signUp()
  - Auto-login after signup
  - Redirect to /dashboard

- [ ] Add protected route middleware

  ```typescript
  // middleware.ts
  export async function middleware(request: NextRequest) {
    const supabase = createMiddlewareClient({ req: request });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }
  ```

- [ ] Add logout button in header
- [ ] Test auth flow (signup → login → logout → redirect)

### Upload Flow (Day 12-13)

- [ ] Build mode selection screen

  ```typescript
  // components/ModeSelection.tsx
  type Mode = "auto" | "custom";

  function ModeSelection({ onSelect }: { onSelect: (mode: Mode) => void }) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => onSelect("auto")}>
          Auto Extract
          <p>Let AI extract all relevant fields</p>
        </button>
        <button onClick={() => onSelect("custom")}>
          Custom Fields
          <p>Specify which fields to extract</p>
        </button>
      </div>
    );
  }
  ```

- [ ] Build custom fields input form

  ```typescript
  // components/CustomFieldsForm.tsx
  function CustomFieldsForm({
    onSubmit,
  }: {
    onSubmit: (fields: string[]) => void;
  }) {
    const [fields, setFields] = useState<string[]>([""]);

    const addField = () => setFields([...fields, ""]);
    const removeField = (index: number) =>
      setFields(fields.filter((_, i) => i !== index));
    const updateField = (index: number, value: string) => {
      const newFields = [...fields];
      newFields[index] = value;
      setFields(newFields);
    };

    return (
      <div>
        {fields.map((field, index) => (
          <div key={index}>
            <input
              value={field}
              onChange={(e) => updateField(index, e.target.value)}
              placeholder="Field name (e.g., vendor_name)"
            />
            <button onClick={() => removeField(index)}>Remove</button>
          </div>
        ))}
        <button onClick={addField}>+ Add Field</button>
        <button onClick={() => onSubmit(fields.filter((f) => f.trim()))}>
          Continue to Upload
        </button>
      </div>
    );
  }
  ```

- [ ] Build file upload component

  ```typescript
  // components/UploadModal.tsx
  function UploadModal({
    mode,
    customFields,
  }: {
    mode: Mode;
    customFields?: string[];
  }) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleUpload = async () => {
      if (!file) return;
      setUploading(true);

      try {
        const result = await uploadDocument(file, mode, customFields);
        // Redirect to document page or start polling
        router.push(`/dashboard/${result.document_id}`);
      } catch (error) {
        alert("Upload failed");
      } finally {
        setUploading(false);
      }
    };

    return (
      <div>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
        {/* Or drag-and-drop zone */}
        <button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Upload & Extract"}
        </button>
      </div>
    );
  }
  ```

- [ ] Test upload flow
  - Select auto mode → upload file → verify redirects
  - Select custom mode → enter fields → upload → verify custom_fields sent

### Document Library (Day 14-15)

- [ ] Build document grid component

  ```typescript
  // components/DocumentGrid.tsx
  function DocumentGrid({ documents }: { documents: Document[] }) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} />
        ))}
      </div>
    );
  }
  ```

- [ ] Build document card component

  ```typescript
  // components/DocumentCard.tsx
  function DocumentCard({ document }: { document: Document }) {
    const extraction = document.extractions?.[0]; // Latest extraction

    return (
      <Link href={`/dashboard/${document.id}`}>
        <div className="border rounded-lg p-4 hover:shadow-lg">
          {/* Thumbnail */}
          <img src={document.thumbnail_url} alt={document.filename} />

          {/* Filename */}
          <h3>{document.filename}</h3>

          {/* Status badge */}
          <span className={`badge ${document.status}`}>{document.status}</span>

          {/* Preview fields */}
          {extraction && (
            <div className="mt-2 text-sm text-gray-600">
              <p>Vendor: {extraction.extracted_fields.vendor_name}</p>
              <p>Amount: {extraction.extracted_fields.total_amount}</p>
              <p>Date: {extraction.extracted_fields.invoice_date}</p>
            </div>
          )}

          {/* Upload date */}
          <p className="text-xs text-gray-400">
            {new Date(document.uploaded_at).toLocaleDateString()}
          </p>
        </div>
      </Link>
    );
  }
  ```

- [ ] Build dashboard page

  ```typescript
  // app/dashboard/page.tsx
  export default async function DashboardPage() {
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Fetch documents from backend
    const documents = await fetch(`${API_URL}/api/documents`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then((res) => res.json());

    return (
      <div>
        <Header />
        <button onClick={() => setShowUploadModal(true)}>
          + Upload Document
        </button>
        <DocumentGrid documents={documents} />
      </div>
    );
  }
  ```

- [ ] Add filters and search

  - Filter by status (all/processing/completed/failed)
  - Search by filename
  - Pagination controls

- [ ] Add usage indicator

  ```typescript
  // components/UsageIndicator.tsx
  function UsageIndicator() {
    const { data: usage } = useSWR("/api/usage/current");

    return (
      <div>
        <p>
          {usage.documents_processed} / {usage.limit} documents used
        </p>
        <progress value={usage.documents_processed} max={usage.limit} />
        {usage.documents_processed >= usage.limit && (
          <p>Limit reached. Upgrade to process more documents.</p>
        )}
      </div>
    );
  }
  ```

### Document Detail View (Day 16-17)

- [ ] Build document detail page

  ```typescript
  // app/dashboard/[documentId]/page.tsx
  export default async function DocumentPage({
    params,
  }: {
    params: { documentId: string };
  }) {
    const document = await fetchDocument(params.documentId);
    const extraction = document.extractions.find((e) => e.is_latest);

    // If status is 'processing', poll for completion
    if (document.status === "processing") {
      return <ProcessingView documentId={params.documentId} />;
    }

    return (
      <div>
        {/* Document info */}
        <h1>{document.filename}</h1>
        <p>Uploaded: {document.uploaded_at}</p>
        <p>Mode: {document.mode}</p>

        {/* Extraction results */}
        <ExtractionResults extraction={extraction} />

        {/* Actions */}
        <button onClick={() => setShowEditModal(true)}>Edit</button>
        <button onClick={downloadCSV}>Download CSV</button>
        <button onClick={downloadJSON}>Download JSON</button>
        <button onClick={() => setShowReExtractModal(true)}>Re-extract</button>
      </div>
    );
  }
  ```

- [ ] Build extraction results display

  ```typescript
  // components/ExtractionResults.tsx
  function ExtractionResults({ extraction }: { extraction: Extraction }) {
    return (
      <div className="space-y-4">
        {Object.entries(extraction.extracted_fields).map(([key, value]) => (
          <div key={key} className="border-b pb-2">
            <label className="font-semibold">{formatFieldName(key)}</label>
            <p>{formatFieldValue(value)}</p>

            {/* Confidence indicator */}
            {extraction.confidence_scores[key] && (
              <div className="flex items-center gap-2">
                <progress value={extraction.confidence_scores[key]} max={1} />
                <span>
                  {(extraction.confidence_scores[key] * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  ```

- [ ] Build processing/polling view

  ```typescript
  // components/ProcessingView.tsx
  function ProcessingView({ documentId }: { documentId: string }) {
    const [status, setStatus] = useState("processing");

    useEffect(() => {
      const interval = setInterval(async () => {
        const { status: newStatus } = await fetch(
          `/api/extractions/${documentId}/status`
        ).then((res) => res.json());

        setStatus(newStatus);

        if (newStatus === "completed" || newStatus === "failed") {
          clearInterval(interval);
          router.refresh(); // Reload page with results
        }
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }, [documentId]);

    return (
      <div className="text-center">
        <Spinner />
        <p>Extracting data from your document...</p>
        <p className="text-sm text-gray-500">
          This usually takes 20-30 seconds
        </p>
      </div>
    );
  }
  ```

### Edit & Export (Day 17-18)

- [ ] Build edit modal

  ```typescript
  // components/EditModal.tsx
  function EditModal({
    extraction,
    onSave,
  }: {
    extraction: Extraction;
    onSave: (fields: any) => void;
  }) {
    const [fields, setFields] = useState(extraction.extracted_fields);

    const handleSave = async () => {
      await fetch(`/api/extractions/${extraction.id}`, {
        method: "PUT",
        body: JSON.stringify(fields),
      });
      onSave(fields);
    };

    return (
      <Modal>
        <h2>Edit Extraction</h2>
        <form>
          {Object.entries(fields).map(([key, value]) => (
            <div key={key}>
              <label>{formatFieldName(key)}</label>
              <input
                value={value as string}
                onChange={(e) =>
                  setFields({ ...fields, [key]: e.target.value })
                }
              />
            </div>
          ))}
        </form>
        <button onClick={handleSave}>Save Changes</button>
      </Modal>
    );
  }
  ```

- [ ] Implement CSV download

  ```typescript
  async function downloadCSV(extractionId: string) {
    const response = await fetch(
      `${API_URL}/api/extractions/${extractionId}/export?format=csv`
    );
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extraction_${extractionId}.csv`;
    a.click();
  }
  ```

- [ ] Implement JSON download
- [ ] Add re-extract modal (select new mode, trigger new extraction)

### Polish & Testing (Day 18)

- [ ] Add loading states everywhere (skeletons, spinners)
- [ ] Add error states (failed extractions, network errors)
- [ ] Add empty states ("No documents yet")
- [ ] Mobile responsive design (test on phone)
- [ ] Add confirmation dialogs (delete document)
- [ ] Test full user flow end-to-end

**Week 3 Checkpoint:**
✅ User can sign up and log in
✅ User can upload documents (auto + custom modes)
✅ Document library displays all documents in grid
✅ User can view extraction results
✅ User can edit extracted fields
✅ User can download CSV/JSON
✅ Usage limits enforced (5 free docs)

---

## Phase 4: Launch & Stripe Integration (Week 3-4, Days 19-25)

**Goal:** Soft launch free beta, collect feedback, then add Stripe for paid tiers.

**Deliverable:** 10 beta users using product, Stripe integration live, paid customers.

### Soft Launch Prep (Day 19-20)

- [ ] Deploy to production

  - Backend: Railway/Render production environment
  - Frontend: Vercel production deployment
  - Set production environment variables
  - Test production deployment

- [ ] Set up error tracking

  - Add Sentry (or similar) to backend
  - Add Sentry to frontend
  - Test error reporting

- [ ] Set up analytics

  - Add Plausible or Google Analytics
  - Track key events: signup, upload, extraction_complete, download

- [ ] Create simple landing page

  - Value proposition
  - Screenshot/demo GIF
  - Sign up CTA

- [ ] Write launch announcement
  - Twitter thread
  - Reddit post (r/smallbusiness, r/SideProject)
  - Email to small business owners you know

### Beta Launch (Day 20-21)

- [ ] Recruit 5-10 beta testers

  - Post on Reddit
  - Post on Twitter
  - Email small business owners
  - Personal network

- [ ] Send onboarding emails

  - Welcome email with quick start guide
  - Offer personal onboarding call

- [ ] Collect feedback

  - Set up feedback form (Typeform or Google Form)
  - Schedule 1:1 calls with 3-5 users
  - Ask:
    - What documents are you processing?
    - How accurate is the extraction?
    - What would make this more useful?
    - Would you pay for this? How much?

- [ ] Monitor usage and errors
  - Check Sentry for errors
  - Watch analytics for drop-off points
  - Track extraction accuracy (manual review)

### Iterate Based on Feedback (Day 21-22)

- [ ] Fix top 3 bugs reported by users
- [ ] Improve extraction accuracy if needed

  - Adjust prompts
  - Test different confidence thresholds
  - Add retry logic for low-confidence fields

- [ ] Add quick wins from feedback
  - "Can you add X field to auto extraction?"
  - "CSV format doesn't import to Xero correctly"
  - "Add keyboard shortcut for upload"

### Stripe Integration (Day 23-25)

- [ ] Set up Stripe account

  - Create Stripe account
  - Get API keys (test + live)
  - Create products:
    - Starter: $20/month, 1000 docs
    - Professional: $50/month, 5000 docs

- [ ] Add Stripe to backend

  ```bash
  pip install stripe
  ```

- [ ] Create checkout session endpoint

  ```python
  import stripe

  @app.post("/api/create-checkout-session")
  async def create_checkout_session(
      tier: str,
      user_id: str = Depends(get_current_user)
  ):
      session = stripe.checkout.Session.create(
          customer_email=user.email,
          payment_method_types=['card'],
          line_items=[{
              'price': PRICE_IDS[tier],  # Stripe price ID
              'quantity': 1,
          }],
          mode='subscription',
          success_url=f'{FRONTEND_URL}/dashboard?payment=success',
          cancel_url=f'{FRONTEND_URL}/dashboard?payment=cancelled',
      )

      return {"checkout_url": session.url}
  ```

- [ ] Add webhook handler for subscription events

  ```python
  @app.post("/api/webhooks/stripe")
  async def stripe_webhook(request: Request):
      payload = await request.body()
      sig_header = request.headers.get('stripe-signature')

      event = stripe.Webhook.construct_event(
          payload, sig_header, STRIPE_WEBHOOK_SECRET
      )

      if event['type'] == 'checkout.session.completed':
          # Update user's tier in usage_tracking
          session = event['data']['object']
          customer_email = session['customer_email']
          # Find user by email, update tier to 'starter' or 'professional'

      return {"received": True}
  ```

- [ ] Build upgrade flow in frontend

  ```typescript
  // components/UpgradeModal.tsx
  function UpgradeModal() {
    const handleUpgrade = async (tier: string) => {
      const { checkout_url } = await fetch("/api/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ tier }),
      }).then((res) => res.json());

      // Redirect to Stripe Checkout
      window.location.href = checkout_url;
    };

    return (
      <div>
        <h2>Upgrade Your Plan</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border p-4">
            <h3>Starter</h3>
            <p>$20/month</p>
            <p>1,000 documents</p>
            <button onClick={() => handleUpgrade("starter")}>
              Upgrade to Starter
            </button>
          </div>
          <div className="border p-4">
            <h3>Professional</h3>
            <p>$50/month</p>
            <p>5,000 documents</p>
            <button onClick={() => handleUpgrade("professional")}>
              Upgrade to Professional
            </button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] Show upgrade prompt when limit reached

  - Intercept upload when usage >= limit
  - Show modal: "You've used all 5 free documents. Upgrade to continue."

- [ ] Add billing dashboard page

  - Show current plan
  - Show usage this month
  - Button to manage subscription (Stripe customer portal)

- [ ] Test Stripe flow end-to-end
  - Use Stripe test mode
  - Complete checkout
  - Verify tier updated in database
  - Verify limit increased
  - Test cancellation

**Week 4 Checkpoint:**
✅ 10 beta users have used the product
✅ Collected feedback and fixed top issues
✅ Stripe integration working
✅ Paid upgrade flow tested
✅ Ready for public launch

---

## Success Criteria

**Week 3 (Soft Launch):**

- [ ] 10 signups
- [ ] 50 documents processed
- [ ] > 80% extraction accuracy (measured via user edits)
- [ ] 5+ users return within 7 days

**Week 4 (Stripe Launch):**

- [ ] 2-3 paid customers
- [ ] $40-150 MRR
- [ ] Positive feedback (users say it saves them time)
- [ ] No P0 bugs in production

**Month 2 (Post-Launch):**

- [ ] 25 active users
- [ ] $100-500 MRR
- [ ] 10%+ free → paid conversion
- [ ] Clear feature requests from users

---

## Risk Mitigation

**Common Risks:**

1. **Docling fails on certain PDFs**

   - Mitigation: Add fallback to Claude Vision (send image directly)
   - Test with wide variety of document types

2. **Extraction accuracy too low (<80%)**

   - Mitigation: Iterate on prompts, test different models
   - Add confidence thresholding (flag low-confidence fields)
   - Collect user feedback on errors

3. **Takes longer than 3 weeks**

   - Mitigation: Cut P1 features (batch upload, saved templates)
   - Launch with just auto mode (skip custom fields)
   - Add Stripe later (free beta first)

4. **No users sign up**

   - Mitigation: Interview beta users before launch
   - Validate CSV export fits their workflow
   - Consider adding Xero integration earlier

5. **Backend processing too slow (>30 seconds)**
   - Mitigation: Optimize Docling (use faster model)
   - Cache OCR results
   - Move to Celery if BackgroundTasks insufficient

---

## Post-MVP Roadmap (Month 2+)

**If MVP succeeds (paying customers, positive feedback):**

### Priority 1 Features (Month 2)

- [ ] Batch upload (process 50 documents at once)
- [ ] Saved templates (reusable custom field configs)
- [ ] Improved CSV format (match Xero import specs)
- [ ] Email forwarding (forward invoices → auto-process)

### Priority 2 Features (Month 3)

- [ ] Xero integration (OAuth + push data directly)
- [ ] QuickBooks integration
- [ ] API access (programmatic extraction)
- [ ] Webhook notifications (extraction complete)

### Priority 3 Features (Month 4+)

- [ ] Team accounts (share document library)
- [ ] Schema learning system (from spike)
- [ ] AI-suggested templates based on document type
- [ ] Advanced analytics dashboard

---

## Related Documentation

- **Functional requirements**: `planning/PRD.md`
- **Architecture & data flow**: `planning/ARCHITECTURE.md`
- **Database schema**: `planning/SCHEMA.md`
