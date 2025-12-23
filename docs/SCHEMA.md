# Database Schema

**Product:** StackDocs MVP - Document Data Extractor
**Version:** 1.2
**Last Updated:** 2025-12-23
**Database:** Supabase PostgreSQL

---

## Overview

**Key Principles:**
1. **Lean schema**: Core tables + stacks extension
2. **Current state only**: Track current month usage, not historical data
3. **Date-based sorting**: Latest extraction = most recent by timestamp
4. **JSONB flexibility**: `extracted_fields` supports any document type
5. **Security first**: Row-Level Security (RLS) on all tables
6. **Clerk authentication**: All `user_id` columns are TEXT (Clerk IDs like `user_xxx`)

---

## Tables

**Core Tables:**
1. **`users`** - User profiles with integrated usage tracking
2. **`documents`** - Uploaded file metadata and processing status
3. **`ocr_results`** - Raw OCR text and layout data from Mistral OCR
4. **`extractions`** - AI-extracted structured data (multiple per document)

**Stacks Tables:**
5. **`stacks`** - Document groupings for batch extraction
6. **`stack_documents`** - Links documents to stacks (many-to-many)
7. **`stack_tables`** - Table definitions within stacks
8. **`stack_table_rows`** - Extracted row data for stack tables

---

## Table: `users`

User profiles with current month usage tracking. Uses Clerk user IDs (TEXT).

```sql
CREATE TABLE public.users (
    id TEXT PRIMARY KEY DEFAULT auth.jwt()->>'sub',  -- Clerk user ID
    email TEXT NOT NULL,

    -- Usage tracking (current month only)
    documents_processed_this_month INTEGER DEFAULT 0,
    usage_reset_date DATE DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),

    -- Subscription
    subscription_tier VARCHAR(20) DEFAULT 'free',
    documents_limit INTEGER DEFAULT 5,

    created_at TIMESTAMP DEFAULT NOW()
);
```


---

## Table: `documents`

Metadata about uploaded documents and their processing status.

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',  -- Clerk user ID
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,              -- 'auto' or 'custom'
    status VARCHAR(20) DEFAULT 'processing', -- 'processing', 'ocr_complete', 'completed', 'failed'
    session_id VARCHAR(50),                  -- Claude Agent SDK session for corrections
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_user_id ON documents(user_id, uploaded_at DESC);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_user_status ON documents(user_id, status);
CREATE INDEX idx_documents_session_id ON documents(session_id) WHERE session_id IS NOT NULL;
```

**Note:** `session_id` enables session resume for natural language corrections via Agent SDK.

---

## Table: `ocr_results`

Raw OCR text extracted from documents using Mistral OCR. One OCR result per document, cached for re-extraction.

```sql
CREATE TABLE ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',  -- Clerk user ID

    -- OCR output
    raw_text TEXT NOT NULL,
    html_tables JSONB,                       -- HTML table strings from OCR 3
    page_count INTEGER NOT NULL,
    layout_data JSONB,

    -- Performance & usage tracking
    processing_time_ms INTEGER NOT NULL,
    usage_info JSONB NOT NULL,
    model VARCHAR(50) NOT NULL,              -- e.g., 'mistral-ocr-latest'
    ocr_engine VARCHAR(20) DEFAULT 'mistral',

    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX ocr_results_document_id_key ON ocr_results(document_id);
