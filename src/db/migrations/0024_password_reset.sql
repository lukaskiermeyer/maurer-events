-- 0024: Passwort-Reset fuer Mitarbeiter
CREATE TABLE IF NOT EXISTS "public"."staff_password_resets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staff_id" uuid NOT NULL REFERENCES "public"."staff"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_password_resets_token_uq" ON "public"."staff_password_resets" ("token_hash");
CREATE INDEX IF NOT EXISTS "staff_password_resets_staff_idx" ON "public"."staff_password_resets" ("staff_id");--> statement-breakpoint