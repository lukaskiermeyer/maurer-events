ALTER TABLE "public"."fest_opportunities" ADD COLUMN IF NOT EXISTS "url_hash" text;--> statement-breakpoint
ALTER TABLE "public"."fest_opportunities" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
UPDATE "public"."fest_opportunities" SET "url_hash" = encode(sha256(COALESCE("source_url_normalized", "source_url")::bytea), 'hex') WHERE "url_hash" IS NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."fest_opportunities_dedupe_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "url_hash" text NOT NULL,
  "winner_id" uuid,
  "loser_id" uuid NOT NULL,
  "loser_source_url" text,
  "loser_score" integer,
  "loser_status" text,
  "loser_notes" text,
  "merged_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
WITH winners AS (
  SELECT DISTINCT ON ("url_hash") "id" AS winner_id, "url_hash"
  FROM "public"."fest_opportunities"
  WHERE "url_hash" IS NOT NULL
  ORDER BY "url_hash", "score" DESC NULLS LAST, "updated_at" DESC NULLS LAST, "discovered_at" DESC NULLS LAST, "id" ASC
),
losers AS (
  SELECT fo."id" AS loser_id, fo."url_hash", fo."source_url", fo."score", fo."status", fo."notes"
  FROM "public"."fest_opportunities" fo
  JOIN winners w ON w."url_hash" = fo."url_hash"
  WHERE fo."id" <> w.winner_id
)
INSERT INTO "public"."fest_opportunities_dedupe_log" ("url_hash", "winner_id", "loser_id", "loser_source_url", "loser_score", "loser_status", "loser_notes")
SELECT l."url_hash", w.winner_id, l.loser_id, l."source_url", l."score", l."status", l."notes"
FROM losers l
JOIN winners w ON w."url_hash" = l."url_hash";--> statement-breakpoint
DELETE FROM "public"."fest_opportunities"
WHERE "id" IN (SELECT "loser_id" FROM "public"."fest_opportunities_dedupe_log");--> statement-breakpoint
ALTER TABLE "public"."fest_opportunities" ALTER COLUMN "url_hash" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fest_opportunities_url_hash_unique') THEN
    ALTER TABLE "public"."fest_opportunities" ADD CONSTRAINT "fest_opportunities_url_hash_unique" UNIQUE ("url_hash");
  END IF;
END $$;--> statement-breakpoint