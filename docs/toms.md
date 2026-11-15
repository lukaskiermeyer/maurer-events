# TOMs-Dokumentationsgerüst (Art. 32 DSGVO)

## 1. Technische Maßnahmen

### 1.1 TLS / Transportverschlüsselung
- Alle Endpunkte HTTPS (Vercel/Coolify-Termination). HSTS: `max-age=63072000; includeSubDomains; preload` (next.config.mjs, gepatcht).
- DB-Verbindung: `sslmode=require` (+ `channel_binding=require` in Staging); `.env.example` warnt vor TLS-Deaktivierung.
- Cloudinary: `secure_url` (HTTPS).
- Stripe/Resend: HTTPS-only SDKs.
- **Offen:** TLS-Version/Cipher-Suite-Konfiguration am Reverse-Proxy (Traefik/Coolify) nicht im Repo belegt → VERIFIZIEREN.

### 1.2 Verschlüsselung at rest
- Neon: Standard-Verschlüsselung at rest (Neon-managed). Algorithmus/KMS → VERIFIZIEREN.
- Feldverschlüsselung: `src/lib/secure-fields.ts` AES-256-GCM für `taxIdEnc`, `socialSecurityEnc`, `ibanEnc` (Key: `STAFF_DATA_KEY`, SHA-256-Derivation).
- Passwörter: scrypt. OTP-Codes: HMAC.
- Nicht verschlüsselt (Klartext in Neon): `birthDate`, `healthInsurance`, `phone`, `email`, `street`, `zip`, `city`, `bic`, `hourlyRateCents`, `monthlySalaryCents`, `taxClass`, `childAllowances`.
- Gesundheitszeugnis-Dateien: Cloudinary (nicht feldverschlüsselt) → VERIFIZIEREN (Cloudinary-Encryption-at-rest).
- **Offen:** Key-Rotation für `STAFF_DATA_KEY` nicht implementiert (kein Re-Encryption-Job).

### 1.3 Zugriffskontrolle
- Admin-Login: OTP per E-Mail, Allowlist (`ADMIN_EMAILS`), Turnstile (Captcha) für `admin-login`.
- Staff-Login: OTP/Session, Status `inactive` → sofortige Session-Löschung.
- DB: Ein User `neondb_owner` mit Owner-Rechten (Least Privilege NICHT umgesetzt) → VERIFIZIEREN/VERBESSERN.
- Cloudinary: Server-Proxy, kein Client-Secret im Bundle. Unsigned Preset aktiv → VERIFIZIEREN/DEAKTIVIEREN.
- **Offen:** 2FA für Coolify/SSH/Neon-Dashboard nicht im Repo belegbar → VERIFIZIEREN.

### 1.4 Pseudonymisierung / Datenminimierung
- Staff-Anonymisierung nach 10 Jahren (Retention-Job).
- E-Mail-Marker `anonymized-…@deleted.invalid` für idempotente Anonymisierung.
- `maskField` für Anzeige sensibler Felder.
- **Offen:** Datensparsamkeit bei `ticket_email_payload`/`checkout_params` (jsonb) → prüfen, ob mehr Daten als nötig.

### 1.5 Integrität / Audit-Log
- `audit_log`-Tabelle (Retention 10 Jahre für staff/payroll/contract, 2 Jahre sonst).
- `createdBy`/`updatedBy` auf Tabellen.
- Stripe-Webhook-Signaturprüfung.
- CRON_SECRET für Cleanup-Endpoint.
- **Offen:** Audit-Log manipulationssicher? Keine Hash-Kette/Append-Only belegt → VERIFIZIEREN.

### 1.6 Verfügbarkeit / Resilienz
- Healthcheck `/api/health` (DB + Sicherheitsfelder).
- Docker: Non-Root-User, `no-new-privileges`, `cap_drop: ALL`.
- Pool-Größe 5, connect_timeout 30s (Cold-Start-Toleranz).
- Cleanup alle 5 Minuten (Holds, Ticket-Retry, Session-Purge).
- **Offen:** Backup/PITR-Aufbewahrung, Restore-Test, RPO/RTO nicht festgelegt.

