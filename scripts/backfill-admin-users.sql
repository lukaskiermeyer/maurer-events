-- Backfill für Alt-Daten in admin_users (einmalig ausführen):
UPDATE public.admin_users
SET created_by = COALESCE(NULLIF(TRIM(created_by), ''), 'system'),
    created_at = COALESCE(created_at, now())
WHERE created_by IS NULL OR TRIM(created_by) = '' OR created_at IS NULL;