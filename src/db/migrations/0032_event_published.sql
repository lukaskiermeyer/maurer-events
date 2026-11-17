-- 0032: Add is_published column to events (draft/live)
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT true;