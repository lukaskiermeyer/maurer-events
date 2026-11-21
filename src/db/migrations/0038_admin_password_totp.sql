-- Admin-Auth: Passwort + TOTP (additive, idempotent).
-- Passkey-Tabellen bleiben unangetastet; DROP erfolgt in einer Folgemigration.
ALTER TABLE "public"."admin_users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "public"."admin_users" ADD COLUMN IF NOT EXISTS "password_set_at" timestamp;
ALTER TABLE "public"."admin_users" ADD COLUMN IF NOT EXISTS "totp_secret_enc" bytea;
ALTER TABLE "public"."admin_users" ADD COLUMN IF NOT EXISTS "totp_enrolled_at" timestamp;
ALTER TABLE "public"."admin_users" ADD COLUMN IF NOT EXISTS "totp_last_used_step" bigint;
ALTER TABLE "public"."admin_users" ADD COLUMN IF NOT EXISTS "failed_password_attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "public"."admin_users" ADD COLUMN IF NOT EXISTS "failed_totp_attempts" integer DEFAULT 0 NOT NULL;

-- password_reset/totp_reset-Token brauchen keine PIN; Pending-TOTP fuer den Setup-Wizard.
ALTER TABLE "public"."admin_enrollment_tokens" ALTER COLUMN "pin_hash" DROP NOT NULL;
ALTER TABLE "public"."admin_enrollment_tokens" ADD COLUMN IF NOT EXISTS "pending_totp_enc" text;
ALTER TABLE "public"."admin_enrollment_tokens" ADD COLUMN IF NOT EXISTS "pending_totp_at" timestamp;

-- Zweiter Login-Schritt: 5-Minuten-Fenster zwischen Passwort und TOTP (single-use).
CREATE TABLE IF NOT EXISTS "public"."admin_mfa_pending" (
	"token_hash" text PRIMARY KEY,
	"admin_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "public"."admin_mfa_pending" ADD CONSTRAINT "admin_mfa_pending_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_mfa_pending_admin_idx" ON "public"."admin_mfa_pending" USING btree ("admin_id");

-- Trusted Devices an Session binden (Rotation + Widerruf bei Passwort-Wechsel).
ALTER TABLE "public"."admin_trusted_devices" ADD COLUMN IF NOT EXISTS "session_hash" text;
