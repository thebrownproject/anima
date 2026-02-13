-- Migration 012: Move Sprite mapping from stacks to users
-- One Sprite per USER (not per stack). Stacks become lightweight canvas layouts.
-- Applied manually via Supabase SQL Editor.

BEGIN;

-- Step 1: Add sprite columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS sprite_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sprite_status TEXT DEFAULT 'pending';

-- Step 2: Copy sprite data from stacks to users
-- Pick the active sprite if one exists, otherwise the most recently updated one.
-- DISTINCT ON (user_id) with ORDER BY ensures deterministic pick.
UPDATE users
SET sprite_name = sub.sprite_name,
    sprite_status = sub.sprite_status
FROM (
    SELECT DISTINCT ON (user_id)
        user_id, sprite_name, sprite_status
    FROM stacks
    WHERE sprite_name IS NOT NULL
    ORDER BY user_id,
        CASE WHEN sprite_status = 'active' THEN 0 ELSE 1 END,
        updated_at DESC
) sub
WHERE users.id = sub.user_id;

-- Step 3: Add new columns to stacks (status already exists from migration 004)
ALTER TABLE stacks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE stacks ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE stacks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Step 4: Drop sprite columns from stacks (now on users)
ALTER TABLE stacks DROP COLUMN IF EXISTS sprite_name;
ALTER TABLE stacks DROP COLUMN IF EXISTS sprite_status;

COMMIT;
