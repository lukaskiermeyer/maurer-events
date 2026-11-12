CREATE TABLE "public"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public"."contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"body_html" text NOT NULL,
	"signature_mode" text DEFAULT 'text' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contract_templates_status_check" CHECK ("public"."contract_templates"."status" in ('draft', 'reviewed', 'active')),
	CONSTRAINT "contract_templates_signature_check" CHECK ("public"."contract_templates"."signature_mode" in ('text', 'handwritten'))
);
--> statement-breakpoint
CREATE TABLE "public"."contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"template_id" uuid,
	"template_version" integer NOT NULL,
	"role_id" uuid,
	"body_html" text NOT NULL,
	"signature_mode" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp,
	"signed_file_url" text,
	"signed_file_sha256" text,
	"consent_version" text,
	"signed_ip" text,
	"signed_user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_status_check" CHECK ("public"."contracts"."status" in ('pending', 'signed', 'verified', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "public"."staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"birth_date" timestamp,
	"street" text,
	"zip" text,
	"city" text,
	"role_id" uuid,
	"status" text DEFAULT 'invited' NOT NULL,
	"employment_type" text DEFAULT 'minijob' NOT NULL,
	"hourly_rate_cents" integer DEFAULT 0 NOT NULL,
	"monthly_salary_cents" integer DEFAULT 0 NOT NULL,
	"tax_id_enc" text,
	"tax_class" text,
	"child_allowances" integer DEFAULT 0 NOT NULL,
	"social_security_enc" text,
	"health_insurance" text,
	"iban_enc" text,
	"bic" text,
	"entry_date" timestamp,
	"exit_date" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_status_check" CHECK ("public"."staff"."status" in ('invited', 'onboarding', 'ready', 'active', 'inactive')),
	CONSTRAINT "staff_employment_check" CHECK ("public"."staff"."employment_type" in ('minijob', 'short_term', 'student', 'employed')),
	CONSTRAINT "staff_rate_check" CHECK ("public"."staff"."hourly_rate_cents" >= 0 and "public"."staff"."monthly_salary_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "public"."staff_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_url" text NOT NULL,
	"public_id" text,
	"mime_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp,
	"verified_by" text,
	"verified_at" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_documents_status_check" CHECK ("public"."staff_documents"."status" in ('pending', 'verified', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "public"."staff_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invite_token_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "public"."staff_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"hourly_rate_cents" integer DEFAULT 0 NOT NULL,
	"required_documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires_handwritten_signature" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_role_key_unique" UNIQUE("key"),
	CONSTRAINT "staff_roles_rate_check" CHECK ("public"."staff_roles"."hourly_rate_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "public"."staff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"valid_until" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public"."contract_templates" ADD CONSTRAINT "contract_templates_role_id_staff_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."staff_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_role_id_staff_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."staff_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff" ADD CONSTRAINT "staff_role_id_staff_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."staff_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff_documents" ADD CONSTRAINT "staff_documents_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff_invites" ADD CONSTRAINT "staff_invites_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "public"."audit_log" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "public"."audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "contract_template_role_idx" ON "public"."contract_templates" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "contract_staff_idx" ON "public"."contracts" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_unique" ON "public"."staff" USING btree (lower(trim("email")));--> statement-breakpoint
CREATE INDEX "staff_document_staff_idx" ON "public"."staff_documents" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_invite_staff_idx" ON "public"."staff_invites" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_session_staff_idx" ON "public"."staff_sessions" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_session_valid_idx" ON "public"."staff_sessions" USING btree ("valid_until");