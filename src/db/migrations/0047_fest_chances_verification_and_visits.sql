-- 0047: Fest-Chancen Verifizierung & Bewerbungsfrist + Vereins-Radar Besuchs-Anlass
-- Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).

ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "source_date" text;--> statement-breakpoint
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "application_deadline" text;--> statement-breakpoint
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "verification_summary" text;--> statement-breakpoint
ALTER TABLE "public"."fest_chances" ADD COLUMN IF NOT EXISTS "verified_at" timestamp;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fest_chances_deadline_idx" ON "public"."fest_chances" USING btree ("application_deadline");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fest_chances_verification_idx" ON "public"."fest_chances" USING btree ("verification_status");--> statement-breakpoint

ALTER TABLE "public"."vereins_radar" ADD COLUMN IF NOT EXISTS "next_visit_event" text;--> statement-breakpoint
ALTER TABLE "public"."vereins_radar" ADD COLUMN IF NOT EXISTS "next_visit_date" text;--> statement-breakpoint
ALTER TABLE "public"."vereins_radar" ADD COLUMN IF NOT EXISTS "next_visit_url" text;--> statement-breakpoint
ALTER TABLE "public"."vereins_radar" ADD COLUMN IF NOT EXISTS "tent_history" text;--> statement-breakpoint
ALTER TABLE "public"."vereins_radar" ADD COLUMN IF NOT EXISTS "verification_summary" text;--> statement-breakpoint
ALTER TABLE "public"."vereins_radar" ADD COLUMN IF NOT EXISTS "verified_at" timestamp;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "vereins_radar_next_visit_idx" ON "public"."vereins_radar" USING btree ("next_visit_date");
