-- Down migration for 0027_fest_opportunities_url_hash.sql
-- Removes url_hash/notes columns and the dedupe log table. Does NOT restore deduplicated legacy rows.
ALTER TABLE "public"."fest_opportunities" DROP CONSTRAINT IF EXISTS "fest_opportunities_url_hash_unique";--> statement-breakpoint
ALTER TABLE "public"."fest_opportunities" ALTER COLUMN "url_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."fest_opportunities" DROP COLUMN IF EXISTS "url_hash";--> statement-breakpoint
ALTER TABLE "public"."fest_opportunities" DROP COLUMN IF EXISTS "notes";--> statement-breakpoint
DROP TABLE IF EXISTS "public"."fest_opportunities_dedupe_log";--> statement-breakpoint