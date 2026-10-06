ALTER TYPE "public"."reservation_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TYPE "public"."reservation_status" ADD VALUE 'disputed';--> statement-breakpoint
ALTER TYPE "public"."reservation_status" ADD VALUE 'payment_review';--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_event_id_events_id_fk";
--> statement-breakpoint
DROP INDEX "auth_email_idx";--> statement-breakpoint
DROP INDEX "res_session_id_idx";--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "res_expires_pending_idx" ON "reservations" USING btree ("expires_at") WHERE "reservations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "res_session_id_idx" ON "reservations" USING btree ("stripe_session_id") WHERE "reservations"."stripe_session_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_auth" ADD CONSTRAINT "auth_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_stripe_session_id_unique" UNIQUE("stripe_session_id");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_idempotency_key_unique" UNIQUE("idempotency_key");