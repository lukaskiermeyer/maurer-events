CREATE TABLE "public"."customer_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text,
	"imported_by" text NOT NULL,
	"row_count" integer NOT NULL,
	"created_count" integer NOT NULL,
	"updated_count" integer NOT NULL,
	"skipped_count" integer NOT NULL,
	"report" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"street" text,
	"zip" text,
	"city" text,
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_ref" text,
	"external_source" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "customers_name_check" CHECK (length(trim("public"."customers"."display_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_email_unique" ON "public"."customers" USING btree (lower(trim("email")));--> statement-breakpoint
CREATE INDEX "customer_phone_idx" ON "public"."customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customer_external_ref_idx" ON "public"."customers" USING btree ("external_source","external_ref");--> statement-breakpoint
ALTER TABLE "public"."reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "res_customer_id_idx" ON "public"."reservations" USING btree ("customer_id");