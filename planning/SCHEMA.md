# Database Schema

**Product:** StackDocs MVP - Document Data Extractor
**Version:** 1.0
**Database:** Supabase PostgreSQL
**Date:** November 2025

---

## Document Purpose

This document defines the complete database schema for StackDocs MVP. The schema is designed to support flexible document data extraction with multiple extraction attempts per document, user isolation, and usage tracking.

**Note:** User authentication tables are managed by Supabase Auth and not documented here. We reference `auth.users` via foreign keys but don't define those tables.

---

## Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │ (Managed by Supabase Auth)
│                 │
│ - id (UUID)     │
│ - email         │
│ - created_at    │
└────────┬────────┘
         │
         │ 1:N
         │
         ├───────────────────────────────────────┐
         │                                       │
         ↓                                       ↓
┌──────────────────┐                  ┌──────────────────┐
│   documents      │                  │ usage_tracking   │
│                  │                  │                  │
│ - id (PK)        │                  │ - id (PK)        │
│ - user_id (FK)   │                  │ - user_id (FK)   │
│ - filename       │                  │ - month          │
│ - file_path      │                  │ - documents_used │
│ - status         │                  │ - limit          │
│ - mode           │                  │ - reset_date     │
│ - uploaded_at    │                  └──────────────────┘
└────────┬─────────┘
         │
         │ 1:N
         │
         ↓
┌──────────────────┐
│   extractions    │
│                  │
│ - id (PK)        │
│ - document_id(FK)│
│ - user_id (FK)   │
│ - extracted_fields (JSONB) │
│ - confidence_scores (JSONB)│
│ - mode           │
│ - custom_fields  │
│ - is_latest      │
│ - processing_time│
│ - created_at     │
└──────────────────┘
```

**Key Relationships:**
- `auth.users` → `documents` (1:N) - Users upload many documents
- `auth.users` → `usage_tracking` (1:1) - Each user has monthly usage counter
- `documents` → `extractions` (1:N) - Each document can have multiple extractions (re-extract with different modes)
- `auth.users` → `extractions` (1:N) - Track which user created each extraction

---

## Table Definitions

### documents

Stores metadata about uploaded documents (PDFs, images). Files themselves are stored in Supabase Storage.

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'processing',
    uploaded_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX idx_documents_user_id ON documents(user_id, uploaded_at DESC);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_user_status ON documents(user_id, status);
```

**Column Descriptions:**

- `id`: Unique document identifier (UUID)
- `user_id`: Owner of the document (references Supabase auth.users)
- `filename`: Original filename (e.g., "invoice_acme.pdf")
- `file_path`: Storage path in Supabase Storage (e.g., "documents/user_456/doc_123.pdf")
- `file_size_bytes`: File size for storage tracking
- `mime_type`: File MIME type (e.g., "application/pdf", "image/jpeg", "image/png")
- `mode`: Extraction mode selected at upload ("auto" or "custom")
- `status`: Processing status
  - `'processing'` - Extraction in progress
  - `'completed'` - Extraction successful
  - `'failed'` - Extraction failed (OCR error, LLM timeout, etc.)
- `uploaded_at`: When user uploaded the file
- `processed_at`: When extraction completed (NULL if still processing)

**Usage Notes:**
- CASCADE delete: Deleting user deletes all their documents
- When document deleted, also delete file from Supabase Storage (application logic)
- Status transitions: processing → completed/failed

---

### extractions

Stores extraction results. Multiple extractions can exist per document (re-extraction support).

```sql
CREATE TABLE extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    extracted_fields JSONB NOT NULL,
    confidence_scores JSONB,
    mode VARCHAR(20) NOT NULL,
    custom_fields TEXT[],
    is_latest BOOLEAN DEFAULT false,
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_extractions_document_id ON extractions(document_id, created_at DESC);
CREATE INDEX idx_extractions_user_id ON extractions(user_id, created_at DESC);
CREATE INDEX idx_extractions_latest ON extractions(document_id) WHERE is_latest = true;
CREATE INDEX idx_extractions_fields ON extractions USING GIN (extracted_fields);
```

