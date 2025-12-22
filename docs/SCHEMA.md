# Database Schema

**Product:** StackDocs MVP - Document Data Extractor
**Version:** 1.1
**Last Updated:** 2025-12-22
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
    status VARCHAR(20) DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    session_id VARCHAR,                      -- Claude Agent SDK session for corrections
    uploaded_at TIMESTAMP DEFAULT NOW()
);
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
    model VARCHAR NOT NULL,                  -- e.g., 'mistral-ocr-latest'
    ocr_engine VARCHAR(20) DEFAULT 'mistral',

    created_at TIMESTAMP DEFAULT NOW()
);
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
    model VARCHAR NOT NULL,                  -- 'claude-haiku-4-5' or 'claude-agent-sdk'
    processing_time_ms INTEGER NOT NULL,
    session_id VARCHAR,                      -- Agent SDK session ID
    is_correction BOOLEAN DEFAULT false,     -- True if created via /api/agent/correct
    status VARCHAR(20) DEFAULT 'completed',  -- pending, in_progress, completed, failed

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
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
    name VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'active',         -- 'active', 'archived'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `stack_documents`

Links documents to stacks (many-to-many).

```sql
CREATE TABLE stack_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stack_id UUID NOT NULL REFERENCES stacks(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    added_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `stack_tables`

Table definitions within stacks. Stores column schema and extraction session.

```sql
CREATE TABLE stack_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stack_id UUID NOT NULL REFERENCES stacks(id),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',  -- Clerk user ID

    -- Table definition
    name VARCHAR NOT NULL DEFAULT 'Master Data',
    mode VARCHAR NOT NULL DEFAULT 'auto',    -- 'auto' or 'custom'
    custom_columns TEXT[],                   -- User-specified column names
    columns JSONB,                           -- Defined columns after extraction

    -- Session & status
    session_id VARCHAR,                      -- Agent SDK session for corrections
    status VARCHAR DEFAULT 'pending',        -- 'pending', 'processing', 'completed', 'failed'

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
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
    updated_at TIMESTAMP DEFAULT NOW()
);
```

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
