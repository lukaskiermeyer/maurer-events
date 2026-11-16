CREATE TABLE IF NOT EXISTS "public"."fest_chances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url_hash" text NOT NULL,
	"source_url" text NOT NULL,
	"source_url_normalized" text NOT NULL,
	"title" text,
	"organizer" text,
	"location" text,
	"region" text,
	"event_date" text,
	"months_ahead" integer,
	"jubilee_years" integer,
	"festwirt_status" text DEFAULT 'unknown' NOT NULL,
	"event_type" text DEFAULT 'other' NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"emergency" boolean DEFAULT false NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"score_reason" text,
	"nim_model" text,
	"run_id" text,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fest_chances_url_hash_unique" UNIQUE("url_hash")
);
--> statement-breakpoint
CREATE INDEX "fest_chances_status_score_idx" ON "public"."fest_chances" USING btree ("status","score");--> statement-breakpoint
CREATE INDEX "fest_chances_region_idx" ON "public"."fest_chances" USING btree ("region");--> statement-breakpoint
CREATE INDEX "fest_chances_run_id_idx" ON "public"."fest_chances" USING btree ("run_id");