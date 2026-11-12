CREATE TABLE "public"."event_staff_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"required_count" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_requirement_count_check" CHECK ("public"."event_staff_requirements"."required_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "public"."staff_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"source" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_assignment_unique_shift" UNIQUE("event_id","staff_id","date","start_time"),
	CONSTRAINT "staff_assignment_status_check" CHECK ("public"."staff_assignments"."status" in ('proposed', 'accepted', 'declined', 'confirmed')),
	CONSTRAINT "staff_assignment_source_check" CHECK ("public"."staff_assignments"."source" in ('auto', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "public"."staff_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"kind" text DEFAULT 'available' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_availability_kind_check" CHECK ("public"."staff_availability"."kind" in ('available', 'unavailable', 'preferred'))
);
--> statement-breakpoint
CREATE TABLE "public"."staffing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"guests_per_staff" integer DEFAULT 40 NOT NULL,
	"min_staff" integer DEFAULT 1 NOT NULL,
	"fixed_staff" integer DEFAULT 0 NOT NULL,
	"max_hours_per_day" integer DEFAULT 10 NOT NULL,
	"min_rest_hours" integer DEFAULT 11 NOT NULL,
	"min_age" integer DEFAULT 18 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staffing_rules_role_id_unique" UNIQUE("role_id"),
	CONSTRAINT "staffing_rules_guests_check" CHECK ("public"."staffing_rules"."guests_per_staff" > 0),
	CONSTRAINT "staffing_rules_counts_check" CHECK ("public"."staffing_rules"."min_staff" >= 0 and "public"."staffing_rules"."fixed_staff" >= 0),
	CONSTRAINT "staffing_rules_hours_check" CHECK ("public"."staffing_rules"."max_hours_per_day" between 1 and 24 and "public"."staffing_rules"."min_rest_hours" between 0 and 24),
	CONSTRAINT "staffing_rules_age_check" CHECK ("public"."staffing_rules"."min_age" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "public"."event_staff_requirements" ADD CONSTRAINT "event_staff_requirements_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."event_staff_requirements" ADD CONSTRAINT "event_staff_requirements_role_id_staff_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."staff_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff_assignments" ADD CONSTRAINT "staff_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff_assignments" ADD CONSTRAINT "staff_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff_assignments" ADD CONSTRAINT "staff_assignments_role_id_staff_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."staff_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff_availability" ADD CONSTRAINT "staff_availability_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff_availability" ADD CONSTRAINT "staff_availability_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staffing_rules" ADD CONSTRAINT "staffing_rules_role_id_staff_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."staff_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_requirement_event_idx" ON "public"."event_staff_requirements" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "staff_assignment_event_idx" ON "public"."staff_assignments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "staff_assignment_staff_idx" ON "public"."staff_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_availability_staff_event_idx" ON "public"."staff_availability" USING btree ("staff_id","event_id");--> statement-breakpoint
CREATE INDEX "staff_availability_event_idx" ON "public"."staff_availability" USING btree ("event_id");