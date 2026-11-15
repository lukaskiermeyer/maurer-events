# Unterauftragsverarbeiter-Register (Sub-Processor Register)

**Maurer Events – Reservierungs- und Ticketing-Plattform**

| Feld | Angabe |
|---|---|
| Dokument | Unterauftragsverarbeiter-Register (Art. 28 Abs. 2/3, Art. 30 DSGVO) |
| Stand | 14. November 2026 |
| Verantwortlicher (Controller) | Festwirt (Betreiber der Plattform; Konten laufen auf seinen Namen, siehe `business/kosten.md` § 1) |
| Auftragsverarbeiter (Processor) | Agentur / Entwickler (MadeByLui) – Betrieb, Wartung, Weiterentwicklung |
| System | Next.js-App, PostgreSQL (Neon), Cloudinary-Medien, Stripe-Zahlungen, Resend-Mail, Cloudflare Turnstile, Google Gemini (Admin-Übersetzung), netcup-Hosting (Coolify), netcup Storage Box (Backup) |
| Verwandte Dokumente | `docs/privacy-review.md`, `docs/neon-audit.md`, `docs/retention-matrix.md`, `docs/coolify.md`, `docs/deployment.md`, `src/lib/privacy-notice.ts` |
| Status | Entwurf zur Verifikation – alle mit **VERIFIZIEREN** markierten Punkte sind extern (Provider-Portalen/DPA/Trust Center) zu prüfen und zu ergänzen. |

> **Legende**
> - **VERIFIZIEREN** = im Repository nicht belegbar; Prüffrage und Fundstelle (DPA/Trust Center/Portal) angegeben.
> - **Kritisch** = Free-Tier ohne abgeschlossenen AVV bzw. fehlende Drittlandgarantie – vor Livebetrieb mit echten Gästedaten zu klären.
> - **Art. 9** = besondere Kategorien personenbezogener Daten (Gesundheit, Biometrie, etc.) sind betroffen.
> - Regionenangaben beziehen sich auf den **tatsächlichen Verarbeitungsort**, nicht auf den Vertragssitz.

---

## 0. Geltungsbereich und Methodik

Dieses Register listet alle Dienstleister, an die personenbezogene Daten der Plattform
übermittelt oder die im Auftrag des Verantwortlichen personenbezogene Daten verarbeiten
(„Unterauftragsverarbeiter" / Sub-Processor). Grundlage ist die Codebasis (Dependencies,
Env-Variablen, Schema, Routen) sowie die Dokumentation im Repository. Es ersetzt keine
Rechtsberatung und keine unterzeichneten Verträge.

Datenkategorien werden anhand von `src/db/schema.ts` abgeleitet (Gäste, Reservierungen,
Personal, Verträge, Admin/Auth, Fest-Opportunities). Retentionsangaben stammen aus
`docs/retention-matrix.md` und `src/lib/retention.ts` (Anwendungsebene); Provider-seitige
Retention ist, soweit nicht code-belegt, als **VERIFIZIEREN** markiert.

---

## 1. Zusammenfassungsmatrix

| # | Anbieter | Rolle | Art. 9? | Sitz (Vertrag) | Verarbeitungsregion | AVV belegt? | Drittland? | Kritikalität |
|---|---|---|---|---|---|---|---|---|
| 1 | Neon (Databricks/Neon, LLC) | Primärdatenbank | Ja (indirekt) | USA (Neon, LLC) | EU: eu-central-1 (AWS Frankfurt) – VERIFIZIEREN Prod | **Nein (VERIFIZIEREN)** | Support-Zugriff aus USA möglich | **Kritisch** (Free-Tier, kein AVV belegt) |
| 2 | Cloudinary | Medienspeicher/-CDN | Ja (Gesundheitszeugnis, Ausweiskopien) | USA/Israel – VERIFIZIEREN | VERIFIZIEREN (Default-Region) | **Nein (VERIFIZIEREN)** | Ja (USA/Israel) | **Kritisch** (Free-Tier, kein AVV belegt) |
| 3 | netcup | Hosting (VPS/Coolify) | Ja (indirekt, Backups) | Deutschland (Karlsruhe) | Deutschland – VERIFIZIEREN (DC) | VERIFIZIEREN (AVV im Portal) | Nein (EU) | Mittel |
| 4 | Cloudflare | Turnstile, DNS, CDN, WAF, Rate-Limit | Nein | USA (San Francisco) | Global (Edge) | VERIFIZIEREN | Ja (USA, global) | Mittel |
| 5 | Resend | Transaktionale E-Mails | Nein | USA | VERIFIZIEREN (AWS-Region) | **Nein (VERIFIZIEREN)** | Ja (USA) | **Kritisch** (Free-Tier, kein AVV belegt) |
| 6 | Google (Gemini API) | Admin-Übersetzung (optional) | Nein | USA | VERIFIZIEREN (global) | **Nein (VERIFIZIEREN)** | Ja (USA) | **Kritisch** (Free-Tier, Trainingsnutzung prüfen) |
| 7 | Error-Tracking/Analytics | – | – | – | – | nicht eingesetzt | – | Offen (VERIFIZIEREN ob geplant) |
| 8 | Backup-Ziel (netcup Storage Box) | DB-/Medien-Backups | Ja (indirekt) | Deutschland | Deutschland – VERIFIZIEREN | VERIFIZIEREN | Nein (EU) | Mittel |
| 9 | Stripe | Zahlungsabwicklung | Nein | Irland (Stripe Payments Europe) / USA | VERIFIZIEREN (EU/USA) | VERIFIZIEREN (DPA) | Teilweise (USA) | Mittel |
| 10 | SMS-Anbieter | – | – | – | – | nicht eingesetzt | – | nicht zutreffend |

