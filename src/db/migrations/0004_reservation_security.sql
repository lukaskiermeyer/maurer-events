ALTER TYPE "public"."reservation_status" ADD VALUE 'payment_pending';--> statement-breakpoint
CREATE TABLE "security_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_auth" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "checkout_params" jsonb;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "reservations" WHERE "qr_code_text" IS NOT NULL GROUP BY "qr_code_text" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate ticket QR codes: reissue affected tickets before applying migration 0004';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_qr_code_text_unique" UNIQUE("qr_code_text");
