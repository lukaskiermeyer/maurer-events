import postgres from 'postgres';
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });
const sql = `
CREATE TABLE IF NOT EXISTS "public"."fest_opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text,
  "organizer" text,
  "location" text,
  "region" text,
  "event_date" timestamp,
  "jubilee_years" integer,
  "categories" jsonb DEFAULT '[]'::jsonb,
  "contact_name" text,
  "contact_email" text,
  "contact_phone" text,
  "source_url" text NOT NULL,
  "source_url_normalized" text,
  "festwirt_status" text DEFAULT 'unknown' NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "score_reason" text,
  "months_ahead" integer,
  "status" text DEFAULT 'new' NOT NULL,
  "next_action" text,
  "discovered_at" timestamp,
  "n8n_run_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "fest_opportunities_source_url_unique" UNIQUE ("source_url")
);
CREATE INDEX IF NOT EXISTS "fest_opp_status_idx" ON "public"."fest_opportunities" ("status");
CREATE INDEX IF NOT EXISTS "fest_opp_region_idx" ON "public"."fest_opportunities" ("region");
CREATE INDEX IF NOT EXISTS "fest_opp_score_idx" ON "public"."fest_opportunities" ("score");
CREATE INDEX IF NOT EXISTS "fest_opp_source_norm_idx" ON "public"."fest_opportunities" ("source_url_normalized");

CREATE TABLE IF NOT EXISTS "public"."fest_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" text NOT NULL,
  "started_at" timestamp,
  "found_count" integer DEFAULT 0 NOT NULL,
  "synced_count" integer DEFAULT 0 NOT NULL,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "fest_runs_run_id_unique" UNIQUE ("run_id")
);
CREATE INDEX IF NOT EXISTS "fest_runs_created_idx" ON "public"."fest_runs" ("created_at");
`;
try {
  await client.unsafe(sql);
  console.log('Tables created.');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.end({ timeout: 5 });
}