---

## 2. Detailregister je Anbieter

### 2.1 Neon (PostgreSQL) – Neon, LLC / Databricks-Gruppe

| Feld | Angabe |
|---|---|
| **Zweck** | Primärdatenbank der Anwendung: alle persistenten Daten (Gäste/Reservierungen, Personal, Verträge, Audit-Log, Settings, Fest-Opportunities, Wartelisten, Voucher, Scanner-Zugriffe). |
| **Datenkategorien** | Stammdaten Gäste (Name, E-Mail, Telefon, Adresse); Buchungsdaten (Datum, Tisch, Paket, Preis, Status, QR-Code-Text, Ticket-Payload JSONB); Personal (Name, Kontakt, Adresse, Geburtsdatum, Lohn, Bankdaten verschlüsselt, Gesundheitskasse, Steuer-ID/SV verschlüsselt); Verträge (HTML, Signaturen, IP, User-Agent); Admin/Auth (E-Mail, OTP-Hash, Sessions, Rate-Limits); Audit-Log (Akteur, Aktion, Entität, Meta). |
| **Art. 9?** | **Ja, indirekt.** Metadaten/URLs zu Gesundheitszeugnis-Dateien, Krankenkasse, Geburtsdatum liegen in Neon; verschlüsselte Steuer-ID/SV sind keine Art.-9-Daten. Gesundheitszeugnis-Dateien selbst liegen bei Cloudinary (siehe 2.2). |
| **Sitz (Vertrag)** | Neon, LLC, Teil der Databricks-Gruppe (San Francisco, USA). Datenschutzseite verweist auf Databricks (`docs/privacy-review.md` Z. 68–69). |
| **Tatsächliche Verarbeitungsregion** | Prod-`.env.local`: `ep-…-pooler.c-4.eu-central-1.aws.neon.tech` → **eu-central-1 (AWS Frankfurt, EU)**. **VERIFIZIEREN:** Ist das Produktionsprojekt (nicht nur Staging) tatsächlich in `eu-central-1`? Gibt es separate Projekte (Staging/Prod) in unterschiedlichen Regionen? Fundstelle: Neon Console → Project → Region. |
| **AVV vorhanden?** | **Nein belegt.** `docs/konzept-2026-erweiterungen.md` Z. 890 listet AVV mit Neon als To-do. **VERIFIZIEREN:** Ist ein DPA (Art. 28 DSGVO) mit Neon/Databricks für den Betreiber-Account abgeschlossen? Link/Datum/Plan-Tier. Fundstelle: Neon Trust Center / DPA (neon.com/trust oder Databricks DPA). Free-/Launch-Tier: DPA vermutlich nur ab Paid-Tier → **Kritisch**. |
| **Drittlandmechanismus** | Daten at rest in EU-Region → kein Transfer für gespeicherte Daten. Aber Neon-Support/Ops (USA) kann Zugriff haben. **VERIFIZIEREN:** DPF-Zertifizierung aktuell? SCC + TIA? Zero-Access/Customer-Managed-Key-Modus? Fundstelle: Neon/Databricks DPA, Trust Center, Sub-processor-Liste. |
| **Sub-Sub-Dienstleister** | AWS (Infrastruktur, eu-central-1). **VERIFIZIEREN:** Weitere Sub-Processor (Support-Tools, Monitoring)? Fundstelle: Neon Sub-processor-Liste (DPA/Trust Center). |
| **Retention-Zusagen** | Anwendungsebene: Sessions/Invites Ablauf, ID-Docs 365 Tage, 10-Jahres-Anonymisierung (Personal), Audit-Log 1 Jahr (allgemein) / 10 Jahre (Personal). **VERIFIZIEREN:** Neon PITR/Backup-Retention des Tarifs (Free 7 Tage / Paid bis 30 Tage), Snapshots, History-Retention. Fundstelle: Neon Console → Project → Backups/Restore. Verfahren „Restore → erneut löschen" für Art. 17 (VERIFIZIEREN). |
| **Support-Zugriff aus Drittländern** | **VERIFIZIEREN:** Welche Neon-Support-/Ops-Rollen haben Zugriff auf Prod-Daten? Gibt es Support-Zugriff aus USA? Fundstelle: Neon DPA / Trust Center / Support-Policy. |
| **Weitere Hinweise** | Autosuspend (Free-Tier) aktiv → Cold-Start; App-Rolle `neondb_owner` (Least Privilege nicht umgesetzt) – siehe `docs/neon-audit.md` § 5. Branching mit Prod-Daten (VERIFIZIEREN). |

