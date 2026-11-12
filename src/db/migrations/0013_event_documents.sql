CREATE TABLE "public"."event_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"title_en" text,
	"file_url" text NOT NULL,
	"preview_url" text,
	"public_id" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_documents_kind_check" CHECK ("public"."event_documents"."kind" in ('menu', 'program')),
	CONSTRAINT "event_documents_size_check" CHECK ("public"."event_documents"."size_bytes" is null or "public"."event_documents"."size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "public"."event_documents" ADD CONSTRAINT "event_documents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_doc_event_id_idx" ON "public"."event_documents" USING btree ("event_id");