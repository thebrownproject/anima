# Database Schema

**Product:** StackDocs MVP - Document Data Extractor
**Version:** 1.0 (Simplified)
**Last Updated:** 2025-11-03
**Database:** Supabase PostgreSQL

---

## Overview

This document describes the database schema for StackDocs MVP. The design prioritizes simplicity for rapid MVP development.

**Key Principles:**
1. **Lean schema**: 3 tables total (users, documents, extractions)
2. **Current state only**: Track current month usage, not historical data
3. **Date-based sorting**: Latest extraction = most recent by timestamp
4. **JSONB flexibility**: `extracted_fields` supports any document type
5. **Security first**: Row-Level Security (RLS) on all tables

---

## Tables

1. **`users`** - User profiles with integrated usage tracking
2. **`documents`** - Uploaded file metadata and processing status
3. **`extractions`** - AI-extracted structured data (multiple per document)

---

## Table: `users`

User profiles linked to Supabase Auth, with current month usage tracking integrated.

### Schema

```sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,

    -- Usage tracking (current month only)
    documents_processed_this_month INTEGER DEFAULT 0,
    usage_reset_date DATE DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),

    -- Subscription
    subscription_tier VARCHAR(20) DEFAULT 'free',
    documents_limit INTEGER DEFAULT 5,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_reset_date ON public.users(usage_reset_date);
```

### Column Descriptions

- **`id`**: UUID linked to `auth.users(id)` - Supabase Auth manages authentication
- **`email`**: User's email address (copied from auth.users for convenience)
- **`documents_processed_this_month`**: Counter for current month (resets monthly)
- **`usage_reset_date`**: When to reset the counter (1st of next month)
- **`subscription_tier`**: Current subscription level
  - `'free'` - 5 documents/month (default)
  - `'starter'` - 1000 documents/month ($20/month)
  - `'professional'` - 5000 documents/month ($50/month)
- **`documents_limit`**: How many documents allowed this month (based on tier)
- **`created_at`**: Account creation timestamp

### Design Decisions

**Why merge usage tracking into users table?**
- MVP only needs current month data, not historical analytics
- Simplifies queries (no JOIN needed)
- Can always add separate `usage_history` table later if needed
- Faster to implement and understand

**Usage reset logic:**
```sql
-- Check on each upload or via cron job
UPDATE users
SET documents_processed_this_month = 0,
    usage_reset_date = DATE_TRUNC('month', NOW() + INTERVAL '1 month')
WHERE NOW() >= usage_reset_date;
```

---

## Table: `documents`

Metadata about uploaded documents and their processing status.

### Schema

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'processing',
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_user_id ON documents(user_id, uploaded_at DESC);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_user_status ON documents(user_id, status);
```

### Column Descriptions

- **`id`**: Unique document identifier
- **`user_id`**: Who owns this document (FK to users.id)
- **`filename`**: Original filename (e.g., "invoice_acme_nov_2025.pdf")
- **`file_path`**: Supabase Storage path (e.g., "documents/{user_id}/{doc_id}.pdf")
- **`file_size_bytes`**: File size for storage tracking
- **`mime_type`**: File type for validation and display
  - `"application/pdf"` - PDF documents
  - `"image/jpeg"` - JPEG images
  - `"image/png"` - PNG images
- **`mode`**: Extraction mode selected at upload
  - `"auto"` - AI decides what fields to extract
  - `"custom"` - User specified field names
- **`status`**: Processing state
  - `"processing"` - Extraction in progress (background task running)
  - `"completed"` - Extraction finished successfully
  - `"failed"` - Extraction failed (OCR error, LLM timeout, etc.)
- **`uploaded_at`**: Upload timestamp (for sorting)

### Common Queries

**Get user's documents (document library):**
```sql
SELECT d.*,
       e.extracted_fields
