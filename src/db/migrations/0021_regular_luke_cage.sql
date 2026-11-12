CREATE TABLE "public"."document_form_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'Minijob-Formular' NOT NULL,
	"kind" text DEFAULT 'minijob' NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_form_templates_status_check" CHECK ("public"."document_form_templates"."status" in ('draft', 'active')),
	CONSTRAINT "document_form_templates_kind_check" CHECK ("public"."document_form_templates"."kind" in ('minijob', 'other'))
);
--> statement-breakpoint
CREATE TABLE "public"."fest_opportunities" (
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
	CONSTRAINT "fest_opportunities_source_url_unique" UNIQUE("source_url")
);
--> statement-breakpoint
CREATE TABLE "public"."fest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"started_at" timestamp,
	"found_count" integer DEFAULT 0 NOT NULL,
	"synced_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fest_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE INDEX "fest_opp_status_idx" ON "public"."fest_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fest_opp_region_idx" ON "public"."fest_opportunities" USING btree ("region");--> statement-breakpoint
CREATE INDEX "fest_opp_score_idx" ON "public"."fest_opportunities" USING btree ("score");--> statement-breakpoint
CREATE INDEX "fest_opp_source_norm_idx" ON "public"."fest_opportunities" USING btree ("source_url_normalized");--> statement-breakpoint
CREATE INDEX "fest_runs_created_idx" ON "public"."fest_runs" USING btree ("created_at");