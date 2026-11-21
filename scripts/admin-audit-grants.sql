-- P4: Least-privilege GRANTs für admin_audit_log (nur INSERT/SELECT)
-- Als DB-Owner ausführen:
REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC;
GRANT INSERT, SELECT ON TABLE public.admin_audit_log TO app_user;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_log_id_seq TO app_user;
-- Tägliches Anchoring (Vorschlag): Cron-Job, der den aktuellen head_hash
-- in eine separate Tabelle admin_audit_anchors (date, head_hash) schreibt.
