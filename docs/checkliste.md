# Checkliste (abhakbar)

## Sofortmaßnahmen (Code/Config)
- [ ] `src/lib/redact.ts` in allen `console.*` nutzen
- [ ] HSTS + Referrer-Policy `strict-origin` deployen (next.config.mjs)
- [ ] `staffAuth.ts` Passwort-Reset-Link-Log entfernen
- [ ] Cloudinary-URLs aus Logs entfernen
- [ ] Cloudinary-Secret rotieren + Git-History bereinigen
- [ ] Unsigned Upload Preset deaktivieren/absichern
- [ ] Event-Dokumente bei Event-Löschung purgen
- [ ] EXIF/GPS bei Team-Upload strippen
- [ ] `cleanup_runs`-Tabelle + persistente Protokollierung
- [ ] Error-Tracking Redaction (`beforeSend`)

## Go-Live-Blocker
- [ ] AVV Neon/Databricks
- [ ] AVV Cloudinary (Plan-Upgrade)
- [ ] AVV Resend, Stripe, Vercel/Coolify, Turnstile
- [ ] Neon Prod-Region verifiziert
- [ ] DB-Rolle Least Privilege
- [ ] Backup/PITR + Restore-Test dokumentiert
- [ ] Incident-Response-Runbook + 72h-Meldepfad
- [ ] Löschwirksamkeit in Backups
- [ ] Korrektheitstest bestanden
- [ ] Lasttest bestanden (p95<500ms, Fehler<1%)

## Kunde (Festwirt)
- [ ] Verarbeitungsverzeichnis aktualisiert
- [ ] Datenschutzerklärung angepasst
- [ ] Löschfristen festgelegt
- [ ] DSFA (falls Gesundheitsdaten)
- [ ] Betriebsrat (falls Mitarbeiterdaten)
- [ ] Kontaktpostfach Datenschutz
- [ ] Entscheidung Art.-9-Feldverschlüsselung

## Auftragsverarbeiter (ich)
- [ ] Code-Fixes (Top-10)
- [ ] TOMs-Dokument vervollständigt
- [ ] Mess-Setup durchgeführt + dokumentiert
- [ ] Audit-Log manipulationssicher
- [ ] Dependency-/Container-Scanning
- [ ] Patch-Prozess dokumentiert
- [ ] Restore-Test durchgeführt
- [ ] `.env.local` entfernt

## Anbieter-Fragen
- [ ] Neon (Region, Tarif, PITR, Branches, AVV)
- [ ] Cloudinary (Region, Plan, DPF, Preset, Backup)
- [ ] Google Gemini (AVV, Zero-Retention, Region)
- [ ] Resend (AVV, Region)
- [ ] Stripe (AVV, Region)
- [ ] Vercel/Coolify (AVV, Logs-Retention)
- [ ] Turnstile/Cloudflare (AVV, Region)

## Zeitplan
- [ ] Vor Go-Live: Blocker + Sofortmaßnahmen
- [ ] Vor Festbeginn: Messung + Skalierung + Monitoring
- [ ] Laufend: Scanning + Patch + Audit + Drills