**Column Descriptions:**

- `id`: Unique extraction identifier (UUID)
- `document_id`: Which document was extracted (references documents.id)
- `user_id`: Who performed the extraction (denormalized for faster queries)
- `extracted_fields`: Structured data extracted by AI (JSONB for flexibility)
  - Example (invoice):
    ```json
    {
      "vendor_name": "Acme Corp",
      "invoice_number": "INV-2025-001",
      "invoice_date": "2025-11-01",
      "total_amount": 1250.00,
      "currency": "AUD",
      "payment_terms": "Net 30",
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
  - Example (receipt):
    ```json
    {
      "merchant_name": "Coffee Shop",
      "date": "2025-11-02",
      "total": 8.50,
      "payment_method": "Credit Card",
      "items": [
        {"item": "Latte", "price": 5.00},
        {"item": "Muffin", "price": 3.50}
      ]
    }
    ```

- `confidence_scores`: Per-field confidence from AI (JSONB)
  - Example:
    ```json
    {
      "vendor_name": 0.95,
      "invoice_date": 0.98,
      "total_amount": 0.92,
      "line_items": 0.87
    }
    ```
  - Range: 0.0 - 1.0 (higher = more confident)

- `mode`: Extraction mode used ("auto" or "custom")
- `custom_fields`: Array of field names if mode='custom' (NULL for auto mode)
  - Example: `["vendor_name", "invoice_date", "total_amount"]`

- `is_latest`: Boolean flag - only ONE extraction per document should have is_latest=true
  - Used to display "current" extraction in UI
  - When re-extracting, set previous is_latest=false, new is_latest=true

- `processing_time_ms`: How long extraction took (milliseconds)
- `error_message`: Error details if extraction failed (NULL if successful)
- `created_at`: When extraction was performed
- `updated_at`: Last time fields were edited by user

**Usage Notes:**
- Multiple extractions per document supported (history)
- GIN index on extracted_fields enables fast JSON queries (e.g., find all invoices from "Acme Corp")
- CASCADE delete: Deleting document deletes all its extractions
- User can edit extracted_fields after creation (via PUT /api/extractions/{id})

---

### usage_tracking

Tracks monthly usage per user for free tier limits (5 docs/month).

```sql
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    documents_processed INTEGER DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'free',
    limit INTEGER DEFAULT 5,
    reset_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, month)
);

CREATE INDEX idx_usage_tracking_user_month ON usage_tracking(user_id, month DESC);
CREATE INDEX idx_usage_tracking_reset ON usage_tracking(reset_date) WHERE tier = 'free';
```

**Column Descriptions:**

- `id`: Unique tracking record identifier
- `user_id`: User being tracked
- `month`: Month this record tracks (e.g., "2025-11-01" for November 2025)
- `documents_processed`: Count of documents processed this month
- `tier`: User's subscription tier
  - `'free'` - Free tier (5 docs/month)
  - `'starter'` - Starter plan ($20/month, 1000 docs)
  - `'professional'` - Professional plan ($50/month, 5000 docs)

- `limit`: How many documents allowed this month (based on tier)
- `reset_date`: When counter resets (1st of next month)
- `created_at`: When record created
- `updated_at`: When counter last incremented

**Usage Flow:**

1. User uploads document:
   ```sql
   -- Check if user has capacity
   SELECT documents_processed, limit
   FROM usage_tracking
   WHERE user_id = 'user_456' AND month = '2025-11-01';

   -- If documents_processed < limit, allow upload and increment:
   UPDATE usage_tracking
   SET documents_processed = documents_processed + 1,
       updated_at = NOW()
   WHERE user_id = 'user_456' AND month = '2025-11-01';
   ```

2. Monthly reset (cron job):
   ```sql
   -- Create new record for next month for all users
   INSERT INTO usage_tracking (user_id, month, tier, limit, reset_date)
   SELECT user_id,
          DATE_TRUNC('month', NOW() + INTERVAL '1 month') as month,
          tier,
          CASE tier
            WHEN 'free' THEN 5
            WHEN 'starter' THEN 1000
            WHEN 'professional' THEN 5000
          END as limit,
          DATE_TRUNC('month', NOW() + INTERVAL '2 months') as reset_date
   FROM usage_tracking
   WHERE month = DATE_TRUNC('month', NOW());
   ```

**UNIQUE constraint:** Prevents duplicate tracking records for same user+month

---

## Indexes Summary

**Performance-Critical Indexes:**

- `documents.user_id, uploaded_at DESC` - Fast lookup of user's documents (document library view)
- `extractions.document_id, created_at DESC` - Fast retrieval of extraction history
- `extractions.is_latest WHERE is_latest=true` - Quick fetch of current extraction
- `extractions.extracted_fields GIN` - Fast JSON field searches

**Filtering Indexes:**

- `documents.status` - Filter by processing status
- `documents.user_id, status` - User's documents by status
- `usage_tracking.user_id, month DESC` - Current month usage

---

## Data Access Patterns

### Pattern 1: Display Document Library (Most Common)

```sql
-- Get user's documents with latest extraction preview
SELECT
    d.id as document_id,
    d.filename,
    d.status,
    d.uploaded_at,
    d.mode,
    e.extracted_fields->>'vendor_name' as vendor,
    e.extracted_fields->>'total_amount' as amount,
    e.extracted_fields->>'invoice_date' as date,
    e.confidence_scores