### 2.2 Cloudinary (Cloudinary Ltd.)

| Feld | Angabe |
|---|---|
| **Zweck** | Medienspeicher, -optimierung und -auslieferung (CDN): Staff-Dokumente (Ausweis, Gesundheitszeugnis, Steuerkarte, Minijob-Formular), Event-Dokumente (Menüs/Programme), Galerie- und Eventbilder, Ticket-PDF-Assets (Logo). |
| **Datenkategorien** | Bilddateien (Fotos von Personen, Ausweiskopien, Gesundheitszeugnisse), PDF-Dokumente, Abrufdaten (IP, Browser, Referrer beim CDN-Abruf). |
| **Art. 9?** | **Ja.** Gesundheitszeugnis-Dateien = Gesundheitsdaten (Art. 9). Ausweiskopien = biometrische Daten (Foto) / Ausweisnummern. |
| **Sitz (Vertrag)** | Cloudinary Ltd. – Hauptsitz Santa Clara (USA), R&D Tel Aviv (Israel). **VERIFIZIEREN:** Vertragspartner-Entity für EU-Kunden (Cloudinary Ltd. UK? EU?). Fundstelle: Cloudinary Terms/DPA. |
| **Tatsächliche Verarbeitungsregion** | **VERIFIZIEREN.** Standard-Cloud (Cloud-Name) und Storage-Region; Cloudinary nutzt AWS/GCP/Azure + eigenes CDN. Default-Region vermutlich US. Fundstelle: Cloudinary Console → Settings → Cloud / Region; Cloudinary Doku „Data centers and regions". |
| **AVV vorhanden?** | **Nein belegt.** **VERIFIZIEREN:** Cloudinary DPA (Data Processing Addendum) für den Plan-Tier (Free/Plus). Free-Tier ohne AVV = **Kritisch**. Fundstelle: Cloudinary DPA (cloudinary.com/legal / Trust Center). |
| **Drittlandmechanismus** | Cloudinary ist US-/Israel-Unternehmen; Daten (Bilder) werden bei Abruf weltweit über CDN ausgeliefert. **VERIFIZIEREN:** DPF-Zertifizierung aktuell? SCC + TIA? Ergänzende Maßnahmen (Verschlüsselung, Pseudonymisierung)? Fundstelle: Cloudinary DPA / Privacy Policy (cloudinary.com/privacy). |
| **Sub-Sub-Dienstleister** | AWS/GCP/Azure (Storage), CDN (Fastly/Cloudflare?). **VERIFIZIEREN:** Fundstelle: Cloudinary Sub-processor-Liste (DPA). |
| **Retention-Zusagen** | Anwendungsebene: ID-Docs nach 365 Tagen gelöscht (Cloudinary-Purge best-effort), 10-Jahres-Anonymisierung entfernt URLs. Cloudinary-seitige Retention/Backups/Versionierung: **VERIFIZIEREN.** Fundstelle: Cloudinary Doku/Account. |
| **Support-Zugriff aus Drittländern** | **VERIFIZIEREN:** Support-Zugriff auf Media-Assets? Zero-access? Fundstelle: Cloudinary DPA / Support-Policy. |
| **Weitere Hinweise** | Cloudinary Free = 25 Credits/Monat; bei Überschreitung Upgrade auf Plus ($99). Migrationsskript `scripts/migrate-cloudinary.ts`. Alte Vercel-Blob-URLs werden nicht mehr gelöscht (`src/lib/cloudinary.ts`). |

### 2.3 netcup (Hosting, VPS + Coolify)