CREATE INDEX idx_ocr_results_document_id ON ocr_results(document_id);
CREATE INDEX idx_ocr_results_user_id ON ocr_results(user_id, created_at DESC);
```

---

## Table: `extractions`

AI-extracted structured data from documents. Multiple extractions per document supported (re-extraction, corrections).

```sql
CREATE TABLE extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',  -- Clerk user ID

    -- Extraction data
    extracted_fields JSONB NOT NULL,
    confidence_scores JSONB,

    -- Mode & fields
    mode VARCHAR(20) NOT NULL,               -- 'auto' or 'custom'
    custom_fields TEXT[],                    -- Field names if mode='custom'

    -- Tracking
    model VARCHAR(50) NOT NULL,              -- 'claude-haiku-4-5' or 'claude-agent-sdk'
    processing_time_ms INTEGER NOT NULL,
    session_id VARCHAR(50),                  -- Agent SDK session ID
    is_correction BOOLEAN DEFAULT false,     -- True if created via /api/agent/correct
    status VARCHAR(20) DEFAULT 'completed',  -- pending, in_progress, completed, failed

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_extractions_document_id ON extractions(document_id, created_at DESC);
CREATE INDEX idx_extractions_user_id ON extractions(user_id, created_at DESC);
CREATE INDEX idx_extractions_session_id ON extractions(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_extractions_fields ON extractions USING GIN(extracted_fields);
```

**Note:** Latest extraction = most recent by `created_at`, no `is_latest` flag needed.

---

## Stacks Tables

### Table: `stacks`

Document groupings for batch extraction.

```sql
CREATE TABLE stacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',  -- Clerk user ID
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',     -- 'active', 'archived'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stacks_user_id ON stacks(user_id, created_at DESC);
```

### Table: `stack_documents`

Links documents to stacks (many-to-many).

```sql
CREATE TABLE stack_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stack_id UUID NOT NULL REFERENCES stacks(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    added_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(stack_id, document_id)  -- Prevent duplicate links
);

-- Indexes
CREATE INDEX idx_stack_documents_stack ON stack_documents(stack_id);
CREATE INDEX idx_stack_documents_document ON stack_documents(document_id);
```

### Table: `stack_tables`

Table definitions within stacks. Stores column schema and extraction session.

```sql
CREATE TABLE stack_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stack_id UUID NOT NULL REFERENCES stacks(id),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',  -- Clerk user ID

    -- Table definition
    name VARCHAR(255) NOT NULL DEFAULT 'Master Data',
    mode VARCHAR(20) NOT NULL DEFAULT 'auto', -- 'auto' or 'custom'
    custom_columns TEXT[],                   -- User-specified column names
    columns JSONB,                           -- Defined columns after extraction

    -- Session & status
    session_id VARCHAR(50),                  -- Agent SDK session for corrections
    status VARCHAR(20) DEFAULT 'pending',    -- 'pending', 'processing', 'completed', 'failed'

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stack_tables_stack ON stack_tables(stack_id);
CREATE INDEX idx_stack_tables_user ON stack_tables(user_id);
CREATE INDEX idx_stack_tables_session ON stack_tables(session_id) WHERE session_id IS NOT NULL;
```

### Table: `stack_table_rows`

Extracted row data for stack tables. One row per document in the stack.

```sql
CREATE TABLE stack_table_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES stack_tables(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',  -- Clerk user ID

    -- Row data
    row_data JSONB NOT NULL,                 -- Column values for this document
    confidence_scores JSONB,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(table_id, document_id)  -- One row per document per table
);

-- Indexes
CREATE INDEX idx_stack_table_rows_table ON stack_table_rows(table_id);
CREATE INDEX idx_stack_table_rows_document ON stack_table_rows(document_id);
CREATE INDEX idx_stack_table_rows_user ON stack_table_rows(user_id);
```

---

## RPC Functions

Database functions for surgical JSONB updates, used by agent tools.

### `update_extraction_field`

Updates a field at a JSON path in `extracted_fields` and `confidence_scores`.

```sql
CREATE OR REPLACE FUNCTION update_extraction_field(
    p_extraction_id UUID,
    p_user_id TEXT,           -- Clerk user ID
    p_field_path TEXT[],      -- e.g., ARRAY['vendor', 'name']
    p_value JSONB,
    p_confidence FLOAT
) RETURNS VOID AS $$
BEGIN
    UPDATE extractions
    SET
        extracted_fields = jsonb_set(
            COALESCE(extracted_fields, '{}'::jsonb),
            p_field_path,
            p_value,
            true  -- create_if_missing
        ),
        confidence_scores = jsonb_set(
            COALESCE(confidence_scores, '{}'::jsonb),
            p_field_path,
            to_jsonb(p_confidence),
            true
        ),
        updated_at = NOW()
    WHERE id = p_extraction_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `remove_extraction_field`

Removes a field at a JSON path from `extracted_fields` and `confidence_scores`.

```sql
CREATE OR REPLACE FUNCTION remove_extraction_field(
    p_extraction_id UUID,
    p_user_id TEXT,           -- Clerk user ID
    p_field_path TEXT[]       -- e.g., ARRAY['unwanted_field']
) RETURNS VOID AS $$
BEGIN
    UPDATE extractions
    SET
        extracted_fields = extracted_fields #- p_field_path,
        confidence_scores = confidence_scores #- p_field_path,
        updated_at = NOW()
    WHERE id = p_extraction_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Note:** Both functions use `SECURITY DEFINER` and filter by `user_id` for safety.

---

## Row-Level Security (RLS)

All tables have RLS enabled to ensure users can only access their own data.
Uses Clerk JWT tokens via Supabase's third-party auth integration.

```sql
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_table_rows ENABLE ROW LEVEL SECURITY;

-- Clerk JWT-based isolation policies
-- Uses (SELECT auth.jwt()->>'sub') for Clerk user ID extraction
CREATE POLICY users_clerk_isolation ON public.users
    FOR ALL TO authenticated
    USING ((SELECT auth.jwt()->>'sub') = id);

CREATE POLICY documents_clerk_isolation ON documents
    FOR ALL TO authenticated
    USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE POLICY ocr_results_clerk_isolation ON ocr_results
    FOR ALL TO authenticated
    USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE POLICY extractions_clerk_isolation ON extractions
    FOR ALL TO authenticated
    USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE POLICY stacks_clerk_isolation ON stacks
    FOR ALL TO authenticated
    USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE POLICY stack_documents_clerk_isolation ON stack_documents
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM stacks
        WHERE stacks.id = stack_documents.stack_id
        AND stacks.user_id = (SELECT auth.jwt()->>'sub')
    ));