FROM documents d
LEFT JOIN extractions e ON e.document_id = d.id AND e.is_latest = true
WHERE d.user_id = $1
ORDER BY d.uploaded_at DESC
LIMIT 20 OFFSET $2;
```

**Performance:** Uses `idx_documents_user_id` + `idx_extractions_latest`

---

### Pattern 2: Get Full Extraction Details

```sql
-- Get extraction with all fields
SELECT
    e.id,
    e.document_id,
    e.extracted_fields,
    e.confidence_scores,
    e.mode,
    e.custom_fields,
    e.processing_time_ms,
    e.created_at,
    d.filename,
    d.file_path
FROM extractions e
JOIN documents d ON d.id = e.document_id
WHERE e.id = $1 AND e.user_id = $2;
```

**Performance:** Primary key lookup + JOIN

---

### Pattern 3: Check Usage Limit Before Upload

```sql
-- Check if user can upload
SELECT
    documents_processed,
    limit,
    (limit - documents_processed) as remaining
FROM usage_tracking
WHERE user_id = $1
  AND month = DATE_TRUNC('month', NOW());
```

**Performance:** Uses `idx_usage_tracking_user_month`

---

### Pattern 4: Search Across Extracted Fields

```sql
-- Find all documents from specific vendor
SELECT
    d.id,
    d.filename,
    e.extracted_fields->>'vendor_name' as vendor,
    e.extracted_fields->>'total_amount' as amount
FROM documents d
JOIN extractions e ON e.document_id = d.id AND e.is_latest = true
WHERE d.user_id = $1
  AND e.extracted_fields->>'vendor_name' ILIKE '%Acme%';
```

**Performance:** Uses GIN index on `extracted_fields`

---

## Row-Level Security (Supabase RLS)

Enable RLS to ensure users can only access their own data:

```sql
-- Enable RLS on all tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own documents
CREATE POLICY documents_user_isolation ON documents
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only see their own extractions
CREATE POLICY extractions_user_isolation ON extractions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only see their own usage
CREATE POLICY usage_user_isolation ON usage_tracking
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

**Security Benefits:**
- Even if JWT token is compromised, user can't access other users' data
- Backend doesn't need to manually filter by user_id in queries
- Database-level enforcement (impossible to bypass)

---

## Migrations

### Initial Schema Migration

