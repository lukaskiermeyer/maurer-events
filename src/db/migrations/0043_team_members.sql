-- Team-Stimmen für „Über uns": Name, Position, Zitat, optionales Foto, Reihenfolge.
-- Handschriftlich angelegt (Projekt-Konvention: kein drizzle-kit generate).
CREATE TABLE "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "role" text NOT NULL,
  "role_en" text,
  "role_bar" text,
  "quote" text NOT NULL,
  "quote_en" text,
  "quote_bar" text,
  "image_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
-- Bestand aus messages/UeberUns.voices übernehmen (Zitat = angezeigter Spruch).
INSERT INTO "team_members" ("name", "role", "role_en", "role_bar", "quote", "quote_en", "quote_bar", "image_url", "sort_order") VALUES
  ('Sepp', 'Ausschank', 'Bar & Tap', 'Ausschank', 'Ein Bier ohne Schaum ist wie ein Fest ohne Blasmusik.', 'A beer without foam is like a festival without brass music.', 'A Bier ohne Schaum is wia a Fest ohne Blasmusik.', 'https://i.pravatar.cc/600?u=sepp', 1),
  ('Lena', 'Service', 'Service', 'Service', 'Ich trag acht Maß auf einmal – nur die Verantwortung nicht.', 'I carry eight steins at once – just not the responsibility.', 'I trag acht Maß auf oamoi – nur d''Verantwortung ned.', 'https://i.pravatar.cc/600?u=lena', 2),
  ('Michi', 'Zeltaufbau', 'Tent Setup', 'Zeltaufbau', 'Ich stell nicht nur Zelte auf, ich stell Laune auf.', 'I don''t just set up tents, I set the mood.', 'I stoi ned nur Zelt auf, i stoi Laune auf.', 'https://i.pravatar.cc/600?u=michi', 3),
  ('Anna', 'Küche', 'Kitchen', 'Kuchl', 'Liebe geht durch den Magen – bei uns durch die ganze Festhalle.', 'Love goes through the stomach – with us through the whole hall.', 'Liabe geht durch dn Mong – bei uns durch de ganze Festhalln.', 'https://i.pravatar.cc/600?u=anna', 4),
  ('Resi', 'Theke & Kaffee', 'Bar & Coffee', 'Theke & Kaffee', 'Kaffee schwarz, Tracht bunt, Laune gold.', 'Coffee black, traditional attire colorful, mood golden.', 'Kaffee schwarz, Tracht bunt, Laune goidn.', 'https://i.pravatar.cc/600?u=resi', 5);