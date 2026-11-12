ALTER TABLE "public"."tables" ADD COLUMN "section" text;--> statement-breakpoint
ALTER TABLE "public"."tables" ADD COLUMN "row_label" text;--> statement-breakpoint
ALTER TABLE "public"."tables" ADD COLUMN "display_number" text;--> statement-breakpoint
ALTER TABLE "public"."tables" ADD COLUMN "shape" text DEFAULT 'rect' NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."tables" ADD COLUMN "width_m" real;--> statement-breakpoint
ALTER TABLE "public"."tables" ADD COLUMN "height_m" real;--> statement-breakpoint
ALTER TABLE "public"."tables" ADD COLUMN "rotation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."tables" ADD COLUMN "is_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."tables" ADD CONSTRAINT "tables_shape_check" CHECK ("public"."tables"."shape" in ('rect', 'round'));--> statement-breakpoint
ALTER TABLE "public"."tables" ADD CONSTRAINT "tables_rotation_check" CHECK ("public"."tables"."rotation" >= 0 and "public"."tables"."rotation" < 360);--> statement-breakpoint
ALTER TABLE "public"."tables" ADD CONSTRAINT "tables_width_check" CHECK ("public"."tables"."width_m" is null or "public"."tables"."width_m" > 0);--> statement-breakpoint
ALTER TABLE "public"."tables" ADD CONSTRAINT "tables_height_check" CHECK ("public"."tables"."height_m" is null or "public"."tables"."height_m" > 0);