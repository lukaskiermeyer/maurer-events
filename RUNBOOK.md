# RUNBOOK — Admin-Auth: Passwort + TOTP

## Überblick
Login = E-Mail + Passwort (Argon2id, hash-wasm) → TOTP (Google Authenticator, otpauth-Bibliothek).
Recovery: Passwort-Reset per Mail (TOTP bleibt Pflicht!), Recovery-Codes, Break-Glass-CLI.
Sessions: `__Host-adm_session` (gehasht, Idle 24 h, absolut 30 Tage). MFA-Fenster: `__Host-adm_mfa` (5 min, single-use, DB-gebunden).
Kritische Aktionen (`/api/admin/admins/*`): Session + frisches TOTP ≤ 5 min (Step-up).

## Wichtige Env-Variablen
- `TOTP_ENC_KEY` — AES-256-GCM-Schlüssel für TOTP-Secrets at rest (≥ 32 Zeichen, eigenständig).
- `AUTH_PEPPER` — HMAC-Pepper (Token-Hashes, Recovery-Codes, IP-Hashes).
- `AUTH_SECRET` — Legacy-Schlüssel; wird nur noch zum Entschlüsseln alter TOTP-Blobs benötigt.
- `ADMIN_EMAILS` — Allowlist für die CLI-Skripte.
- `SESSION_IDLE_HOURS=24`, `SESSION_ABSOLUTE_DAYS=30`, `STEP_UP_TTL_SECONDS=300`.

## Bootstrap Entwicklung (Dev-Account hat bereits TOTP!)
Der Dev-Account hello@madebylui.net hat sein TOTP-Secret behalten (migriert, nicht neu erzeugt).
Deshalb NICHT den Invite-Wizard nutzen (der würde das TOTP neu setzen), sondern:

```
npm run admin:break-glass -- --email hello@madebylui.net --reason "bootstrap" --password "<neues-passwort-min-12-zeichen>"
```

Setzt das Passwort direkt (TOTP bleibt unverändert), widerruft alle Sessions, auditiert.
Danach: `/admin/login` → Passwort + Code aus dem Authenticator.

## Kunden-Einladung (servus@maurer-events.com)
1. Einloggen, `/admin/settings/admins` öffnen.
2. „Admin hinzufügen": E-Mail eintragen → frisches TOTP eingeben (Step-up).
3. Angezeigten Link + EINMALIGE PIN an den Kunden übergeben:
   Link per Mail (passiert automatisch), PIN telefonisch/anderer Kanal — niemals in dieselbe Mail.
4. Kunde öffnet Link → Passwort setzen → QR scannen → Code bestätigen → Recovery-Codes sichern.
5. Alternativ per CLI: `npm run admin:enroll -- --email servus@maurer-events.com --ttl 72h`

## Passwort-Reset (Kunde hat Passwort vergessen)
`/admin/settings/admins` → „Passwort-Reset senden" (Step-up nötig).
Setzt NUR das Passwort; TOTP bleibt Pflicht; alle Sessions werden widerrufen; Mail geht raus.
Identische Antwort unabhängig von Konto-Existenz (keine Enumeration). Limits: 3 Mails/h pro Konto, 10/h pro IP.

## Handy verloren (TOTP-Reset)
`/admin/settings/admins` → Danger Zone → „TOTP-Reset starten" (Step-up, Bestätigung mit E-Mail-Eintippen).
Erzeugt 30-min-Link, widerruft beim Verbrauch alle Sessions, Mails an beide Admins, Audit.
Der letzte aktive Admin kann nicht resettet oder entfernt werden.

## Break-Glass (kein Zugriff mehr, aber Server-Zugriff)
```
npm run admin:break-glass -- --email <allowlist-mail> --reason "<text>" [--password "<neu>"]
```
Printet totp_reset-Link + PIN (30 min), widerruft alle Sessions + Trusted Devices, auditiert.

## Rate-Limits / Sperren
- Passwort: 5 Versuche / 15 min → 15 min Sperre (`locked_until`).
- TOTP: 5 Versuche / 5 min → 15 min Sperre. Replay-geschützt (`totp_last_used_step`).
- Reset-Mail: 3/h Konto, 10/h IP.

## Migrationen
- `node --env-file=.env.local scripts/db-migrate.mjs` (lokal; Deploy: `npm run db:migrate`).
- `npm run admin:migrate-secrets` — überführt bestehende TOTP-Secrets/Recovery-Codes aus
  `admin_mfa` nach `admin_users`/`admin_recovery_codes` (idempotent, 2. Lauf ändert nichts).
- Passkey-Tabellen (`admin_credentials`, `admin_passkey_sessions`, `admin_challenges`) und
  `admin_mfa` bleiben unangetastet liegen — DROP erst in einer Folgemigration nach Abnahme.

## Tests (Beweise)
```
npm run test:admin-auth
```
17 Checks: Reset-Invariante, Replay, Sperren, single-use Token/Codes, Verschlüsselung at rest,
Argon2/HIBP/Policy, Latenz-Gleichheit, letzter-Admin-Guard, Step-up, Auth-Trennung.

## Audit
`npm run admin:audit-verify` — Hash-Kette prüfen. Umstellungs-Event: `admin.auth.migrated_to_password_totp`.

## Cleanup
`npm run admin:cleanup` (Cron).

## Entfernte Alt-Pfade
Passkey-Login (WebAuthn-Routen, `/admin/enroll`), Mail-OTP-Login (`admin_auth` OTP-Zweig) sind
raus. Legacy `admin_token`-Fallback in `requireAdmin` existiert nur noch mit
`ADMIN_AUTH_LEGACY_BREAKGLASS=true` (Prod: nicht setzen) bzw. in Dev.