FROM documents d
LEFT JOIN LATERAL (
    SELECT extracted_fields, confidence_scores
    FROM extractions
    WHERE document_id = d.id
    ORDER BY created_at DESC
    LIMIT 1
) e ON true
WHERE d.user_id = $1
ORDER BY d.uploaded_at DESC;
```

**Check if document still processing:**
```sql
SELECT status FROM documents WHERE id = $1;
```

---

## Table: `extractions`

AI-extracted structured data from documents. Multiple extractions per document supported (re-extraction).

### Schema

```sql
CREATE TABLE extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    extracted_fields JSONB NOT NULL,
    confidence_scores JSONB,
    mode VARCHAR(20) NOT NULL,
    custom_fields TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_extractions_document_id ON extractions(document_id, created_at DESC);
CREATE INDEX idx_extractions_user_id ON extractions(user_id, created_at DESC);
CREATE INDEX idx_extractions_fields ON extractions USING GIN (extracted_fields);
```

### Column Descriptions

- **`id`**: Unique extraction identifier
- **`document_id`**: Which document this extraction is for (FK to documents.id)
- **`user_id`**: Who owns this extraction (denormalized for faster queries)
- **`extracted_fields`**: The structured data extracted by AI (JSONB)
  - Example (invoice):
    ```json
    {
      "vendor_name": "Acme Corp",
      "invoice_number": "INV-2025-001",
      "invoice_date": "2025-11-01",
      "total_amount": 1250.00,
      "currency": "AUD"
    }
    ```
  - Example (receipt):
    ```json
    {
      "merchant_name": "Coffee Shop",
      "date": "2025-11-02",
      "total": 8.50,
      "items": ["Latte", "Muffin"]
    }
    ```
- **`confidence_scores`**: AI confidence per field (0.0-1.0)
  - Example:
    ```json
    {
      "vendor_name": 0.95,
      "invoice_date": 0.98,
      "total_amount": 0.92
    }
    ```
  - Use for UI: Show "High confidence" (green) vs "Low confidence" (yellow)
- **`mode`**: Which extraction mode was used (`"auto"` or `"custom"`)
- **`custom_fields`**: Array of field names if mode='custom', NULL otherwise
  - Example: `["vendor_name", "invoice_date", "total_amount"]`
- **`created_at`**: When extraction was performed
- **`updated_at`**: Last time user edited the extracted data

### Design Decisions

**Why no `is_latest` flag?**
- For MVP, "latest extraction" = most recent by `created_at`
- Simpler than managing boolean flag
- Query: `ORDER BY created_at DESC LIMIT 1`
- Can add "pin extraction" feature later if users request it

**Why denormalize `user_id`?**
- Faster queries (no JOIN through documents table)
- RLS policies can enforce directly on extractions table

### Common Queries

**Get latest extraction for document:**
```sql
SELECT *
FROM extractions
WHERE document_id = $1
ORDER BY created_at DESC
LIMIT 1;
```

**Get extraction history for document:**
```sql
SELECT *
FROM extractions
WHERE document_id = $1
ORDER BY created_at DESC;
```

**User edits extracted data:**
```sql
UPDATE extractions
SET extracted_fields = $2,
    updated_at = NOW()
WHERE id = $1 AND user_id = $3;
```

---

## Row-Level Security (RLS)

All tables have RLS enabled to ensure users can only access their own data.

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY users_user_isolation ON public.users
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Users can only see their own documents
CREATE POLICY documents_user_isolation ON documents
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can only see their own extractions
CREATE POLICY extractions_user_isolation ON extractions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Security Benefits:**
- Database-level enforcement (impossible to bypass)
- Even if JWT token is compromised, user can't access other users' data
- Backend doesn't need to manually filter by `user_id` in queries

---

## Indexes

### Performance-Critical

- **`documents(user_id, uploaded_at DESC)`** - Document library sorted by date
- **`extractions(document_id, created_at DESC)`** - Latest extraction lookup
- **`extractions.extracted_fields (GIN)`** - Fast JSON field searches

### Supporting Indexes

- **`documents(status)`** - Filter by processing status
- **`documents(user_id, status)`** - User's processing documents
- **`users(usage_reset_date)`** - Monthly reset cron job

---

## Triggers

### Auto-create User Profile

When new user signs up via Supabase Auth, automatically create their profile:

```sql
CREATE OR REPLACE FUNCTION create_public_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_public_user();
```

**Why:**
- Users table stays in sync with auth.users automatically
- No need to manually create user profiles in application code
- New users start with default free tier (5 docs/month)

---

## Migrations

### Initial Schema (001)

Complete migration SQL is in `backend/migrations/001_initial_schema.sql`.

To apply:
1. Via MCP: `supabase.apply_migration(project_id, name, query)`
2. Via Supabase Dashboard: Copy SQL to SQL Editor and run
3. Via Supabase CLI: `supabase db push`

---

## Data Access Patterns

### Pattern 1: Check Usage Limit (Before Upload)

```sql
SELECT
    documents_processed_this_month,
    documents_limit,
    usage_reset_date
