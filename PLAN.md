# PLAN — Admin-Login Passkey-First (Phase 0 Assessment)

## Ist-Zustand

- Framework: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Neon Postgres, Drizzle ORM. (Spec erwartete Vite/Cloudflare; abweichend, Invarianten bleiben.)
- Package-Manager: npm. Tests: tsx --test, Playwright.
- Admin-Auth aktuell: Email-OTP (adminAuth) + TOTP + trusted devices, Cookie `admin_token` (UUID Session-ID in adminSessions). Middleware: `src/lib/auth.ts` (requireAdmin/requireStaff), `src/lib/staff-access.ts` (resolveStaffAccess/staffSession). Admin-Panel unter `/[locale]/admin/*`.
- Admin-User-Tabelle: `admin_users(id, email, created_by, created_at)` — keine Passwort-Spalte. Nur `servus@maurer-events.com` vorhanden; `hello@madebylui.net` via ENV `ADMIN_EMAILS` (beide in Allowlist).
- Mitarbeiter-Auth teilt `adminSessions`/`admin_token` Cookie (Scanner/Admin). Spec verlangt Isolation: neuer Cookie `__Host-adm_session` für Admin-Passkey-Sessions; bestehende Mitarbeiter-Scanner-Flow bleibt auf `admin_token`? ACHTUNG: Spec says admin session cookie must not be accepted by employee endpoints and vice versa. Der bestehende Mitarbeiter-Scanner nutzt denselben `admin_token` Cookie + adminSessions. Wir dürfen Mitarbeiter-Auth nicht anfassen. Konflikt: neuer Admin-Cookie ist separat; Mitarbeiter-Scanner bleibt legacy. Admin-Panel-Zugriff über neuen Cookie. Alte `admin_token`-Admin-Sessions werden nach Enrollment entfernt.
- Mail: Resend (RESEND_API_KEY, EMAIL_FROM). Turnstile Captcha.
- DB: Neon (DATABASE_URL). Migrations via drizzle-kit + scripts/db-migrate.mjs.
- Admin-URL: Pfad-basiert `https://www.maurer-events.com/de/admin` (keine Subdomain). WEBAUTHN_RP_ID = `www.maurer-events.com` (oder `maurer-events.com`? RP ID muss suffix der Origin sein; Origin https://www.maurer-events.com). Für localhost: `localhost`.
- Cloudflare Access / Edge-Auth: nicht erkennbar (Next.js standalone/Vercel). Keine Edge-Auth.
- nodejs_compat nicht relevant (Node runtime).

## Annahmen

- Admin-Passkey-Sessions nutzen eigenen Cookie `__Host-adm_session` und eigene Tabellen `admin_users` (erweitert) + neue `admin_credentials`, `admin_sessions_v2`? Spec namens `admin_sessions` kollidiert mit bestehender. Entscheidung: neue Tabelle `admin_passkey_sessions` (bzw. `admin_webauthn_sessions`) um Legacy nicht zu brechen. Alternativ bestehende `admin_sessions` erweitern? Spec verlangt `admin_sessions` mit neuen Spalten. Da Legacy Mitarbeiter-Scanner `admin_sessions` (id uuid, email, validUntil) nutzt, können wir bestehende Tabelle nicht umbauen ohne Break. → Neue Tabelle `admin_passkey_sessions` mit Spec-Feldern. Isolation gewahrt.
- `admin_users` wird per ALTER erweitert (nullable neue Spalten) + Seed beider Emails.
- `@simplewebauthn/server`/`browser` v14 installiert.
- AUTH_PEPPER neu; bis gesetzt, Fehler 503. Reuse? Spec: AUTH_PEPPER getrennt von DB. Wir führen `AUTH_PEPPER` ein (Fallback auf AUTH_SECRET? Nein, getrennt). User muss setzen. Für Dev evtl. derive? Nein. Wir fordern env.
- CSRF: /api/admin/me liefert csrfToken. Wir implementieren Route Handlers unter `/api/admin/*`.
- Frontend: neue Seiten `/[locale]/admin/enroll` und security settings; Login umbauen. Feature-Flag `ADMIN_AUTH_V2`.

## Offene Fragen

1. Soll die alte Email-OTP/TOTP-Admin-Auth nach Enrollment beider Admins entfernt werden (Legacy-Pfad), oder parallel bleiben? Spec: entfernen erst nach Verifikation. Ich baue parallel hinter Flag.
2. DB-Zugriff für CLI: DATABASE_URL direct. OK.
3. RP ID: `www.maurer-events.com` vs `maurer-events.com`. Passkeys mit RP ID `maurer-events.com` funktionieren auch auf `www.` und Subdomains. Empfehle `maurer-events.com` (breiter). User bestätigen? Für localhost `localhost`. Ich setze Default `maurer-events.com` in .env.example, aber env überschreibt.
4. Soll ich echte DB-Migration ausführen (db:migrate) oder nur SQL/Migration files? Ich werde Migration files + drizzle schema erzeugen; Ausführung nur nach Freigabe (destruktiv? additiv, aber DB-Schreibzugriff). Ich kann `db:migrate` lokal ausführen zum Testen; erfordert DATABASE_URL. Machbar. Ich werde es ausführen, da additiv.
5. Tests mit virtuellen Authenticators: Playwright CDP. Komplex; ich werde Unit-Tests für Hash/Token/Crypto und Integration-Smokes, nicht volle CDP-Matrix.

## Deliverables (Scope dieser Implementierung)

- Migration 0035_admin_passkey_auth.sql + Drizzle schema.
- Lib: webauthn.ts, crypto helpers, admin-passkey-session, audit-chain, rate-limit (existing reuse).
- API routes: /api/admin/auth/*, /api/admin/me, credentials, sessions, admins, audit, enroll.
- CLI: admin:enroll, admin:break-glass, admin:audit-verify, admin:cleanup.
- Frontend: Login passkey-first, Enroll wizard, Security settings (basic).
- Docs: RUNBOOK.md, SECURITY.md, KUNDE-ANLEITUNG.md, .env.example updates.
- Tests: unit + integration smoke.

Ich fahre fort; bei Blockern melde ich.