### 1.7 Löschkonzept
- `src/lib/retention.ts` `runRetentionCleanup()`: 4 Schritte (ID/Gesundheits-Purge 365 Tage, 10-Jahres-Anonymisierung, Invites/Sessions/Payroll/Imports, Audit-Fristen).
- Soft-Delete Events nach 7 Tagen (nur ohne Reservierungen).
- Cloudinary-Purge bei Staff-Erasure und Event-Löschung (best-effort).
- **Offen:** Cloudinary Backups/Versioning; Löschwirksamkeit in Neon-PITR; persistenter Cleanup-Log.

### 1.8 Incident-Response
- **Offen:** Kein dokumentierter 72h-Meldepfad (Art. 33), kein Kontakt zum Verantwortlichen, keine Erkennung/Alarmierung im Code (nur `console.error` + HTTP 500).
- **Offen:** Kein Incident-Response-Runbook im Repo.

## 2. Organisatorische Maßnahmen

### 2.1 Rollen/Zugriff
- Admin-Allowlist via `ADMIN_EMAILS`. Kein Self-Service-Admin-Registrierung.
- Staff-Rollen: `admin`, `manager`, `staff` (schema).
- **Offen:** Zugriffsmatrix (wer hat Zugriff auf Coolify/Neon/Vercel/Cloudinary/Stripe/Resend) nicht dokumentiert.

### 2.2 Patch-Prozess / Dependency-Scanning
- `npm ci` (lockfile). ESLint mit `--max-warnings 0`.
- **Offen:** Kein automatisches Dependency-/Container-Scanning (Dependabot/Renovate, Trivy) belegt.
- **Offen:** Kein dokumentierter Patch-Prozess (SLA für Sicherheitsupdates).

### 2.3 DoS-Schutz
- Rate-Limiting: `src/lib/rate-limit.ts` (DB-basiert, pro IP/User).
- Turnstile für öffentliche Formulare (checkout, waitlist, contact, admin-login).
- `serverActions.bodySizeLimit: '4mb'`.
- Upload-Größenlimits (10/15 MB).
- **Offen:** Kein WAF/CDN-Rate-Limiting belegt; Neon-Autosuspend als unbeabsichtigter DoS-Schutz.

### 2.4 Verfügbarkeit im Festbetrieb
- Cleanup alle 5 Minuten. Healthcheck 30s/3 Versuche.
- **Offen:** Skalierung (1 Instanz), kein Load-Balancing, kein Auto-Scaling belegt.
- **Offen:** Festtermine/Saisonprofil nicht dokumentiert (MESSEN ERFORDERLICH).

## 3. Fehlende Nachweise (Liste)

1. AVV mit Neon/Databricks (unterschrieben) + Unterauftragnehmer (AWS).
2. AVV mit Cloudinary (Free-Tier: DPA i. d. R. erst ab bezahltem Plan).
3. AVV mit Resend, Stripe, Vercel/Coolify-Hoster, Turnstile.
4. Neon-Region des Prod-Projekts (eu-central-1 belegt für Staging).
5. Neon-Tarif, PITR-Aufbewahrung, Autosuspend-Status.
6. Neon-Branches mit Prod-Daten (Preview-Branches).
7. DB-Rolle Least Privilege (App vs. Migration).
8. Cloudinary-Region/Plan/DPF.
9. Unsigned Upload Preset Konfiguration (Console).
10. Backup-Verschlüsselung + Restore-Test (Neon, Cloudinary, Coolify-Config, Env).
11. Incident-Response-Runbook + 72h-Meldepfad.
12. Audit-Log-Integrität (Hash-Kette/Append-Only).
13. Dependency-/Container-Scanning-Ergebnisse.
14. Patch-Prozess-Dokument.
15. Nutzerzahlen (Mitarbeiter/Gäste) und Saisonprofil.
16. Metriken (RAM/CPU/p95) – MESSEN ERFORDERLICH.
