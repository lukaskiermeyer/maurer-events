CREATE TABLE "public"."document_form_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL DEFAULT 'Minijob-Formular',
	"kind" text DEFAULT 'minijob' NOT NULL,
	"body_html" text NOT NULL DEFAULT '',
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_form_templates_status_check" CHECK ("status" in ('draft', 'active')),
	CONSTRAINT "document_form_templates_kind_check" CHECK ("kind" in ('minijob', 'other'))
);--> statement-breakpoint
