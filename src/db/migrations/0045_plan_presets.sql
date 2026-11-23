-- Tischplan-Presets: wiederverwendbare Plan-Vorlagen (Bereiche, Zeltgrenzen,
-- Bühne, Reihen/Tische mit Nummern, Labels) als JSONB-Dokument.
-- Events wählen ein Preset; Reservierungen referenzieren Tisch-Element-IDs.
-- Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).
CREATE TABLE "plan_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "layout" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "plan_preset_id" uuid REFERENCES "plan_presets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "plan_table_id" text;--> statement-breakpoint
CREATE INDEX "res_plan_table_idx" ON "reservations" ("event_id", "plan_table_id") WHERE "plan_table_id" IS NOT NULL;