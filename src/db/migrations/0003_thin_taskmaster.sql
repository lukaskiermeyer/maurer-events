CREATE TABLE "event_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"require_full_table" boolean DEFAULT true NOT NULL,
	"min_consumption_cents" integer DEFAULT 5000 NOT NULL,
	"time_slots" jsonb DEFAULT '["17:00","18:00","19:00"]'::jsonb NOT NULL,
	"packages" jsonb DEFAULT '[{"id":"brotzeit","name":"Brotzeit-Paket","price":25,"description":"1 Maß & 1 halbes Hendl","popular":false},{"id":"vollgas","name":"Vollgas-Paket","price":50,"description":"2 Maß, 1 Hauptgericht & 1 Schnaps","popular":true}]'::jsonb NOT NULL,
	"cancellation_days" integer DEFAULT 7 NOT NULL,
	"max_bookings_per_email" integer DEFAULT 2 NOT NULL,
	"custom_service_fee" boolean DEFAULT false NOT NULL,
	"service_fee_percent" real DEFAULT 1.5 NOT NULL,
	"service_fee_fixed_cents" integer DEFAULT 25 NOT NULL,
	"booking_window_start_days" integer DEFAULT 90 NOT NULL,
	"booking_window_end_hours" integer DEFAULT 2 NOT NULL,
	"auto_send_ticket" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_settings_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "selected_time" text;--> statement-breakpoint
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;