CREATE POLICY stack_tables_clerk_isolation ON stack_tables
    FOR ALL TO authenticated
    USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE POLICY stack_table_rows_clerk_isolation ON stack_table_rows
    FOR ALL TO authenticated
    USING ((SELECT auth.jwt()->>'sub') = user_id);
```

---

## Storage Policies

The `documents` bucket uses folder-based isolation where each user's files are stored in `{user_id}/`.

```sql
-- SELECT: Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);

-- INSERT: Users can upload to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);

-- UPDATE: Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
)
WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);

-- DELETE: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);
```

---

## Migrations

Migration files are in `backend/migrations/`:

| Migration | Description |
|-----------|-------------|
| 001_initial_schema.sql | Core tables (users, documents, extractions) |
| 002_add_ocr_results.sql | OCR caching table |
| 003_add_extraction_metadata.sql | model, processing_time_ms columns |
| 004_add_stacks_schema.sql | Stacks tables |
| 005_remove_extraction_id_from_stack_rows.sql | Simplify stack_table_rows schema |
| 006_add_extraction_status.sql | Add status column for agent workflow |
| 007_add_extraction_rpc_functions.sql | RPC functions for JSONB field updates |
| 008_add_html_tables.sql | Add html_tables column for OCR 3 |
| 009_clerk_supabase_integration.sql | UUID→TEXT for user_id, Clerk RLS policies |

---

## Key Relationships

```
users
  └── documents (1:N)
        ├── ocr_results (1:1, cached)
        ├── extractions (1:N, history preserved)
        └── stack_documents (N:M via stacks)
              └── stacks
                    └── stack_tables (1:N)
                          └── stack_table_rows (1:N)
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE.md` | System design |
| `PRD.md` | Product requirements |
| `ROADMAP.md` | Feature priorities |
