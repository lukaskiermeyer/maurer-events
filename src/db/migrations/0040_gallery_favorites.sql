-- Kuratierte Startseite-Galerie: Favoriten-Flag + Reihenfolge je Bild.
-- Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).
ALTER TABLE "galleries" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "favorite_order" integer DEFAULT 0 NOT NULL;
