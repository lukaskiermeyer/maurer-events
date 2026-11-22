-- Mock-Fotos (Pravatar-Platzhalter) aus den Team-Stimmen entfernen (Nutzerwunsch 2026-11-22).
-- Karten zeigen danach den Anfangsbuchstaben, bis echte Fotos im Admin hochgeladen sind.
-- Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).
UPDATE "team_members"
SET "image_url" = NULL, "updated_at" = now()
WHERE "image_url" LIKE 'https://i.pravatar.cc%';