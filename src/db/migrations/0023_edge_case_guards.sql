-- 0023: Edge-Case-Haertung (Unique-Indexes + Status-Guards)
-- 1) Vertrag: pro Mitarbeiter/Template/Version nur ein pending-Vertrag
CREATE UNIQUE INDEX IF NOT EXISTS "contracts_staff_template_version_uq"
  ON "public"."contracts" ("staff_id", "template_id", "template_version")
  WHERE "template_id" IS NOT NULL;

-- 2) Minijob-Dokument: pro Mitarbeiter nur ein minijob_form
CREATE UNIQUE INDEX IF NOT EXISTS "staff_documents_minijob_uq"
  ON "public"."staff_documents" ("staff_id")
  WHERE "kind" = 'minijob_form';

-- 3) Self-Signup: pro Mitarbeiter/Schicht nur eine Zuweisung
CREATE UNIQUE INDEX IF NOT EXISTS "staff_assignments_self_slot_uq"
  ON "public"."staff_assignments" ("staff_id", "event_id", "date", "start_time", "end_time");--> statement-breakpoint