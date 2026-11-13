-- 0022: Self-Signup fuer Personal-Einsaetze
-- Mitarbeiter koennen sich selbst fuer offene Schichten eintragen (source='self', status='requested').
-- Admin bestaetigt -> 'confirmed'. Algorithmus fuellt verbleibende Luecken.
ALTER TABLE "public"."staff_assignments" DROP CONSTRAINT IF EXISTS "staff_assignment_status_check";
ALTER TABLE "public"."staff_assignments" ADD CONSTRAINT "staff_assignment_status_check"
  CHECK ("status" in ('proposed', 'requested', 'accepted', 'declined', 'confirmed'));

-- Index fuer schnelle Abfrage offener Schichten pro Event
CREATE INDEX IF NOT EXISTS "staff_assignment_event_status_idx"
  ON "public"."staff_assignments" ("event_id", "status");

-- Tabelle fuer Schicht-Angebote (offene Slots, die Mitarbeiter selbst buchen koennen)
CREATE TABLE IF NOT EXISTS "public"."shift_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "public"."events"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "public"."staff_roles"("id") ON DELETE RESTRICT,
  "date" timestamp NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "required_count" integer NOT NULL DEFAULT 1,
  "note" text,
  "created_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "shift_offers_event_idx" ON "public"."shift_offers" ("event_id");--> statement-breakpoint