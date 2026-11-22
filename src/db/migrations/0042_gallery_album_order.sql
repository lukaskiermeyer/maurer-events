-- Manuelle Album-Reihenfolge (Admin ↑/↓) = Anzeige auf /galerie.
-- Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).
ALTER TABLE "gallery_albums" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Bestand in aktueller Anzeige-Reihenfolge (Datum absteigend) nummerieren.
WITH ranked AS (
  SELECT "id", row_number() OVER (ORDER BY "date" DESC) AS rn
  FROM "gallery_albums"
)
UPDATE "gallery_albums" g
SET "sort_order" = ranked.rn
FROM ranked
WHERE g."id" = ranked."id";