FROM users
WHERE id = $1;
```

**Logic:**
- If `documents_processed_this_month >= documents_limit`: Block upload, show upgrade prompt
- If `NOW() >= usage_reset_date`: Reset counter first, then allow upload
- Else: Allow upload, increment counter

### Pattern 2: Display Document Library

```sql
SELECT
    d.id,
    d.filename,
    d.status,
    d.uploaded_at,
    d.mode,
    (SELECT extracted_fields
     FROM extractions
     WHERE document_id = d.id
     ORDER BY created_at DESC
     LIMIT 1) as latest_extraction
FROM documents d
WHERE d.user_id = $1
ORDER BY d.uploaded_at DESC;
```

### Pattern 3: Re-extraction Workflow

```sql
-- Create new extraction (keeps old ones for history)
INSERT INTO extractions (
    document_id,
    user_id,
    extracted_fields,
    confidence_scores,
    mode,
    custom_fields
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;

-- Latest extraction is automatically the newest by created_at
```

### Pattern 4: Monthly Usage Reset (Cron Job)

```sql
-- Reset all users whose usage_reset_date has passed
UPDATE users
SET documents_processed_this_month = 0,
    usage_reset_date = DATE_TRUNC('month', NOW() + INTERVAL '1 month')
WHERE NOW() >= usage_reset_date;
```

---

## Future Considerations

### Post-MVP Enhancements

**If you need usage analytics:**
- Add `usage_history` table to track monthly stats
- Keep current `users.documents_processed_this_month` for limits

**If you need "pin extraction" feature:**
- Add `is_latest BOOLEAN` to extractions table
- Update queries to use `WHERE is_latest = true` instead of date sorting

**If you scale beyond free tier tracking:**
- Add `stripe_customer_id`, `stripe_subscription_id` to users table
- Add `subscription_status` (`'active'`, `'canceled'`, `'past_due'`)

**If you need detailed error tracking:**
- Add `error_logs` table with extraction failures, stack traces
- Helps debug OCR/LLM issues

---

## Schema Comparison: Original vs Simplified

### What Changed

**Removed:**
- ❌ Separate `usage_tracking` table → Merged into `users`
- ❌ `is_latest` flag → Use date sorting
- ❌ `processed_at` → Use `extractions.created_at`
- ❌ `processing_time_ms` → Not needed for MVP
- ❌ `error_message` → Not needed for MVP

**Kept:**
- ✅ `confidence_scores` → Useful for UX
- ✅ `updated_at` → Needed if users edit extractions
- ✅ `file_size_bytes`, `mime_type` → Useful for validation

**Result:**
- 3 tables instead of 4
- Simpler queries (fewer JOINs)
- Faster to implement
- Still supports all P0 MVP features

---

## Testing Checklist

- [ ] Create test user via Supabase Auth → Verify `public.users` row created automatically
- [ ] Upload document → Verify `documents_processed_this_month` increments
- [ ] Try to exceed limit (5 docs) → Verify upload blocked
- [ ] Create extraction → Verify RLS prevents access from other user
- [ ] Re-extract document → Verify latest extraction returned by date sort
- [ ] Edit extraction → Verify `updated_at` timestamp changes

---

**End of Schema Documentation**
