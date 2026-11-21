# Gesamtzusammenfassung – Maurer Events (Datenschutz, Sicherheit, TOMs, Betriebsreife)

Stand: Repository-Stand 2026-11-14. Konsolidiert aus allen Prüfschritten.

---

## 1. Log-Redaction & Header-Config (Patch)

### 1.1 Log-Redaction-Regeln
Zentrale Utility: `src/lib/redact.ts`. Regeln:
1. E-Mail: lokaler Teil maskieren → `m***@example.com`
2. Telefon: nur letzte 4 Ziffern → `XXX-XXX-4567`
3. Namen: Initialen → `M. M.`
4. Tokens/Secrets/Signaturen: `[REDACTED]`
5. Signed URLs: vollständig maskieren
6. URLs: Query-String + Fragment entfernen
7. Request-Bodies: nie loggen (nur Länge + Content-Type)
8. Fehlerobjekte: nur name + gekürzte message (≤500 Zeichen)
9. Objekt-Keys mit PII/Sekret-Wörtern maskieren
10. Cloudinary-URLs: nur public_id oder `[cloudinary-asset]`

Code-Fixes: `staffAuth.ts` (Reset-Link-Log entfernt), `cloudinary.ts` und `cron/cleanup/route.ts` (URLs aus Logs entfernt).

