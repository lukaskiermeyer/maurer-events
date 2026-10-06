CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'paid', 'confirmed', 'checked_in', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "admin_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"otp_code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"valid_until" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"date" timestamp NOT NULL,
	"end_date" timestamp,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"title_en" text,
	"location_en" text,
	"description_en" text,
	"image_url" text,
	"link" text,
	"reservable" boolean DEFAULT false NOT NULL,
	"allow_table_selection" boolean DEFAULT true NOT NULL,
	"max_capacity" integer DEFAULT 0 NOT NULL,
	"reservable_dates" json,
	"minimum_consumption" integer DEFAULT 5000,
	"walk_in_reserve" integer DEFAULT 0 NOT NULL,
	"publish_tables_at" timestamp,
	"type" text DEFAULT 'event' NOT NULL,
	"is_featured_gallery" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "events_max_capacity_check" CHECK ("events"."max_capacity" >= 0),
	CONSTRAINT "events_minimum_consumption_check" CHECK ("events"."minimum_consumption" >= 0),
	CONSTRAINT "events_walk_in_reserve_check" CHECK ("events"."walk_in_reserve" >= 0)
);
--> statement-breakpoint
CREATE TABLE "galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"public_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"table_id" uuid,
	"reservation_date" timestamp DEFAULT now() NOT NULL,
	"guest_name" text NOT NULL,
	"email" text NOT NULL,
	"guest_count" integer NOT NULL,
	"amount_total" integer NOT NULL,
	"stripe_session_id" text,
	"status" "reservation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp,
	"pdf_url" text,
	"qr_code_text" text,
	"scanned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "res_guest_count_check" CHECK ("reservations"."guest_count" > 0),
	CONSTRAINT "res_amount_total_check" CHECK ("reservations"."amount_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 8 NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"is_vip" boolean DEFAULT false NOT NULL,
	"vip_price" integer DEFAULT 0,
	CONSTRAINT "table_name_unique" UNIQUE("name"),
	CONSTRAINT "tables_capacity_check" CHECK ("tables"."capacity" > 0),
	CONSTRAINT "tables_vip_price_check" CHECK ("tables"."vip_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "waitlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"guest_count" integer NOT NULL,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlists_guest_count_check" CHECK ("waitlists"."guest_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_email_idx" ON "admin_auth" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sess_email_idx" ON "admin_sessions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "gal_event_id_idx" ON "galleries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "res_event_id_idx" ON "reservations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "res_table_id_idx" ON "reservations" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "res_session_id_idx" ON "reservations" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "res_date_idx" ON "reservations" USING btree ("reservation_date");--> statement-breakpoint
CREATE INDEX "res_event_date_status_idx" ON "reservations" USING btree ("event_id","reservation_date","status");--> statement-breakpoint
CREATE INDEX "wait_event_id_idx" ON "waitlists" USING btree ("event_id");