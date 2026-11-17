-- 0033: Add map_url column to events
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "map_url" text;