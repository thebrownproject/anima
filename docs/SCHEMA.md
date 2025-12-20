# Database Schema

**Product:** StackDocs MVP - Document Data Extractor
**Version:** 1.1
**Last Updated:** 2025-12-20
**Database:** Supabase PostgreSQL

---

## Overview

**Key Principles:**
1. **Lean schema**: Core tables + stacks extension
2. **Current state only**: Track current month usage, not historical data
3. **Date-based sorting**: Latest extraction = most recent by timestamp
4. **JSONB flexibility**: `extracted_fields` supports any document type
5. **Security first**: Row-Level Security (RLS) on all tables

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

User profiles linked to Supabase Auth, with current month usage tracking integrated.

```sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
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
    user_id UUID NOT NULL REFERENCES public.users(id),
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
    user_id UUID NOT NULL REFERENCES public.users(id),

    -- OCR output
    raw_text TEXT NOT NULL,
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
    user_id UUID NOT NULL REFERENCES public.users(id),

    -- Extraction data
    extracted_fields JSONB NOT NULL,
    confidence_scores JSONB,

    -- Mode & fields
    mode VARCHAR(20) NOT NULL,               -- 'auto' or 'custom'
    custom_fields TEXT[],                    -- Field names if mode='custom'

    -- Tracking
    model VARCHAR NOT NULL,                  -- 'claude-haiku-4-5-latest' or 'claude-agent-sdk'
    processing_time_ms INTEGER NOT NULL,
    session_id VARCHAR,                      -- Agent SDK session ID
    is_correction BOOLEAN DEFAULT false,     -- True if created via /api/agent/correct

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
    user_id UUID NOT NULL REFERENCES public.users(id),
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
    user_id UUID NOT NULL REFERENCES public.users(id),

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
    user_id UUID NOT NULL REFERENCES public.users(id),

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

-- Users can only see their own data
CREATE POLICY users_isolation ON public.users
    FOR ALL USING (auth.uid() = id);

CREATE POLICY documents_isolation ON documents
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY ocr_results_isolation ON ocr_results
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY extractions_isolation ON extractions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY stacks_isolation ON stacks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY stack_tables_isolation ON stack_tables
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY stack_table_rows_isolation ON stack_table_rows
    FOR ALL USING (auth.uid() = user_id);
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
