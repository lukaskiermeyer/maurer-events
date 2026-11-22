-- Bairisch (bar) als zweite Zielsprache der KI-Uebersetzung neben Englisch.
-- Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).
ALTER TABLE "events" ADD COLUMN "title_bar" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location_bar" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "description_bar" text;--> statement-breakpoint
ALTER TABLE "event_documents" ADD COLUMN "title_bar" text;
