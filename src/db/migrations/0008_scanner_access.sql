CREATE TABLE "public"."scanner_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"email" text NOT NULL,
	"valid_until" timestamp NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public"."scanner_access" ADD CONSTRAINT "scanner_access_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scanner_event_email_unique" ON "public"."scanner_access" USING btree ("event_id",lower(trim("email")));--> statement-breakpoint
CREATE INDEX "scanner_email_idx" ON "public"."scanner_access" USING btree ("email");