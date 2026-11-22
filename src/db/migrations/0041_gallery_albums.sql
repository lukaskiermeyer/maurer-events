-- Galerie von Events entkoppeln: eigenständige Alben in gallery_albums.
-- Bilder (galleries) hängen künftig an album_id statt event_id.
-- Galerie-Events werden mit GLEICHER UUID zu Alben, damit /galerie/<id>-URLs
-- stabil bleiben. Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).

CREATE TABLE "gallery_albums" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "title_en" text,
  "title_bar" text,
  "date" timestamp NOT NULL,
  "location" text NOT NULL,
  "location_en" text,
  "location_bar" text,
  "description" text NOT NULL,
  "description_en" text,
  "description_bar" text,
  "cover_image_url" text,
  "cover_public_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);--> statement-breakpoint
CREATE INDEX "gallery_album_event_idx" ON "gallery_albums" ("event_id");--> statement-breakpoint

-- 1) Galerie-Events (type='gallery') werden zu Alben – gleiche UUID, kein Event-Link mehr.
INSERT INTO "gallery_albums" ("id", "event_id", "title", "title_en", "title_bar", "date", "location", "location_en", "location_bar", "description", "description_en", "description_bar", "cover_image_url", "created_at", "updated_at", "deleted_at")
SELECT "id", NULL, "title", "title_en", "title_bar", "date", "location", "location_en", "location_bar", "description", "description_en", "description_bar", "image_url", "created_at", "updated_at", "deleted_at"
FROM "events" WHERE "type" = 'gallery';--> statement-breakpoint

-- 2) Echte Events mit Bildern bekommen ein verknüpftes Album (Album automatisch pro Event).
INSERT INTO "gallery_albums" ("id", "event_id", "title", "title_en", "title_bar", "date", "location", "location_en", "location_bar", "description", "description_en", "description_bar", "cover_image_url", "created_at", "updated_at")
SELECT gen_random_uuid(), e."id", e."title", e."title_en", e."title_bar", e."date", e."location", e."location_en", e."location_bar", e."description", e."description_en", e."description_bar", e."image_url", e."created_at", e."updated_at"
FROM "events" e WHERE e."type" = 'event' AND e."deleted_at" IS NULL AND EXISTS (SELECT 1 FROM "galleries" g WHERE g."event_id" = e."id");--> statement-breakpoint

-- 3) Bilder auf Alben umhängen, dann event_id entfernen.
ALTER TABLE "galleries" ADD COLUMN "album_id" uuid REFERENCES "gallery_albums"("id") ON DELETE CASCADE;--> statement-breakpoint
UPDATE "galleries" g SET "album_id" = g."event_id" WHERE EXISTS (SELECT 1 FROM "gallery_albums" a WHERE a."id" = g."event_id");--> statement-breakpoint
UPDATE "galleries" g SET "album_id" = a."id" FROM "gallery_albums" a WHERE a."event_id" = g."event_id" AND g."album_id" IS NULL;--> statement-breakpoint
CREATE INDEX "gal_album_id_idx" ON "galleries" ("album_id");--> statement-breakpoint
DROP INDEX "gal_event_id_idx";--> statement-breakpoint
ALTER TABLE "galleries" DROP COLUMN "event_id";--> statement-breakpoint

-- 4) Migrierte Galerie-Events entfernen. Nur ohne Reservierungen/Gutscheine/Wartelisten
--    (restrict-FKs); event_settings & Co. folgen per ON DELETE CASCADE.
DELETE FROM "events" e WHERE e."type" = 'gallery'
  AND NOT EXISTS (SELECT 1 FROM "reservations" r WHERE r."event_id" = e."id")
  AND NOT EXISTS (SELECT 1 FROM "vouchers" v WHERE v."event_id" = e."id")
  AND NOT EXISTS (SELECT 1 FROM "waitlists" w WHERE w."event_id" = e."id");