```sql
-- Run this SQL in Supabase SQL Editor to create all tables

-- 1. Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'processing',
    uploaded_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX idx_documents_user_id ON documents(user_id, uploaded_at DESC);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_user_status ON documents(user_id, status);

-- 2. Extractions table
CREATE TABLE extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    extracted_fields JSONB NOT NULL,
    confidence_scores JSONB,
    mode VARCHAR(20) NOT NULL,
    custom_fields TEXT[],
    is_latest BOOLEAN DEFAULT false,
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_extractions_document_id ON extractions(document_id, created_at DESC);
CREATE INDEX idx_extractions_user_id ON extractions(user_id, created_at DESC);
CREATE INDEX idx_extractions_latest ON extractions(document_id) WHERE is_latest = true;
CREATE INDEX idx_extractions_fields ON extractions USING GIN (extracted_fields);

-- 3. Usage tracking table
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    documents_processed INTEGER DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'free',
    limit INTEGER DEFAULT 5,
    reset_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, month)
);

CREATE INDEX idx_usage_tracking_user_month ON usage_tracking(user_id, month DESC);
CREATE INDEX idx_usage_tracking_reset ON usage_tracking(reset_date) WHERE tier = 'free';

-- 4. Enable Row-Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY documents_user_isolation ON documents
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY extractions_user_isolation ON extractions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY usage_user_isolation ON usage_tracking
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Function to auto-create usage tracking for new users
CREATE OR REPLACE FUNCTION create_usage_tracking_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO usage_tracking (user_id, month, tier, limit, reset_date)
    VALUES (
        NEW.id,
        DATE_TRUNC('month', NOW()),
        'free',
        5,
        DATE_TRUNC('month', NOW() + INTERVAL '1 month')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_usage_tracking_for_new_user();
```

---

## Seed Data (Development/Testing)

```sql
-- Insert test documents (after authenticating as test user)
INSERT INTO documents (id, user_id, filename, file_path, file_size_bytes, mime_type, mode, status, processed_at)
VALUES
    ('doc_001', auth.uid(), 'invoice_acme.pdf', 'documents/test/doc_001.pdf', 245670, 'application/pdf', 'auto', 'completed', NOW()),
    ('doc_002', auth.uid(), 'receipt_coffee.jpg', 'documents/test/doc_002.jpg', 123456, 'image/jpeg', 'auto', 'completed', NOW()),
    ('doc_003', auth.uid(), 'contract_services.pdf', 'documents/test/doc_003.pdf', 567890, 'application/pdf', 'custom', 'processing', NULL);

-- Insert test extractions
INSERT INTO extractions (document_id, user_id, extracted_fields, confidence_scores, mode, is_latest, processing_time_ms)
VALUES
    (
        'doc_001',
        auth.uid(),
        '{"vendor_name": "Acme Corp", "invoice_date": "2025-11-01", "total_amount": 1250.00, "currency": "AUD"}',
        '{"vendor_name": 0.95, "invoice_date": 0.98, "total_amount": 0.92}',
        'auto',
        true,
        8500
    ),
    (
        'doc_002',
        auth.uid(),
        '{"merchant_name": "Coffee Shop", "date": "2025-11-02", "total": 8.50}',
        '{"merchant_name": 0.88, "date": 0.99, "total": 0.94}',
        'auto',
        true,
        5200
    );
```

---

## Future Schema Enhancements (Post-MVP)

### Saved Templates Table (P1)

```sql
CREATE TABLE extraction_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_name VARCHAR(100) NOT NULL,
    field_definitions TEXT[] NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Users save custom field configurations as reusable templates

---

### Batch Jobs Table (P1)

```sql
CREATE TABLE batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES extraction_templates(id),
    status VARCHAR(20) DEFAULT 'pending',
    total_documents INTEGER NOT NULL,
    processed_documents INTEGER DEFAULT 0,
    failed_documents INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE batch_job_documents (
    batch_job_id UUID REFERENCES batch_jobs(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (batch_job_id, document_id)
);
```

**Purpose:** Track bulk document processing jobs

---

### Document Schemas Table (Post-MVP - Schema Learning)

```sql
CREATE TABLE document_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    field_definitions JSONB NOT NULL,
    example_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, document_type)
);
```

**Purpose:** Port schema learning system from spike (AI learns field names over time)

---

## Related Documentation

- **Functional requirements**: `planning/PRD.md`
- **Architecture & data flow**: `planning/ARCHITECTURE.md`
- **Development tasks**: `planning/TASKS.md`
