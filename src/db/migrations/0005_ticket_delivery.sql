ALTER TABLE "reservations" ADD COLUMN "ticket_email_payload" jsonb;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "ticket_sent_at" timestamp;