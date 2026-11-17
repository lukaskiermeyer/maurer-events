CREATE TABLE IF NOT EXISTS "admin_mfa" (
  "email" text PRIMARY KEY,
  "totp_secret_enc" text,
  "totp_enabled_at" timestamp,
  "totp_last_counter" integer,
  "recovery_codes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "pending_secret_enc" text,
  "pending_created_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "admin_trusted_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "token_hash" text NOT NULL,
  "fingerprint" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "last_used_at" timestamp,
  CONSTRAINT "admin_trusted_device_token_unique" UNIQUE ("token_hash")
);

CREATE INDEX IF NOT EXISTS "admin_trusted_device_email_idx" ON "admin_trusted_devices" ("email");