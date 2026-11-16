CREATE TABLE IF NOT EXISTS "public"."email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_log_created_idx" ON "public"."email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_log_status_idx" ON "public"."email_log" USING btree ("status");