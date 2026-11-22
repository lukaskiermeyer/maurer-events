-- Passkey-first admin auth (additive, idempotent). Legacy tables/columns untouched.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Extend admin_users
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS email_normalized text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_enrollment',
  ADD COLUMN IF NOT EXISTS webauthn_user_id text,
  ADD COLUMN IF NOT EXISTS enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_normalized_unique
  ON public.admin_users (email_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_webauthn_user_unique
  ON public.admin_users (webauthn_user_id);

-- Backfill email_normalized
UPDATE public.admin_users
SET email_normalized = lower(trim(email))
WHERE email_normalized IS NULL;

-- New tables
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_type text,
  backed_up boolean,
  aaguid text,
  friendly_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  needs_review boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS admin_credentials_admin_idx ON public.admin_credentials (admin_id);

CREATE TABLE IF NOT EXISTS public.admin_passkey_sessions (
  token_hash text PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  step_up_at timestamptz,
  user_agent text,
  ip_hash text,
  device_label text,
  revoked_at timestamptz,
  revoke_reason text
);
CREATE INDEX IF NOT EXISTS admin_passkey_sessions_admin_idx ON public.admin_passkey_sessions (admin_id);

CREATE TABLE IF NOT EXISTS public.admin_enrollment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  pin_attempts integer NOT NULL DEFAULT 0,
  purpose text NOT NULL DEFAULT 'initial',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_by uuid,
  created_via text NOT NULL DEFAULT 'ui',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_enrollment_tokens_admin_idx ON public.admin_enrollment_tokens (admin_id);

CREATE TABLE IF NOT EXISTS public.admin_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_recovery_codes_admin_idx ON public.admin_recovery_codes (admin_id);

CREATE TABLE IF NOT EXISTS public.admin_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  challenge text NOT NULL,
  type text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  browser_cookie text
);
CREATE INDEX IF NOT EXISTS admin_challenges_admin_idx ON public.admin_challenges (admin_id);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_admin_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  subject_admin_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_hash text,
  user_agent text,
  metadata jsonb,
  prev_hash text,
  entry_hash text NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_log_occurred_idx ON public.admin_audit_log (occurred_at);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON public.admin_audit_log (actor_admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_subject_idx ON public.admin_audit_log (subject_admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_event_idx ON public.admin_audit_log (event_type);

-- Seed both admins (idempotent). webauthn_user_id generated as 32 random bytes base64url.
INSERT INTO public.admin_users (email, email_normalized, display_name, role, status, webauthn_user_id, created_by)
SELECT 'hello@madebylui.net', 'hello@madebylui.net', 'Lui · MadeByLui', 'owner', 'pending_enrollment',
       replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', ''), 'system'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_users WHERE lower(trim(email)) = 'hello@madebylui.net');

INSERT INTO public.admin_users (email, email_normalized, display_name, role, status, webauthn_user_id, created_by)
SELECT 'servus@maurer-events.com', 'servus@maurer-events.com', 'Maurer Events', 'owner', 'pending_enrollment',
       replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', ''), 'system'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_users WHERE lower(trim(email)) = 'servus@maurer-events.com');

-- Ensure existing servus row gets normalized fields if missing
UPDATE public.admin_users
SET email_normalized = COALESCE(email_normalized, lower(trim(email))),
    display_name = COALESCE(display_name, CASE WHEN lower(trim(email))='servus@maurer-events.com' THEN 'Maurer Events' WHEN lower(trim(email))='hello@madebylui.net' THEN 'Lui · MadeByLui' END),
    role = COALESCE(role, 'owner'),
    status = COALESCE(status, 'pending_enrollment'),
    webauthn_user_id = COALESCE(webauthn_user_id, replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', ''),
    updated_at = COALESCE(updated_at, now())
WHERE email_normalized IS NULL OR webauthn_user_id IS NULL;