### 1.2 Header-Config (gepatcht in `next.config.mjs`)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (neu)
- `Referrer-Policy: strict-origin` (vorher `strict-origin-when-cross-origin`) → verhindert Leak von signed-URL-Parametern
- Bereits vorhanden: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`, CSP (`object-src 'none'`, `frame-ancestors 'none'`)

Traefik/Docker/CI-Hinweise in `docs/log-redaction-rules.md`.

---

## 2. KI/LLM-Inventar

Einziger LLM-Aufruf im Anwendungscode: `src/lib/translate.ts` → Google Gemini `gemini-1.5-flash` (optional, nur bei gesetztem `GEMINI_API_KEY`), Übersetzung von Veranstaltungs-/Galarietexten. Nur der zu übersetzende Text im Prompt, keine PII.

Zusätzlich (nicht in App deployed): `docs/n8n-festwirt-finder.json` – n8n-Workflow, NVIDIA NIM default, extrahiert öffentliche Festdaten + Kontaktdaten.

**Nicht vorhanden:** OCR, Dokumenten-Extraktion, Bewerber-Screening, Chat, Schichtvorschläge, Embeddings/RAG (belegt durch Dependencies: nur `@google/generative-ai`; keine OpenAI/Anthropic/LangChain; Env-Keys nur `GEMINI_API_KEY`).

**Bewertung:** Art. 22 nicht betroffen (keine automatisierte Entscheidung mit rechtlicher Wirkung). EU-AI-Act: kein Hochrisiko-System.

**Offen:** AVV mit Google, Zero-Retention/No-Training, Drittlandtransfer, Prompt-/Response-Logging, UI-Hinweis gegen versehentliche PII in Event-Texten.

---

## 3. Art. 32 / TOMs

Dokumentiert in `docs/toms.md`. Technische Maßnahmen: TLS (HSTS gepatcht), Verschlüsselung at rest (Neon Standard + Feldverschlüsselung AES-256-GCM für Steuer-ID/SV/IBAN), Zugriffskontrolle (OTP, Allowlist, Turnstile), Pseudonymisierung (Anonymisierung nach 10 Jahren), Audit-Log, Verfügbarkeit (Healthcheck, Docker-Hardening), Löschkonzept (Retention-Job).

**Fehlende Nachweise (16 Punkte):** AVVs (Neon, Cloudinary, Resend, Stripe, Vercel/Coolify, Turnstile), Neon-Region/Tarif/PITR/Branches, DB Least Privilege, Cloudinary-Region/Plan/DPF, Unsigned Preset, Backup/Restore-Test, Incident-Response-Runbook, Audit-Log-Integrität, Dependency-/Container-Scanning, Patch-Prozess, Nutzerzahlen/Saisonprofil/Metriken.

---

## 4. Faktenblatt (Server-Dimensionierung)

`docs/faktenblatt.md` + `.json`. Belegte Fakten:
- Next.js 16.3.8, React 19.2.4, Node 22.x; App Router; 12 API-Routes, 29 Server-Actions.
- Drizzle 0.45.2 + postgres 3.4.9; `prepare: false`; Pool-Größe 5; connect_timeout 30s.
- Neon Pooled Endpoint (eu-central-1, sslmode=require, channel_binding=require); Autosuspend aktiv (Free Tier).
- Upload: Server-Proxy (Next.js → Cloudinary); Größen 10/15 MB.
- Bild-Transformationen on-the-fly (Cloudinary); PDF via pdf-lib (serverseitig).
- Kein Chromium/Playwright im App-Prozess; kein Redis; keine WebSockets/SSE.
- Mail: Resend, synchron im Request-Pfad.
- Cron: `/api/cron/cleanup` alle 5 Min, maxDuration 300s.
- Nutzerzahlen, Saisonprofil, Metriken, N+1, Indizes, Cloudinary-Latenz, Neon-Compute, Steal-Time, RAM/CPU-Peak, sysbench, fio: **MESSEN ERFORDERLICH** (+ Messmethoden dokumentiert).

---

## 5. Mess-Setup

`loadtest/`:
- `k6-mix.js`: realistischer Mix (öffentlicher Teil + Mitarbeiterportal + Contention), Stufen 20/50/150 VUs, Schwellen p95<500ms, Fehler<1%.
- `monitoring-compose.yml`: cadvisor + node_exporter + prometheus (Ressourcen-Mitschnitt).
- `server-benchmark.sh`: sysbench single/multi + fio fsync + mpstat.
- `correctness-test.ts`: 50 parallele Buchungen → genau 1 Erfolg, Rest 409, DB-Count=1; Idempotency-Key zweimal → 1 Datensatz.
- `evaluation-rules.json`: Entscheidungsregeln (4GB/2vCore vs. 8GB/4vCore vs. dedizierte Kerne).

---

## 6. Preisberechnung – Kontext für ein LLM

### 6.1 Grundprinzipien
- Alle Beträge werden intern in **Cent** (Integer) gerechnet; Euro-Werte nur zur Anzeige.
- Preise sind **pro Paket** (`eventSettings.packages`), nicht pro Tisch. Ein Paket hat `price` (Euro), `unit` (`per_person` oder `per_table`), `priceIncludesVat` (Default `true`) und `vatRate` (`0 | 7 | 19`).
- VIP-Aufpreis (`vipCents`) wird als zusätzlicher Cent-Betrag pro Buchung addiert.
- Service-/Buchungsgebühr wird als Stripe-Gebühr berechnet und als eigene Zeile hinzugefügt.
- Kleinstunternehmer-Modus (`tax_status = 'small_business'` in globaler `settings`): keine MwSt., netto = brutto.

### 6.2 Formeln
1. `unitAmount = round(packagePrice * 100)` (Cent)
2. `unitCount = (unit === 'per_table') ? 1 : guestCount`
3. `subtotal = unitAmount * unitCount + vipCents`
4. Servicegebühr:
   - Default: `1.5 %` des Subtotals + `25 Cent` (Stripe-Fee), auf Cent aufgerundet (`ceil`)
   - Falls `customServiceFee` aktiv: `serviceFeePercent` % + `serviceFeeFixedCents`
   - `fee = ceil(subtotalCents * percent + fixedCents)`
5. `total = subtotal + fee` (muss zwischen 50 und 99.999.999 Cent liegen)
6. MwSt. (`packageTax`):
   - Kleinstunternehmer: `gross=net=price`, `vat=0`, `vatRate=0`
   - Normal:
     - `priceIncludesVat=true`: `net = round(priceCents * 100 / (100 + rate))`, `vat = priceCents - net`
     - `priceIncludesVat=false`: `vat = round(priceCents * rate / 100)`, `gross = priceCents + vat`, `net = priceCents`
   - Alle Werte werden für `unitCount` multipliziert (`grossCents * unitCount`, etc.)

### 6.3 Validierungen
- `packagePrice` muss finite, ≥ 0 und `round(price*100)` ein sicheres Integer sein, sonst `null`.
- `vatRate` muss `0`, `7` oder `19` sein (sonst `null`).
- `total` muss `>= 50` und `<= 99.999.999` Cent sein.
- Alle Zwischenwerte müssen sichere, nicht-negative Integer sein.

### 6.4 Wichtige Hinweise für das LLM
- Rechne **immer in Cent**, konvertiere Euro erst am Ende.
- `unitCount` hängt vom Pakettyp ab (`per_person` vs. `per_table`), nicht nur von der Gästeanzahl.
- VIP-Aufpreis wird **nicht** mit `unitCount` multipliziert (nur einmal).
- Servicegebühr wird auf den **gesamten Subtotal** (inkl. VIP) berechnet.
- MwSt.-Breakdown wird mit `unitCount` multipliziert, Servicegebühr und VIP nicht.
- Kleinstunternehmer-Modus setzt MwSt. auf 0, unabhängig vom Paket-`vatRate`.

---

## 7. Projektüberblick für LLM (kompletter Kontext)

### 7.1 Was ist das Projekt?
**Maurer Events** ist eine mehrsprachige (Deutsch/Englisch) Webanwendung für ein Festzelt-/Event-Unternehmen. Sie umfasst:
- Öffentliche Eventseite (Termine, Galerie, Karriere, Kontakt, Rechtstexte)
- Online-Tischreservierung mit Paketauswahl, Stripe-Zahlung, PDF-Tickets und QR-Codes
- Adminbereich für Events, Kunden, Tische, Dokumente, Galerien, Voucher, Scanner, Personal
- Mitarbeiterportal (Onboarding, Verfügbarkeit, Schichten, Verträge, Dokumente)
- Datenschutz-/Compliance-Dokumentation (TOMs, Retention, Audit-Logs)

### 7.2 Tech-Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, next-intl (de/en)
- **Backend:** Next.js Server Actions + API Routes (Node 22)
- **Datenbank:** PostgreSQL (Neon, pooled, eu-central-1), Drizzle ORM 0.45
- **Auth Admin:** WebAuthn/Passkeys, TOTP-MFA, OTP, Recovery Codes, Trusted Devices
- **Auth Mitarbeiter:** E-Mail + Passwort (scrypt), Session-Cookie
- **Zahlung:** Stripe Checkout (Card, PayPal, Klarna, SEPA)
- **Medien:** Cloudinary (Upload, Transformation, PDF via pdf-lib)
- **E-Mail:** Resend (transaktional)
- **Bot-Schutz:** Cloudflare Turnstile
- **KI (optional):** Google Gemini 1.5 Flash für Übersetzungen (`GEMINI_API_KEY`)
- **Hosting:** Vercel oder Docker/Coolify (Netcup), Standalone Port 3000

### 7.3 Kernfeatures
**Öffentlich:**
- Eventliste mit Detailseiten, Tischplan, Reservierungsformular
- Paketauswahl (per Person / per Tisch), VIP-Aufpreis, Servicegebühr
- Stripe-Checkout, Zahlungsbestätigung, PDF-Ticket mit QR-Code
- Warteliste, Voucher/Gutscheine
- Galerie, Karriereseite, Kontakt, Impressum/Datenschutz

**Admin:**
- Events anlegen/bearbeiten (mehrsprachig, Auto-Übersetzung)
- Tischplan (Positionen, Kapazitäten, VIP, Druck)
- Reservierungen verwalten, manuelle Buchungen, E-Mail-Versand
- Kunden-CRM + CSV-Import
- Dokumente (Menü/Programm), Galerien, Voucher
- Scanner-Zugänge, Einlass-App
- Mitarbeiterverwaltung (Rollen, Verträge, Minijob-Formulare, Dokumente)
- Personalplanung (Bedarf pro Rolle/Datum/Schicht, Auto-Zuweisung, manuelle Zuteilung, Abdeckung)
- Fest-Chancen & Vereins-Radar (Lead-Management)
- DATEV-Payroll-Export

**Mitarbeiterportal (`/team`):**
- Login, Onboarding (Profil, Dokumente, Vertrag)
- Verfügbarkeit eintragen
- Schichten einsehen/annehmen/ablehnen, Selbst-Eintragung bei offenen Schichten
- ICS-Kalender-Export

### 7.4 Datenmodell (Kern-Tabellen)
- `events`, `tables`, `reservations`, `customers`, `waitlists`, `vouchers`
- `event_settings` (Pakete, Zeitfenster, Servicegebühr, Tischregeln)
- `staff`, `staff_roles`, `staff_documents`, `contracts`, `contract_templates`
- `staff_availability`, `event_staff_requirements`, `staff_assignments`, `shift_offers`
- `admin_users`, `admin_sessions`, `admin_audit_log`, `audit_log`
- `fest_opportunities`, `fest_chances`, `vereins_radar`
- `settings` (key/value, z. B. `tax_status`)

### 7.5 Sicherheit & Compliance
- Admin-Auth: Passkeys (WebAuthn), TOTP-MFA, OTP, Recovery Codes, Trusted Devices, Step-Up
- Mitarbeiter-Auth: scrypt, Session-Cookie, Rate-Limits
- Bot-Schutz: Cloudflare Turnstile auf Checkout
- Verschlüsselung: AES-256-GCM für Steuer-ID, SV-Nummer, IBAN (Feldverschlüsselung)
- Audit-Logs (Admin + Staff), Redaction von PII in Logs
- HTTP-Security-Header: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Rate-Limiting, Idempotency-Keys, Advisory Locks bei Buchungen
- DSGVO: Retention-Job, Anonymisierung nach 10 Jahren, Datenschutzerklärung, Verarbeitungsverzeichnis
- Cron: `/api/cron/cleanup` (alle 5 Min) für abgelaufene Reservierungen/Sessions

### 7.6 Integrationen
- **Stripe:** Checkout, Webhooks, Zahlungsbestätigung
- **Cloudinary:** Bild-/PDF-Upload, Transformation, Signed URLs
- **Resend:** Transaktionale E-Mails (Zuweisungen, Einladungen, Tickets)
- **Neon:** PostgreSQL (pooled, SSL, channel binding)
- **Turnstile:** CAPTCHA
- **Gemini:** Optionale Übersetzung (nur bei `GEMINI_API_KEY`)
- **n8n:** Festwirt-Finder Workflow (NVIDIA NIM, öffentliche Daten)

### 7.7 Entwicklung & Betrieb
- Node 22, PostgreSQL lokal (Port 55439 für Tests)
- Tests: `npm run test:security`, `test:onboarding`, `test:acceptance`, `test:browser`
- Migrationen: Drizzle (`npm run db:migrate`)
- Docker: Standalone auf Port 3000, Coolify/Vercel Deployment
- Umgebungsvariablen: `.env.example` / `.env.local`

### 7.8 Wichtige Pfade
- `src/app/[locale]/` – öffentliche + Admin-Seiten (i18n)
- `src/app/actions/` – Server Actions (events, reservations, staff, staffing, settings)
- `src/lib/` – Geschäftslogik (pricing, checkout, reservation-policy, staffing, auth)
- `src/db/schema.ts` – Drizzle-Schema
- `docs/` – Datenschutz, TOMs, Admin-Guide, Deployment, Testing

---

## 6. Konsolidierter Maßnahmenplan

`docs/massnahmenplan.md` + `.json`, `docs/checkliste.md`.

### Top-10-Sofortmaßnahmen
1. Log-Redaction einführen (`src/lib/redact.ts`)
2. Header härten (`next.config.mjs` – gepatcht)
3. Passwort-Reset-Link nicht loggen (`staffAuth.ts`)
4. Cloudinary-URLs aus Logs entfernen
5. Cloudinary-Secret rotieren + Git-History bereinigen
6. Unsigned Upload Preset deaktivieren/absichern
7. Event-Dokumente bei Event-Löschung purgen
8. EXIF/GPS bei Team-Upload strippen
9. Cleanup-Runs persistieren (`cleanup_runs`-Tabelle)
10. Redaction in Error-Tracking (`beforeSend`)

### Go-Live-Blocker
AVVs (Neon, Cloudinary, Resend, Stripe, Vercel/Coolify, Turnstile), Neon Prod-Region, DB Least Privilege, Backup/PITR + Restore-Test, Incident-Response-Runbook + 72h-Meldepfad, Löschwirksamkeit in Backups, Korrektheitstest, Lasttest.

### Kunde (Festwirt als Verantwortlicher)
Verarbeitungsverzeichnis, Datenschutzerklärung, Löschfristen, DSFA (Gesundheitsdaten), Betriebsrat, Kontaktpostfach, Entscheidung Art.-9-Feldverschlüsselung.

### Auftragsverarbeiter (ich)
Code-Fixes, TOMs vervollständigen, Mess-Setup, Audit-Log manipulationssicher, Dependency-/Container-Scanning, Patch-Prozess, Restore-Test, `.env.local` entfernen.

### Anbieter-Fragen
Neon, Cloudinary, Google Gemini, Resend, Stripe, Vercel/Coolify, Turnstile/Cloudflare (mit Prüffundstellen in den Audits).

### Zeitplan
- Vor Go-Live: Blocker + Sofortmaßnahmen + AVVs + Backup/Restore + Lasttest + Korrektheitstest + TOMs
- Vor Festbeginn: Nutzerzahlen/Saisonprofil + Skalierung + Monitoring
- Laufend: Scanning + Patch + Audit-Review + Drills + Retention-Überwachung

---

## Geänderte Dateien (Code)
- `next.config.mjs` – HSTS + Referrer-Policy
- `src/lib/redact.ts` – neu
- `src/app/actions/staffAuth.ts` – Reset-Link-Log entfernt
- `src/lib/cloudinary.ts` – URLs aus Logs entfernt
- `src/app/api/cron/cleanup/route.ts` – URLs aus Logs entfernt

## Neue Dokumente
- `docs/log-redaction-rules.md`
- `docs/ki-inventar.md`
- `docs/toms.md`
- `docs/faktenblatt.md` / `.json`
- `docs/massnahmenplan.md` / `.json`
- `docs/checkliste.md`
- `docs/gesamtzusammenfassung.md`
- `loadtest/*` (k6, monitoring, benchmark, correctness, evaluation-rules)

TypeScript kompiliert fehlerfrei. Lint-Fehler sind vorbestehende `no-html-link-for-pages`-Regeln.