| Feld | Angabe |
|---|---|
| **Zweck** | Anwendungshosting (VPS, Coolify, Standalone-Next.js), Reverse-Proxy/TLS (Let's Encrypt), optional DNS. App-Instanz verarbeitet sämtliche Anwendungsdaten im Arbeitsspeicher; Logs auf dem Server. |
| **Datenkategorien** | Alle Anwendungsdaten transitär im RAM (Gäste, Personal, etc.); Server-/Access-Logs (IP, User-Agent, Zeitstempel, URLs); Coolify-Konfiguration (Secrets, Env). |
| **Art. 9?** | **Ja, indirekt** (über Verarbeitung im RAM und Logs; Backups siehe 2.8). |
| **Sitz (Vertrag)** | netcup GmbH, Karlsruhe, Deutschland (EU). |
| **Tatsächliche Verarbeitungsregion** | Deutschland (VERIFIZIEREN: Rechenzentrum/Standort, z. B. Nürnberg). Fundstelle: netcup Kundenpanel → Server → Standort. |
| **AVV vorhanden?** | netcup stellt Auftragsverarbeitungsverträge für Hosting bereit. **VERIFIZIEREN:** AVV im Kundenportal abgeschlossen (Link/Datum). Fundstelle: netcup Kundenpanel → Verträge/AVV. Plan-Tier: VPS 1000/2000 G11 (kein Free-Tier; kostenpflichtig) → AVV verfügbar. |
| **Drittlandmechanismus** | Nicht erforderlich (EU-only). Support aus Deutschland. |
| **Sub-Sub-Dienstleister** | **VERIFIZIEREN:** Rechenzentrums-Partner, Netzbetreiber. Fundstelle: netcup AVV / Datenschutzinformation. |
| **Retention-Zusagen** | Server-Logs: Aufbewahrung **VERIFIZIEREN** (Rotation). Backups: siehe 2.8. |
| **Support-Zugriff aus Drittländern** | Keine (Support in DE). **VERIFIZIEREN:** Remote-Hands/Third-Party-Support? Fundstelle: netcup AVV. |
| **Weitere Hinweise** | Staging kann auf Vercel laufen (siehe 3.2). Monitoring self-hosted (Uptime Kuma) auf demselben Server – kein externer Prozessor. |

### 2.4 Cloudflare (Turnstile, DNS, CDN, WAF, Rate-Limiting)

| Feld | Angabe |
|---|---|
| **Zweck** | Spam-/Bot-Schutz (Cloudflare Turnstile) für Kontaktformular, Buchung, Warteliste, Team-Login; DNS, CDN, WAF, Rate-Limiting-Regeln (siehe `docs/rate-limiting.md`). |
| **Datenkategorien** | IP-Adresse, Browser-/Geräteinformationen, Turnstile-Token, Request-Metadaten (Zeitstempel, URL, Status). Formularinhalte werden **nicht** an Cloudflare gesendet. |
| **Art. 9?** | **Nein.** Keine besonderen Kategorien. |
| **Sitz (Vertrag)** | Cloudflare, Inc., San Francisco, USA. |
| **Tatsächliche Verarbeitungsregion** | Global (Edge-Netzwerk) – Daten können weltweit verarbeitet werden. **VERIFIZIEREN:** Ob für den Tenant eine EU-Region/„Data Localization" konfiguriert ist. Fundstelle: Cloudflare Dashboard → Zone → Data Localization / Region. |
| **AVV vorhanden?** | Cloudflare stellt ein DPA bereit. **VERIFIZIEREN:** DPA für den genutzten Plan (Free/Pro) abgeschlossen/akzeptiert (Link/Datum). Fundstelle: Cloudflare DPA (cloudflare.com/cloudflare-customer-dpa). |
| **Drittlandmechanismus** | Cloudflare ist US-Unternehmen mit globalem Edge. **VERIFIZIEREN:** DPF-Zertifizierung aktuell? SCC + TIA? Fundstelle: Cloudflare DPA / Trust Hub (cloudflare.com/trust-hub). |
| **Sub-Sub-Dienstleister** | **VERIFIZIEREN.** Fundstelle: Cloudflare Sub-processor-Liste (DPA). |
| **Retention-Zusagen** | Cloudflare-Logs (z. B. Turnstile-Analytics, WAF-Logs): Aufbewahrung **VERIFIZIEREN** (Free: kurz, z. B. 24 h–7 Tage). Fundstelle: Cloudflare Dashboard → Analytics/Logs. |
| **Support-Zugriff aus Drittländern** | Cloudflare-Support global. **VERIFIZIEREN:** Support-Zugriff auf Logs/Konfiguration. Fundstelle: Cloudflare DPA / Support-Policy. |

### 2.5 Resend (Mail-Provider) – Plus Five Five, Inc.

| Feld | Angabe |
|---|---|
| **Zweck** | Transaktionale E-Mails: OTP-Login-Codes, Kontaktformular-Weiterleitung, Ticket-Zustellung (PDF mit QR-Code), Wartelisten-Benachrichtigung, Staff-Einladungen, Staffing-Pläne, Bewerbungsantworten. |
| **Datenkategorien** | Empfänger-E-Mail, Name, E-Mail-Inhalt (Ticket-PDF mit Gast-/Buchungsdaten, QR-Code), Absenderadresse, Zustell-Metadaten (Message-ID, Status, Zeitstempel). |
| **Art. 9?** | **Nein.** Keine Gesundheitsdaten in E-Mail-Inhalten (Ticket-PDF enthält Buchungs-/Kontaktdaten). |
| **Sitz (Vertrag)** | Plus Five Five, Inc. (Resend), San Francisco, USA. |
| **Tatsächliche Verarbeitungsregion** | **VERIFIZIEREN.** Resend nutzt AWS; Region (vermutlich US). Fundstelle: Resend Doku / Account (Region der Sending-Domain). |
| **AVV vorhanden?** | **Nein belegt.** **VERIFIZIEREN:** Resend DPA (Link/Datum/Plan-Tier). Free-Tier (3.000 Mails/Monat) ohne AVV = **Kritisch**. Fundstelle: Resend Legal (resend.com/legal/dpa) / Support. |
| **Drittlandmechanismus** | US-Anbieter. **VERIFIZIEREN:** DPF-Zertifizierung aktuell? SCC + TIA? Fundstelle: Resend DPA / Privacy Policy (resend.com/legal/privacy-policy). |
| **Sub-Sub-Dienstleister** | AWS (E-Mail-Infrastruktur). **VERIFIZIEREN:** Fundstelle: Resend Sub-processor-Liste (DPA). |
| **Retention-Zusagen** | Resend behält E-Mail-Logs/Inhalte für einen Zeitraum. **VERIFIZIEREN:** Retention-Dauer (z. B. 30 Tage Logs), Löschmöglichkeit. Fundstelle: Resend Doku/Account. |
| **Support-Zugriff aus Drittländern** | **VERIFIZIEREN.** Fundstelle: Resend DPA / Support-Policy. |

### 2.6 Google (Gemini API) – KI/LLM-Anbieter

| Feld | Angabe |
|---|---|
| **Zweck** | Automatische Übersetzung von Veranstaltungs- und Galerietexten (DE↔EN) im Admin-Panel (optional, nur bei gesetztem `GEMINI_API_KEY`). |
| **Datenkategorien** | Bearbeitete Veranstaltungs-/Galerietexte (Titel, Beschreibung, Ort). **Keine** Gäste-, Kontakt-, Bewerbungs- oder Login-Daten. |
| **Art. 9?** | **Nein.** |
| **Sitz (Vertrag)** | Google LLC, Mountain View, USA (bzw. Google Cloud EMEA für EU). |
| **Tatsächliche Verarbeitungsregion** | **VERIFIZIEREN.** Gemini API (Google AI Studio / Vertex) – Region (global/US). Fundstelle: Google AI Studio / Vertex AI Console → Region. |
| **AVV vorhanden?** | **Nein belegt.** **VERIFIZIEREN:** Google Cloud DPA (für Vertex AI) vs. Google AI Studio Terms (Free-Tier). Free-Tier ohne DPA = **Kritisch**. Fundstelle: Google Cloud DPA (cloud.google.com/terms/data-processing-addendum), Google AI Studio Terms. |
| **Drittlandmechanismus** | US-Anbieter. Google ist DPF-zertifiziert (VERIFIZIEREN aktuell). SCC + TIA. Fundstelle: Google Privacy / DPA. |
| **Sub-Sub-Dienstleister** | **VERIFIZIEREN.** Fundstelle: Google Sub-processor-Liste. |
| **Retention-Zusagen** | Google AI Studio kann Prompts/Outputs für Verbesserung nutzen (Free-Tier). **VERIFIZIEREN:** Datenverwendung (Training), Retention-Dauer, Opt-out. Fundstelle: Google AI Studio Terms / Privacy. |
| **Support-Zugriff aus Drittländern** | **VERIFIZIEREN.** |
| **Weitere Hinweise** | Code: `src/lib/translate.ts`, Dependency `@google/generative-ai`. Datenschutzhinweis: keine automatische Übersetzung von Gästedatensätzen. |

### 2.7 Error-Tracking / Analytics

| Feld | Angabe |
|---|---|
| **Zweck** | – (kein Service im Repository belegt) |
| **Datenkategorien** | – |
| **Art. 9?** | – |
| **Status** | **Nicht eingesetzt.** Kein Sentry/PostHog/Plausible/Umami/GlitchTip in `package.json` oder Code. Infrastruktur-Logs (Server, Vercel/Cloudflare) sind Teil des jeweiligen Hostings. |
| **VERIFIZIEREN** | Ist Error-Tracking/Analytics geplant (z. B. Sentry, PostHog, Better Stack, Uptime Kuma)? Falls ja: AVV + Drittland + Cookie-/Consent-Thematik prüfen. Fundstelle: Roadmap / `docs/konzept-2026-erweiterungen.md`. |

### 2.8 Backup-Ziel (netcup Storage Box)

| Feld | Angabe |
|---|---|
| **Zweck** | Externe, verschlüsselte Backups außerhalb des Netcup-Servers: DB-Dumps, Medienbestand, Coolify-Konfiguration (siehe `docs/coolify.md` § „Sicherung und Überwachung"). |
| **Datenkategorien** | Vollständige DB-Dumps (alle PII inkl. Personal/Art.-9-Metadaten), Medienbestand (Bilder/Dokumente), Konfiguration. |
| **Art. 9?** | **Ja, indirekt** (DB-Dumps enthalten Gesundheitszeugnis-URLs, Krankenkasse etc.). |
| **Sitz (Vertrag)** | netcup GmbH, Deutschland (EU). |
| **Tatsächliche Verarbeitungsregion** | Deutschland – VERIFIZIEREN (Storage-Box-Standort). Fundstelle: netcup Kundenpanel → Storage Box. |
| **AVV vorhanden?** | Teil des netcup-Vertrags/AVV. **VERIFIZIEREN:** Link/Datum. Fundstelle: netcup Kundenpanel → Verträge/AVV. |
| **Drittlandmechanismus** | Nicht erforderlich (EU-only). |
| **Sub-Sub-Dienstleister** | **VERIFIZIEREN.** Fundstelle: netcup AVV. |
| **Retention-Zusagen** | Aufbewahrungsdauer, Verschlüsselung, Zugriffsschlüssel: **VERIFIZIEREN.** `docs/coolify.md` fordert „passende Aufbewahrung und Wiederherstellungsproben". Fundstelle: Backup-Konzept / Runbook. |
| **Support-Zugriff aus Drittländern** | Keine (EU). **VERIFIZIEREN.** |
| **Weitere Hinweise** | Neon PITR (Point-in-Time-Recovery) ist ein weiteres Backup-Medium mit eigener Retention (siehe 2.1). Restore→Löschen-Verfahren für Art. 17 (VERIFIZIEREN). |

### 2.9 Stripe (Payment)

| Feld | Angabe |
|---|---|
| **Zweck** | Online-Zahlungsabwicklung für Reservierungen (Stripe Checkout), Webhook-Verarbeitung von Zahlungsereignissen (6 Events), Cron-Abgleich abgelaufener Holds. |
| **Datenkategorien** | E-Mail, Buchungs-ID, Leistung/Preis, Zahlungsstatus, Stripe-Session-ID, idempotency Key. Zahlungsdaten (Kartennummern) werden **direkt bei Stripe** erhoben (PCI DSS) – nicht in unserer DB gespeichert. |
| **Art. 9?** | **Nein.** |
| **Sitz (Vertrag)** | Stripe Payments Europe, Ltd. (Dublin, Irland) für EU; Stripe, Inc. (USA) für globale Infrastruktur. |
| **Tatsächliche Verarbeitungsregion** | **VERIFIZIEREN:** EU-Verarbeitung (Dublin) vs. US-Verarbeitung; Stripe nutzt globale Infrastruktur. Fundstelle: Stripe Dashboard → Account/Region, Stripe Privacy Policy. |
| **AVV vorhanden?** | Stripe stellt ein DPA bereit. **VERIFIZIEREN:** DPA für den Account abgeschlossen (Link/Datum). Fundstelle: Stripe DPA (stripe.com/legal/dpa). |
| **Drittlandmechanismus** | Stripe Ireland + SCCs/DPF. **VERIFIZIEREN:** DPF-Zertifizierung aktuell? Fundstelle: Stripe Privacy Center. |
| **Sub-Sub-Dienstleister** | **VERIFIZIEREN.** Fundstelle: Stripe Sub-processor-Liste (DPA). |
| **Retention-Zusagen** | Stripe behält Zahlungs-/Buchungsdaten nach gesetzlichen Pflichten (i. d. R. 10 Jahre). **VERIFIZIEREN.** Fundstelle: Stripe Doku/Privacy. |
| **Support-Zugriff aus Drittländern** | **VERIFIZIEREN.** |
| **Weitere Hinweise** | API-Version `2026-06-24.dahlia`; Webhook-Secret-Verifikation. PCI-Compliance bei Stripe. |

### 2.10 SMS-Anbieter

| Feld | Angabe |
|---|---|
| **Status** | **Nicht eingesetzt.** Kein SMS-Provider (Twilio etc.) in Dependencies oder Code. |
| **VERIFIZIEREN** | Falls SMS später eingesetzt wird (z. B. Ticket-Bestätigung, OTP): Anbieter, Region, AVV, Drittland vorab prüfen. |

---

## 3. Weitere Drittanbieter (keine Auftragsverarbeiter)

Diese Anbieter sind **keine** Auftragsverarbeiter i. S. d. Art. 28 DSGVO, werden aber
der Vollständigkeit halber genannt, da personenbezogene Daten (IP-Adresse) an sie
übermittelt werden können:

| Anbieter | Rolle | Daten | Hinweis |
|---|---|---|---|
| Unsplash | Externe Bildquelle (Homepage) | IP, Browser, Referrer bei direktem Abruf | Unabhängiger Verantwortlicher; im Browser des Nutzers. Quellen in `docs/privacy-review.md`. Empfehlung: eigene, lokal gehostete Bilder. |
| Vercel | Hosting (nur Staging/Test, falls genutzt) | Requests, Runtime-Logs | Aktuelle Produktion läuft auf netcup; Vercel nur Test/Staging. Falls produktiv genutzt → AVV (Vercel DPA) + Region prüfen. |
| Instagram / TikTok | Social-Media-Links | – | Nur Links; keine Einbindung von Widgets. |
| Google Fonts | Schriftdateien (Build-Zeit) | – | Beim Build heruntergeladen; keine Runtime-Abfrage. |

---

## 4. AVV zwischen Festwirt (Verantwortlicher) und Agentur (Auftragsverarbeiter)

Die Agentur entwickelt und betreibt die Plattform im Auftrag des Festwirts und hat
Zugriff auf personenbezogene Daten (DB, Server, Backups, Support). Daher ist ein
Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO **erforderlich**. Prüfung
der Mindestinhalte:

### 4.1 Vertragsgegenstand und Rollen

- [ ] Rollenklarstellung: Festwirt = Verantwortlicher; Agentur = Auftragsverarbeiter.
- [ ] Gegenstand, Dauer, Art und Zweck der Verarbeitung beschrieben (Betrieb, Wartung, Weiterentwicklung, Support, Datenmigration, Backup-Wiederherstellung).
- [ ] Kategorien personenbezogener Daten aufgelistet (Gäste, Personal, Verträge, Admin/Auth, Fest-Opportunities).
- [ ] Kategorien betroffener Personen aufgelistet (Gäste/Reservierungsinhaber, Personal/Mitarbeitende, Bewerber, Admins/Scanner-Helfer, Geschäftspartner).
- [ ] Dauer: Vertragslaufzeit + Nachlauf (Löschung/Rückgabe nach Vertragsende).

### 4.2 Weisungsrecht und Kontrollrechte

- [ ] **Weisungsrecht** des Verantwortlichen: Agentur verarbeitet nur auf dokumentierte Weisung; Weisungen können jederzeit geändert werden.
- [ ] **Kontrollrechte**: Audit-Recht des Verantwortlichen (oder beauftragter Dritter), Einsicht in TOM, Zertifikate, Penetrationstests nach Ankündigung.
- [ ] Dokumentation der Weisungen (Ticket-System, E-Mail, Protokoll).
- [ ] Meldepflicht der Agentur bei Weisungen, die gegen Datenschutzrecht verstoßen (Verweigerungsrecht).

### 4.3 Genehmigung der Unterauftragsverarbeiter

- [ ] **Allgemeine Genehmigung** vs. **spezifische Genehmigung** der Sub-Processor festlegen. Empfehlung: allgemeine Genehmigung mit Liste der genehmigten Sub-Processor (Register aus Abschnitt 2) + Änderungsmitteilung mit Widerspruchsfrist (z. B. 30 Tage).
- [ ] Genehmigung der in Abschnitt 2 genannten Anbieter (Neon, Cloudinary, netcup, Cloudflare, Resend, Google, Stripe, Backup-Ziel) explizit im AVV oder als Anlage.
- [ ] Verpflichtung der Agentur, Sub-Processor vertraglich gleichwertig zu binden (Art. 28 Abs. 4 DSGVO) und die Liste aktuell zu halten.
- [ ] Informationspflicht bei Änderung der Sub-Processor (neue/entfallende, Regionswechsel, Plan-Tier-Wechsel).
- [ ] Recht des Verantwortlichen, bei erheblichen Änderungen zu widersprechen/zu kündigen.

### 4.4 Sicherheit (TOM) und Vertraulichkeit

- [ ] Technische und organisatorische Maßnahmen (TOM) beschrieben/als Anlage (Verschlüsselung at rest/in transit, Zugriffskontrolle, MFA, Logging, Backup, Patch-Management).
- [ ] Vertraulichkeitsverpflichtung der Mitarbeiter der Agentur (schriftlich).
- [ ] Zugriffsminimierung: Agentur erhält nur notwendigen Zugriff; separate Admin-Rollen; keine Produktion mit Owner-DB-Rolle (siehe `docs/neon-audit.md` § 5 – Verbesserungsbedarf).
- [ ] Keine Weitergabe von Secrets über ungesicherte Kanäle; Rotation dokumentiert.

### 4.5 Unterstützungspflichten

- [ ] Unterstützung bei Betroffenenanfragen (Auskunft, Löschung, Berichtigung, Datenübertragbarkeit) – inkl. Art. 17 unter Berücksichtigung von Backups/PITR.
- [ ] Unterstützung bei Datenschutz-Folgenabschätzung (DSFA) und Vorabkontrolle.
- [ ] Meldepflicht bei Datenschutzverletzungen (Art. 33/34 DSGVO) unverzüglich, spätestens innerhalb vereinbarter Frist (z. B. 24–72 h).
- [ ] Unterstützung bei Prüfungen durch Aufsichtsbehörden.

### 4.6 Löschung und Rückgabe

- [ ] Nach Vertragsende: Rückgabe oder Löschung aller personenbezogenen Daten (inkl. Backups) innerhalb vereinbarter Frist.
- [ ] Ausnahme: gesetzliche Aufbewahrungspflichten (§ 147 AO, § 257 HGB) – anonymisierte Aufbewahrung.
- [ ] Nachweis der Löschung (Löschprotokoll).
- [ ] Regelung zu PITR/Backup-Restore („Restore → erneut löschen").

### 4.7 Verantwortlichkeit und Haftung

- [ ] Haftungsregelung für Datenschutzverstöße der Agentur.
- [ ] Versicherung (Berufshaftpflicht / Cyber) – optional.
- [ ] Gerichtsstand / anwendbares Recht (DE).

### 4.8 Offene Punkte (VERIFIZIEREN)

- [ ] **VERIFIZIEREN:** Ist bereits ein AVV zwischen Festwirt und Agentur vorhanden (Vertragswerk, Angebot, AGB)? Fundstelle: Vertragsdokumente / `business/kosten.md` („Rechtstexte sind blockierend").
- [ ] **VERIFIZIEREN:** Welche Zugriffsrechte hat die Agentur aktuell auf Prod (DB, Server, Backups, Provider-Portale) – und sind sie dokumentiert (Zugriffsmatrix)?
- [ ] **VERIFIZIEREN:** Gibt es eine dokumentierte Weisungskette (wer darf anordnen, wie werden Weisungen festgehalten)?
- [ ] **VERIFIZIEREN:** Gibt es ein Verfahren für Betroffenenanfragen (Postfach, Zuständigkeit, Fristen)?

---

## 5. Konsolidierte Verifikationsliste (extern)

| # | Prüfpunkt | Anbieter | Fundstelle |
|---|---|---|---|
| V1 | Prod-Region (eu-central-1?) und Tarif (Free/Paid), PITR-Dauer, Branches | Neon | Neon Console; `docs/neon-audit.md` § 1, 2, 3 |
| V2 | DPA/AVV abgeschlossen? Link/Datum/Plan-Tier | Neon | Neon/Databricks Trust Center / DPA |
| V3 | DPF-Zertifizierung aktuell? SCC + TIA? Sub-Processor-Liste | Neon | Neon/Databricks DPA |
| V4 | Support-Zugriff aus Drittländern / Zero-Access | Neon | Neon DPA / Support-Policy |
| V5 | Storage-Region, Default-Region, CDN-Regionen | Cloudinary | Cloudinary Console → Cloud; Doku |
| V6 | DPA für Plan-Tier (Free/Plus) | Cloudinary | Cloudinary Legal / Trust Center |
| V7 | DPF/SCC/TIA, Sub-Processor-Liste | Cloudinary | Cloudinary DPA |
| V8 | Support-Zugriff auf Media-Assets | Cloudinary | Cloudinary DPA / Support-Policy |
| V9 | Rechenzentrums-Standort, AVV im Portal | netcup | netcup Kundenpanel |
| V10 | Sub-Processor (Rechenzentrum, Netzbetreiber) | netcup | netcup AVV / Datenschutzinfo |
| V11 | Storage-Box-Standort, Verschlüsselung, Retention | netcup | netcup Kundenpanel |
| V12 | Data Localization / EU-Region für Tenant | Cloudflare | Cloudflare Dashboard → Zone |
| V13 | DPA für Plan-Tier (Free/Pro) | Cloudflare | Cloudflare DPA |
| V14 | DPF-Zertifizierung aktuell? SCC + TIA? Sub-Processor-Liste | Cloudflare | Cloudflare Trust Hub |
| V15 | Logs-Retention (Turnstile/WAF) | Cloudflare | Cloudflare Dashboard → Analytics |
| V16 | Sending-Region (AWS-Region) | Resend | Resend Doku / Account |
| V17 | DPA für Plan-Tier (Free/Pro) | Resend | Resend Legal (DPA) |
| V18 | DPF/SCC/TIA, Sub-Processor-Liste | Resend | Resend DPA / Privacy Policy |
| V19 | E-Mail-Logs/Inhalte Retention | Resend | Resend Doku / Account |
| V20 | Gemini API Region, DPA (Vertex vs. AI Studio), Trainingsnutzung, Retention | Google | Google AI Studio / Vertex Console; Google Cloud DPA |
| V21 | Ob Error-Tracking/Analytics geplant | – | Roadmap / `docs/konzept-2026-erweiterungen.md` |
| V22 | Stripe-Entity (Ireland vs. US), Region, DPA, DPF, Sub-Processor, Retention | Stripe | Stripe Dashboard / Privacy Center |
| V23 | AVV Festwirt ↔ Agentur vorhanden? Zugriffsmatrix, Weisungskette, Betroffenenpostfach | Agentur | Vertragsdokumente |
| V24 | Backup-Konzept: Verschlüsselung, Retention, Restore→Löschen-Verfahren, Wiederherstellungsproben | netcup/Neon | `docs/coolify.md`; Runbook |

---

## 6. Pflege und Aktualisierung

- Bei jedem neuen/entfallenden Dienstleister, Regionswechsel, Plan-Tier-Wechsel oder
  Vertragsänderung dieses Register aktualisieren und die Änderung im AVV (Abschnitt 4.3)
  dokumentieren.
- Prüfung mindestens jährlich sowie vor jedem Livegang mit echten Gästedaten.
- Fundstellen (DPA/Trust Center) mit Abrufdatum dokumentieren.

---

*Erstellt auf Basis des Repository-Stands (Code, Migrationen, Dokumentation) vom 14. November 2026.
Kein Zugriff auf Provider-Dashboards; alle mit VERIFIZIEREN markierten Punkte sind extern zu prüfen.*