-- 0035: Add zip (PLZ) column to events
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "zip" text;