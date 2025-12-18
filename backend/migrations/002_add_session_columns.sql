-- Migration: Add session_id columns for Agent SDK
-- Purpose: Store Claude session IDs for conversation resume
-- Date: 2024-12-18

-- Add session_id to documents table (for easy lookup during corrections)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS session_id VARCHAR(50);

COMMENT ON COLUMN documents.session_id IS 'Claude Agent SDK session ID for conversation resume';

-- Add session_id to extractions table (to track which session produced each extraction)
ALTER TABLE extractions
ADD COLUMN IF NOT EXISTS session_id VARCHAR(50);

COMMENT ON COLUMN extractions.session_id IS 'Claude Agent SDK session ID that produced this extraction';

-- Add is_correction flag to extractions (to distinguish corrections from fresh extractions)
ALTER TABLE extractions
ADD COLUMN IF NOT EXISTS is_correction BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN extractions.is_correction IS 'True if this extraction was a correction via session resume';

-- Add model column if not exists (to track which model/SDK was used)
-- Note: This column may already exist from previous migrations
ALTER TABLE extractions
ADD COLUMN IF NOT EXISTS model VARCHAR(50);

COMMENT ON COLUMN extractions.model IS 'Model or SDK used for extraction (e.g., claude-haiku-4-5, claude-agent-sdk)';

-- Add processing_time_ms column if not exists
ALTER TABLE extractions
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

COMMENT ON COLUMN extractions.processing_time_ms IS 'Time taken for extraction in milliseconds';

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_extractions_session_id ON extractions(session_id) WHERE session_id IS NOT NULL;
