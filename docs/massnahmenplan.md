# Konsolidierter Maßnahmenplan (priorisiert)

Priorisierung: Risiko für betroffene Personen zuerst, dann Aufwand. Quellen: neon-audit.md, cloudinary-audit.md, toms.md, ki-inventar.md, privacy-review.md, retention-matrix.md, unterauftragsverarbeiter-register.md, deployment.md, coolify.md.

## 1) Top-10-Sofortmaßnahmen (konkrete Code-/Config-Änderungen)

| # | Maßnahme | Datei/Stelle | Änderung |
|---|----------|--------------|----------|
| 1 | Log-Redaction einführen | `src/lib/redact.ts` (neu) + alle `console.*` | `safeLog/safeError/safeWarn` nutzen; PII maskieren (E-Mail, Telefon, Namen, Tokens, URLs). |
| 2 | Header härten | `next.config.mjs` | HSTS + Referrer-Policy `strict-origin` (gepatcht). CSP `object-src 'none'` bleibt. |
| 3 | Passwort-Reset-Link nicht loggen | `src/app/actions/staffAuth.ts:90` | `console.log("PASSWORD RESET LINK:", resetUrl)` entfernen; stattdessen nur "reset requested" + Redaction. |
| 4 | Cloudinary-URLs aus Logs entfernen | `src/lib/cloudinary.ts`, `src/app/api/cron/cleanup/route.ts:85,98` | URLs nicht loggen; nur public_id oder `[cloudinary-asset]`. |
| 5 | Cloudinary-Secret rotieren + History bereinigen | `scripts/test-cloudinary-permissions.ts` (bereits auf Env umgestellt) | Secret in Cloudinary rotieren; Git-Historie bereinigen (git filter-repo). |
| 6 | Unsigned Upload Preset deaktivieren/absichern | Cloudinary-Console + `CLOUDINARY_UPLOAD_PRESET` | Preset auf signed-only oder strikt (Folder/Format/Größe) begrenzen. |
| 7 | Event-Dokumente bei Event-Löschung purgen | `src/app/api/cron/cleanup/route.ts` | Cloudinary-Purge für `event_documents` bei Event-Hard-Delete ergänzen (aktuell Orphans). |
| 8 | EXIF/GPS strippen bei Team-Upload | `src/app/api/team/upload/route.ts` | Bild über sharp verarbeiten vor Upload (wie Admin-Route). |
| 9 | Cleanup-Runs persistieren | Neue Tabelle `cleanup_runs` + `src/lib/retention.ts` | Start/Ende/Status/Zähler persistieren; Alarmierung bei Fehler/ausbleibendem Lauf. |
| 10 | Redaction in Error-Tracking | Sentry/ähnlich `beforeSend` | `sendDefaultPii: false`; Cookies/Headers filtern; Request-Bodies deaktivieren. |

## 2) Go-Live-Blocker (ohne Fix nicht live)

- AVV mit Neon/Databricks (Drittlandtransfer USA, AWS-Unterauftragnehmer).
- AVV mit Cloudinary (Free-Tier: DPA i. d. R. erst ab bezahltem Plan) → Plan upgraden oder Anbieter wechseln.
- AVV mit Resend, Stripe, Vercel/Coolify-Hoster, Turnstile.
- Neon-Region des Prod-Projekts verifizieren (eu-central-1 belegt für Staging).
- DB-Rolle Least Privilege (App nicht als `neondb_owner`).
- Backup/PITR-Aufbewahrung + Restore-Test dokumentiert.
- Incident-Response-Runbook + 72h-Meldepfad (Art. 33).
- Löschwirksamkeit in Backups (Neon-PITR, Cloudinary-Backups/Versioning).
- Korrektheitstest bestanden (Contention + Idempotency).
- Lasttest bestanden (p95<500ms, Fehler<1% bei 50 VUs).

## 3) Aufgaben für den Kunden (Festwirt als Verantwortlicher)

- Verarbeitungsverzeichnis (Art. 30) aktualisieren (Anbieter, Regionen, Fristen).
- Informationspflichten (Datenschutzerklärung) auf tatsächliche Anbieter/Regionen anpassen.
- Löschfristen festlegen (Reservierungen, Staff, Audit-Logs) und mit Retention-Matrix abgleichen.
- Ggf. DSFA bei Hochrisiko-Verarbeitung (Gesundheitsdaten der Mitarbeiter).
- Ggf. Betriebsrat bei Mitarbeiterdaten (Gesundheitszeugnis, Steuer-ID, SV-Nummer).
- Kontaktpostfach für Datenschutzanfragen bereitstellen.
- Entscheidung zu Art.-9-Feldverschlüsselung (Geburtsdatum, Krankenkasse, Gesundheitszeugnis).

## 4) Aufgaben für mich (Auftragsverarbeiter)

- Code-Fixes (Top-10).
- TOMs-Dokumentation (`docs/toms.md`) vervollständigen.
- Mess-Setup durchführen (`loadtest/`) und Ergebnisse dokumentieren.
- Audit-Logs manipulationssicher machen (Hash-Kette/Append-Only) – prüfen.
- Dependency-/Container-Scanning einrichten (Dependabot/Renovate, Trivy).
- Patch-Prozess dokumentieren (SLA).
- Restore-Test durchführen und dokumentieren.
- `.env.local` aus Arbeitsverzeichnis entfernen nach Abschluss (enthält echte Credentials).

## 5) Offene Fragen an Anbieter (mit Prüffundstelle)

| # | Anbieter | Frage | Prüffundstelle |
|---|----------|-------|----------------|
| 1 | Neon | Prod-Region, Tarif, PITR-Aufbewahrung, Autosuspend, Branches mit Prod-Daten, at-rest-Encryption, AVV | `docs/neon-audit.md` §1-4, §7 |
| 2 | Cloudinary | Region/EU, Plan (DPA), DPF, Unsigned Preset Config, Backup/Versioning, at-rest-Encryption | `docs/cloudinary-audit.md` §7, §5d |
| 3 | Google (Gemini) | AVV, Zero-Retention/No-Training, Drittlandtransfer, Region | `docs/ki-inventar.md` |
| 4 | Resend | AVV, Region, TLS, Aufbewahrung | `docs/unterauftragsverarbeiter-register.md` |
| 5 | Stripe | AVV, Region, Datenminimierung | `docs/unterauftragsverarbeiter-register.md` |
| 6 | Vercel/Coolify-Hoster | AVV, Region, Logs-Retention | `docs/coolify.md`, `docs/deployment.md` |
| 7 | Turnstile (Cloudflare) | AVV, Region, Datenverwendung | `docs/unterauftragsverarbeiter-register.md` |

## 6) Zeitplan

- **Vor Go-Live:** Top-10-Sofortmaßnahmen, Go-Live-Blocker, AVVs, Backup/Restore-Test, Lasttest + Korrektheitstest, TOMs-Dokument.
- **Vor Festbeginn:** Nutzerzahlen/Saisonprofil messen, Skalierung prüfen, Monitoring/Alarmierung aktivieren, Cleanup-Run-Log.
- **Laufend:** Dependency-/Container-Scanning, Patch-Prozess, Audit-Log-Review, Incident-Drills, Retention-Job-Überwachung.

## 7) Konsolidierter JSON-Export

Siehe `docs/massnahmenplan.json`.

## 8) Markdown-Checkliste

Siehe `docs/checkliste.md`.
