-- 0025: Admin-Benutzer (E-Mails mit vollem Admin-Zugriff, im Admin-Bereich verwaltbar)
CREATE TABLE IF NOT EXISTS "public"."admin_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_unique" ON "public"."admin_users" (lower(trim("email")));