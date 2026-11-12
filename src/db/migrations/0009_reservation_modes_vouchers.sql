ALTER TYPE "public"."reservation_status" ADD VALUE 'requested';--> statement-breakpoint
ALTER TYPE "public"."reservation_status" ADD VALUE 'declined';--> statement-breakpoint
CREATE TABLE "public"."vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"reservation_id" uuid,
	"code" text NOT NULL,
	"value_cents" integer NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"redeemed_at" timestamp,
	"redeemed_by" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "voucher_code_unique" UNIQUE("code"),
	CONSTRAINT "vouchers_value_check" CHECK ("public"."vouchers"."value_cents" > 0),
	CONSTRAINT "vouchers_status_check" CHECK ("public"."vouchers"."status" in ('issued', 'redeemed', 'void')),
	CONSTRAINT "vouchers_redeemed_check" CHECK ("public"."vouchers"."status" <> 'redeemed' or "public"."vouchers"."redeemed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "public"."event_settings" ADD COLUMN "pricing_mode" text DEFAULT 'per_person' NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."events" ADD COLUMN "reservation_mode" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."events" ADD COLUMN "reservation_email" text DEFAULT 'servus@maurer-events.com' NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."events" ADD COLUMN "reservation_note" text;--> statement-breakpoint
ALTER TABLE "public"."events" ADD COLUMN "reservation_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "public"."events" ADD COLUMN "expected_guests" integer;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "booking_group_id" uuid;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "group_label" text;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "group_index" integer;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "group_size" integer;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "package_id" text;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "package_name" text;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "price_gross_cents" integer;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "price_net_cents" integer;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "vat_cents" integer;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "vat_rate" integer;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "agreed_price_cents" integer;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "privacy_version" text;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "privacy_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "confirmed_by" text;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "slip_printed_at" timestamp;--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "payment_status" text;--> statement-breakpoint
ALTER TABLE "public"."vouchers" ADD CONSTRAINT "vouchers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."vouchers" ADD CONSTRAINT "vouchers_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voucher_event_id_idx" ON "public"."vouchers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "voucher_reservation_id_idx" ON "public"."vouchers" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "res_booking_group_idx" ON "public"."reservations" USING btree ("booking_group_id") WHERE "public"."reservations"."booking_group_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."event_settings" ADD CONSTRAINT "event_settings_pricing_mode_check" CHECK ("public"."event_settings"."pricing_mode" in ('per_person', 'per_table'));--> statement-breakpoint
ALTER TABLE "public"."events" ADD CONSTRAINT "events_reservation_mode_check" CHECK ("public"."events"."reservation_mode" in ('none', 'email', 'online'));--> statement-breakpoint
ALTER TABLE "public"."events" ADD CONSTRAINT "events_expected_guests_check" CHECK ("public"."events"."expected_guests" is null or "public"."events"."expected_guests" >= 0);--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_source_check" CHECK ("public"."reservations"."source" is null or "public"."reservations"."source" in ('online', 'email', 'manual', 'import', 'legacy'));--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_group_index_check" CHECK ("public"."reservations"."group_index" is null or "public"."reservations"."group_index" > 0);--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_group_size_check" CHECK ("public"."reservations"."group_size" is null or "public"."reservations"."group_size" > 0);--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_price_gross_check" CHECK ("public"."reservations"."price_gross_cents" is null or "public"."reservations"."price_gross_cents" >= 0);--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_price_net_check" CHECK ("public"."reservations"."price_net_cents" is null or "public"."reservations"."price_net_cents" >= 0);--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_vat_cents_check" CHECK ("public"."reservations"."vat_cents" is null or "public"."reservations"."vat_cents" >= 0);--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_vat_rate_check" CHECK ("public"."reservations"."vat_rate" is null or "public"."reservations"."vat_rate" in (0, 7, 19));--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_agreed_price_check" CHECK ("public"."reservations"."agreed_price_cents" is null or "public"."reservations"."agreed_price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "res_payment_status_check" CHECK ("public"."reservations"."payment_status" is null or "public"."reservations"."payment_status" in ('open', 'deposit_paid', 'paid', 'refunded'));--> statement-breakpoint
UPDATE "public"."events" SET "reservation_mode" = 'online' WHERE "reservable" = true;--> statement-breakpoint
UPDATE "public"."reservations" SET "source" = 'online' WHERE "stripe_session_id" IS NOT NULL AND "source" IS NULL;