CREATE TABLE "public"."payroll_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" text NOT NULL,
	"format" text DEFAULT 'datev_csv' NOT NULL,
	"period_from" timestamp,
	"period_to" timestamp,
	"row_count" integer NOT NULL,
	"file_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_export_token_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "payroll_export_created_idx" ON "public"."payroll_exports" USING btree ("created_at");