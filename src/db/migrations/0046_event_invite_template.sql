-- Editierbare Einladungs-Mail pro Event (Betreff + Text mit Platzhaltern).
-- NULL = Standard-Template aus src/lib/invite-template.ts.
-- Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).
ALTER TABLE "events" ADD COLUMN "invite_subject" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "invite_body" text;