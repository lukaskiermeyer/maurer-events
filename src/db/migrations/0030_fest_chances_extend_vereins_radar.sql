-- 0030: Fest-Chancen Erweiterung (Lead-Typ, Event-Key, CRM) + Vereins-Radar Tabelle

-- fest_chances: neue Spalten
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "lead_type" text DEFAULT 'open' NOT NULL;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "event_key" text;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "event_year" integer;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "date_assumed" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "founding_year" integer;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "incumbent_festwirt" text;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "brauerei_partner" text;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "contact_role" text;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "planning_signal" text DEFAULT 'none' NOT NULL;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "recurring" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "recheck_at" timestamp;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "source_urls" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "wirt_status" text DEFAULT 'neu' NOT NULL;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "wirt_notiz" text;
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "wiedervorlage" timestamp;

CREATE INDEX IF NOT EXISTS "fest_chances_event_key_idx" ON "public"."fest_chances" USING btree ("event_key");
CREATE INDEX IF NOT EXISTS "fest_chances_lead_type_idx" ON "public"."fest_chances" USING btree ("lead_type");
CREATE INDEX IF NOT EXISTS "fest_chances_recheck_idx" ON "public"."fest_chances" USING btree ("recheck_at");

-- vereins_radar
CREATE TABLE IF NOT EXISTS "public"."vereins_radar" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_key" text NOT NULL,
  "verein_name" text,
  "ort" text,
  "region" text,
  "vereins_typ" text,
  "founding_year" integer,
  "mitglieder" integer,
  "event_year" integer,
  "jubilee_years" integer,
  "months_ahead" integer,
  "date_assumed" boolean DEFAULT false NOT NULL,
  "phase" text,
  "status" text DEFAULT 'beobachten' NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "score_reason" text,
  "planning_signals" jsonb DEFAULT '[]'::jsonb,
  "incumbent_festwirt" text,
  "brauerei_partner" text,
  "contact_name" text,
  "contact_role" text,
  "contact_email" text,
  "contact_phone" text,
  "next_action" text,
  "source_url" text,
  "domain" text,
  "content_hash" text,
  "query_type" text,
  "run_id" text,
  "discovered_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "wirt_status" text DEFAULT 'neu' NOT NULL,
  "wirt_notiz" text,
  "wiedervorlage" timestamp,
  CONSTRAINT "vereins_radar_lead_key_unique" UNIQUE("lead_key")
);
CREATE INDEX IF NOT EXISTS "vereins_radar_status_idx" ON "public"."vereins_radar" USING btree ("status");
CREATE INDEX IF NOT EXISTS "vereins_radar_region_idx" ON "public"."vereins_radar" USING btree ("region");
CREATE INDEX IF NOT EXISTS "vereins_radar_score_idx" ON "public"."vereins_radar" USING btree ("score");
CREATE INDEX IF NOT EXISTS "vereins_radar_run_id_idx" ON "public"."vereins_radar" USING btree ("run_id");