# Technisches Briefing zur Preiskalkulation

> **Zweck dieses Dokuments:** Es beschreibt ein fertig entwickeltes Webprojekt so
> vollständig, dass ein Dritter (Mensch oder LLM) ohne Zugriff auf den Code eine
> belastbare Aufwands- und Preisschätzung abgeben kann.
>
> **Zielmarkt:** Deutschland. Auftraggeber ist ein kleiner Festwirtbetrieb
> (Festzelt, Saisonbetrieb), Auftragnehmer ein Einzelunternehmen / kleines
> Webentwicklungsunternehmen am Anfang.
>
> **Stand:** 08.10.2026

---

## 0. Auftrag an den Schätzenden

Bitte schätze **zwei getrennte Dinge**:

1. **Nachbau-Kosten:** Was würde es kosten, dieses System von null neu zu
   entwickeln (Agentur und Freelancer, Deutschland)?
2. **Restaufwand:** Was kostet es, den vorhandenen Stand produktionsreif zu
   machen und zu übergeben?

Gib für beide je an:

- Aufwand in Stunden, aufgeschlüsselt nach Arbeitspaket
- Angenommener Stundensatz und warum
- Ergebnis als Preisspanne (min/max), nicht als Punktwert
- Die drei größten Kostentreiber
- Welche Annahmen die Schätzung am stärksten verändern würden

Bitte **keine Gefälligkeitspreise** ansetzen. Es geht um Marktwerte.

---

## 1. Projektkontext

| Punkt | Wert |
|---|---|
| Branche | Gastronomie / Eventgastronomie (Festzeltbetrieb) |
| Geschäftsmodell | Tischreservierungen mit Anzahlung, Veranstaltungen, Galerie |
| Nutzer | Gäste (öffentlich), Festwirt (Admin), Einlasshelfer (eingeschränkte Rolle) |
| Sprachen | Deutsch (Standard), Englisch (vollständig) |
| Zahlungsmodell | Online-Anzahlung über Stripe Checkout |
| Betriebsmodell | Ein Kunde, eine Instanz (kein Multi-Tenant) |
| Rechtsraum | EU / DSGVO, deutsche Impressumspflicht |

Die Besonderheit: Der Kunde verkauft **kostenpflichtige Tischreservierungen mit
Mindestverzehr**. Das System ist damit kein Kontaktformular, sondern ein
Zahlungs- und Zugangskontrollsystem mit Geldfluss und Betrugsrisiko.

---

## 2. Funktionsumfang

### 2.1 Öffentlicher Bereich

- **Startseite** mit aufwendig animiertem Hero (SVG, CSS-Conic-Gradient,
  Clip-Path-Lichtkegel, Masken, Framer Motion), About-, Services-,
  Event- und Galerie-Abschnitten, Kontaktformular
- **Termine:** Übersichtsseite + Detailseite je Veranstaltung mit Datum, Ort,
  Beschreibung, Reservierbarkeit
- **Galerie:** Übersicht + Album je Veranstaltung, Lightbox, Lazy Loading,
  Bildoptimierung
- **Karriere-Seite**
- **Rechtstexte:** Impressum, Datenschutzerklärung (AGB und Widerruf fehlen
  noch, siehe Abschnitt 8)
- **Fehlerseiten:** 404, Error Boundary, Global Error, Loading States
- **Vollständige Zweisprachigkeit** DE/EN über `next-intl` inkl.
  Locale-Routing und Sprachumschalter
- **SEO:** `sitemap.ts`, `robots.ts`, Metadata je Seite, `llms.txt`,
  Web-App-Manifest, Favicon-Set, Apple Touch Icon
- **Responsive Design** für 320 px bis Desktop, inkl. mobiler Adminansichten

### 2.2 Reservierungsstrecke (Kernstück)

Vierstufiger Wizard:

1. **Veranstaltung + Datum** wählen (nur freigegebene Reservierungstage)
2. **Tischwahl** auf einem Zeltplan (Position, Kapazität, VIP-Aufpreis);
   optional auch ohne Tischwahl
3. **Zeitpaket** wählen (konfigurierbare Slots, Pakete mit Preis und Beschreibung)
4. **Checkout** mit Gastdaten, CAPTCHA und Weiterleitung zu Stripe

Fachliche Regeln, die im Code umgesetzt sind:

- Kapazitätsprüfung pro Veranstaltung und pro Tag
- Reservierung eines Kontingents für Walk-ins (`walk_in_reserve`)
- Mindestverzehr pro Tisch (`minimum_consumption`, in Cent)
- Maximale Buchungen pro E-Mail-Adresse
- Buchungsfenster: X Tage vorher öffnen, Y Stunden vorher schließen
- Tische erst ab einem Zeitpunkt veröffentlichen (`publish_tables_at`)
- Optionaler Service-Fee pro Veranstaltung (Prozent + Fixbetrag) oder global
- Idempotenz-Schlüssel und Request-Hash gegen Doppelbuchungen
- Race-Condition-Schutz bei parallelen Anfragen auf denselben Tisch
- Zahlungs-Holds mit Ablaufzeit und automatischer Freigabe

**Statusmodell (10 Zustände):**
`pending`, `paid`, `confirmed`, `checked_in`, `cancelled`, `expired`,
`refunded`, `disputed`, `payment_review`, `payment_pending`

### 2.3 Tickets und Einlass

- **PDF-Ticket** serverseitig generiert (`pdf-lib`), mit eingebetteter
  Vektorgrafik des Kundenlogos (keine externen Assets zur Laufzeit),
  Gastname, Personenzahl, Tisch, Datum, Uhrzeit, Ort und großem QR-Code
- Layout bricht lange Texte um und wächst dynamisch in der Höhe
- **QR-Code-Inhalt** eindeutig und einmalig entwertbar
- **Scanner-Web-App** im Browser: Kamerazugriff, WASM-basierter Decoder
  (`@yudiel/react-qr-scanner` + `zxing_reader.wasm`, lokal ausgeliefert,
  CSP erlaubt `wasm-unsafe-eval`)
- Zwei Scannermodi: veranstaltungsbezogen und global
- Nach Scan: Anzeige von Gastname, Personenzahl, Tisch
- **Einmalentwertung** mit serverseitiger Sperre; Doppelscan wird erkannt
- Fehlerfälle getestet: Decoder-Ausfall, Aktionsfehler, Wiederholung

### 2.4 Admin-Backend

- **Login per E-Mail-Einmalcode (OTP)** + Cloudflare Turnstile,
  Allowlist über `ADMIN_EMAILS`, Sessions in der Datenbank (nicht im
  Arbeitsspeicher), OTP gehasht
- **Rollen:** voller Admin und eingeschränkter Scanner-Helfer
- **Veranstaltungsverwaltung:** Anlegen, Bearbeiten, Soft-Delete,
  Zweisprachigkeit, Bild-Upload
- **Bild-Upload:** Client-seitige Verkleinerung vor dem Upload (4,13 MB PNG
  → 0,85 MB WebP), danach Cloudinary; Größen- und Typprüfung
- **Zeltplan-Editor:** Tische positionieren, Kapazität, VIP-Aufpreis
- **Gästeverwaltung:** Suche, Filter, Statuswechsel, Tischzuweisung
- **Kennzahlen:** Umsatz, bestätigte Gäste, Check-ins (korrekt über
  Buchungsstatus, nicht über Buchungsanzahl)
- **Einlass-Team-Verwaltung:** veranstaltungsbezogene Freigaben mit
  Ablaufdatum (max. 90 Tage), Widerruf sperrt laufende Sitzungen sofort
- **Warteliste** mit Eindeutigkeit pro Event + E-Mail (case-insensitive)
- **Galerieverwaltung** pro Event und global
- **Event-Einstellungen:** Zeitslots, Pakete, Storno-Frist, Buchungsfenster,
  Service-Fee, automatischer Ticketversand
- **Druckansicht** für Gästelisten
- **KI-Übersetzung** Deutsch → Englisch über Gemini API beim Anlegen/Bearbeiten

### 2.5 E-Mail und Benachrichtigungen

- Transaktionsmails über Resend: Login-Code, Ticketversand,
  Buchungsbestätigung, Kontaktanfrage, Wartelisten-Benachrichtigung
- **Zustellzuverlässigkeit:** Ticket-Payload wird gespeichert und der Versand
  bei Fehlschlag wiederholt (Retry über Cleanup-Job)
- Verifizierter Absender, konfigurierbar getrennt für Staging/Produktion

---

## 3. Technischer Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16.3.8 (App Router, Server Actions), React 19.2.4 |
| Sprache | TypeScript 6.0.3, strikt |
| Runtime | Node.js 22 |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion (Hero komplett in SVG + CSS umgesetzt, keine Animations-Assets) |
| Datenbank | PostgreSQL 17, Drizzle ORM 0.45 + Drizzle Kit (Migrationen) |
| Authentifizierung | Eigenbau: OTP per Mail, DB-Sessions, Allowlist |
| Zahlung | Stripe (Checkout Sessions, Webhooks) |
| E-Mail | Resend |
| Medien | Cloudinary (Upload + Transformation) |
| CAPTCHA | Cloudflare Turnstile |
| PDF | `pdf-lib` + Fontkit |
| QR | `qrcode` (Erzeugung), `@yudiel/react-qr-scanner` + WASM (Scan) |
| Rich Text | `react-quill-new` (mit `quill@2.0.2` Override) |
| Sanitizing | `sanitize-html` (serverseitig) |
| i18n | `next-intl` 4 |
| Tests | Node Test Runner, Playwright |
| Deployment | Docker (Standalone, Non-Root, Healthcheck), Coolify, optional Vercel |

**Bewusste Architekturentscheidungen:**

- Keine Sessions im Arbeitsspeicher → horizontale Skalierung und Neustarts
  verlieren keine Logins
- Keine lokalen Uploads → Container ist zustandslos
- Alle Medien bei Cloudinary, alle Zustände in PostgreSQL
- Datenbanktreiber funktioniert mit Neon-Pooling **und** privatem PostgreSQL
  (Schema überall explizit `public.`-qualifiziert, weil gepoolte Verbindungen
  einen leeren `search_path` liefern können)
- Kein ORM-`push` in Produktion, nur versionierte Migrationen mit Ledger

---

## 4. Datenmodell

9 Migrationen (`0000`–`0008`), 12 Tabellen, 1 Enum:

| Tabelle | Zweck |
|---|---|
| `events` | Veranstaltungen, zweisprachige Felder, Kapazität, Reservierungsfenster, Soft-Delete |
| `tables` | Tische mit Kapazität, Position im Zeltplan, VIP-Aufpreis |
| `reservations` | Buchungen mit Status, Stripe-Session, Idempotenz-Key, QR-Text, Scan-Zeitpunkt, Ticket-Payload |
| `event_settings` | Pro Event: Zeitslots, Pakete (JSONB), Storno, Buchungsfenster, Service-Fee |
| `galleries` | Bilder pro Event mit Cloudinary-Public-ID |
| `waitlists` | Warteliste, eindeutig pro Event + normalisierter E-Mail |
| `admin_auth` | OTP-Codes mit Ablauf und Fehlversuchszähler |
| `admin_sessions` | Server-seitige Admin-Sessions |
| `security_rate_limits` | Rate-Limiting-Zähler in der DB |
| `scanner_access` | Veranstaltungsbezogene Helferfreigaben mit Ablauf |
| `stripe_events` | Deduplizierung eingehender Webhooks |
| `settings` | Globale Key-Value-Einstellungen |

**Indizes und Constraints** sind bewusst gesetzt: Unique-Indizes auf
`stripe_session_id`, `idempotency_key`, `qr_code_text`; partielle Indizes für
offene Holds und Session-Lookups; Check-Constraints für Kapazität, Personenzahl
und Beträge (keine negativen Werte).

---

## 5. Integrationen

| Dienst | Verwendung | Ereignisse / Details |
|---|---|---|
| **Stripe** | Checkout, Webhooks | 6 Events abonniert: `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed`, `expired`, `charge.refunded`, `charge.dispute.created` |
| **Resend** | Transaktionsmail | verifizierte Domain nötig |
| **Cloudinary** | Bildhosting | signierte Uploads, Preset |
| **Turnstile** | Bot-Schutz | 4 Actions: `checkout`, `waitlist`, `admin-login`, `contact` |
| **Gemini API** | Übersetzung | optional, nur Admin |

Webhook-Verarbeitung: Signaturprüfung, Deduplizierung über `stripe_events`,
Statusübergänge, Wiederholungsversand von Tickets.

---

## 6. Sicherheit und Qualität

### Umgesetzt

- Webhook-Signaturprüfung, Replay-Schutz, Event-Deduplizierung
- Rate-Limiting in der Datenbank (nicht im Prozessspeicher)
- OTP-Codes gehasht, Ablauf, Fehlversuchslimit
- Serverseitige Autorisierung jeder Server Action (nicht nur UI-Ausblendung)
- Scanner-Helfer können ausschließlich scannen – geprüft, dass sie keine
  Gästelisten, Umsätze, Exporte oder Einstellungen erreichen
- Widerrufene Freigabe sperrt **laufende** Sitzungen sofort
- `sanitize-html` für Rich-Text-Inhalte
- Content-Security-Policy inkl. `wasm-unsafe-eval` nur für den QR-Decoder
- Security-Header, Origin-Prüfung, Request-Body-Limits
- Health-Endpoint prüft Datenbank und sicherheitsrelevante Felder, ohne Cache
- `npm audit --omit=dev`: 0 bekannte Schwachstellen (Stand Abnahme)
- ESLint mit `--max-warnings 0`; 142 ursprüngliche Warnungen behoben

### Testabdeckung (dokumentiert)

| Testart | Umfang |
|---|---|
| Sicherheits-/Regressionstests | 48 Szenarien, u. a. 50 parallele Anfragen auf 8 Plätze, volle Tische, Doppel-Requests, Refund-/Dispute-Pfade, OTP, Warteliste, Ticketzustellung |
| Browser-Tests (Playwright) | 20 Tests, Desktop + Pixel-7-Emulation |
| Buchungskomponenten | 20 Szenarien (DE/EN, 390/1440 px, schnelle Eventwechsel, Fehlerzustände) |
| Scanner | 7 Szenarien inkl. synthetischem Kamerabild und Decoder-Ausfall |
| Bildverarbeitung | echte 4,13-MB-Datei, Skalierung, Ablehnung ungültiger Dateien |
| PDF/QR | beide Ticket-Fixtures exakt dekodiert |
| Migrationen | komplette Kette 0000–0008 auf leerer DB, Wiederholung, Runner im Standalone-Baum |
| Preflight | 39 Prüfungen gegen Staging |

Zusätzlich existieren ein Produktions-Preflight-Skript und ein
Akzeptanz-Runner, der eine eigene Testdatenbank erzeugt und wieder entfernt.

---

## 7. Betrieb und Deployment

- **Docker:** Multi-Stage, Standalone-Output, läuft als Benutzer 1001,
  `cap_drop: ALL`, `no-new-privileges`, `init: true`, Grace Period 30 s
- **Coolify:** App → Git → Dockerfile, Port 3000, Healthcheck `GET /api/health`,
  Scheduled Task `*/5 * * * *` für den Cleanup-Runner
- **Vercel:** alternative Konfiguration über `vercel.json`, Region `fra1`
- **Migrationen:** eigener Release-Schritt, separater Runner mit Ledger und
  Session-Lock, niemals automatisch beim Containerstart
- **Cleanup-Job:** gleicht abgelaufene Zahlungs-Holds mit Stripe ab, wiederholt
  fehlgeschlagene Ticketzustellungen, löscht abgelaufene Auth-Daten;
  Bearer-Authentifizierung über `CRON_SECRET`, folgt keinen Redirects
- **Dokumentation:** 11 Dokumente in `docs/` (Deployment, Coolify, Testing,
  Admin-Anleitung, Security-Audit, Rate-Limiting, Privacy-Review,
  Abnahmeprotokolle, offene Punkte)

---

## 8. Mengengerüst

| Metrik | Wert |
|---|---|
| TypeScript/TSX in `src` | 115 Dateien, 9.670 Zeilen |
| Skripte (Build, Migration, Cleanup, Preflight, Tests) | 14 Dateien, 1.219 Zeilen |
| Browser-Tests | 3 Dateien, 175 Zeilen |
| **Gesamt Code** | **132 Dateien, 11.064 Zeilen** |
| CSS | 1 Datei (Tailwind-Utilities im Markup) |
| i18n | 2 Locale-Dateien à 166 Zeilen |
| Datenbankmigrationen | 9 |
| Datenbanktabellen | 12 + 1 Enum |
| Server-Action-Module | 13 |
| API-Routen | 4 (`checkout`, `webhooks/stripe`, `cron/cleanup`, `health`) |
| Öffentliche Seiten | 9 (+ Admin-Login) |
| Admin-Seiten | 7 (inkl. Druck- und Scanneransicht) |
| Externe Integrationen | 5 (Stripe, Resend, Cloudinary, Turnstile, Gemini) |
| Dokumentationsseiten | 11 Markdown-Dateien |
| Commits | 48 |
| Projektlaufzeit | 24.07.2026 – 08.10.2026 |

---

## 9. Was **nicht** enthalten ist

Diese Punkte sind bewusst offen und müssen separat kalkuliert werden:

- **AGB und Widerrufsbelehrung** – `/agb` und `/widerruf` liefern 404.
  Rechtlich blockierend für den Verkauf von Reservierungen.
- **Rechtliche Prüfung** von Impressum, Datenschutz, Storno- und
  Buchungsbedingungen
- **Content:** Texte, Fotos, Logo-Erstellung, Bildretusche
- **Live-Abnahme:** echte Stripe-Livezahlung, echter Mailversand, physischer
  QR-Scan auf Zielgerät, echter Linux-/Coolify-Betrieb
- **Backup- und PITR-Einrichtung** auf der Zielinfrastruktur
- **Monitoring und Alarmierung** (nur Health-Endpoint vorhanden)
- **Newsletter, Marketing-Automation, Analytics, Consent-Management**
- **Buchhaltungs-/DATEV-Anbindung, Rechnungsstellung**
- **Multi-Tenant-Fähigkeit** (mehrere Wirte auf einer Instanz)
- **Native App** (Scanner läuft als Web-App im Browser)
- **Bezahlte Werbung, SEO-Redaktion, Social Media**

### 9.1 Bekannte Altlasten im Code

Kleinere Aufräumarbeiten, die beim Aufwand für die Produktionsreife mitzählen:

- `@rive-app/react-canvas` ist als Dependency installiert, wird aber **nirgends
  importiert**. Die Rive-Animation wurde **nicht umgesetzt**.
- `public/festwirt_hero.riv` ist eine **0-Byte-Datei**.
- `src/components/AnimatedLogo.tsx` ist ein Platzhalter mit auskommentiertem
  Rive-Code und wird von keiner Seite eingebunden – tote Datei.
- Der Hero ist stattdessen vollständig in SVG, CSS und Framer Motion umgesetzt.
- Entfernen dieser drei Reste: geschätzt unter einer Stunde, aber es gehört in
  eine saubere Übergabe.

---

## 10. Komplexitätstreiber

Diese Punkte treiben den Aufwand über eine normale Website hinaus:

1. **Zahlungszustandsmaschine** mit 10 Zuständen, Holds, Refunds, Disputes und
   Webhook-Wiederholungen. Falsch implementiert = Doppelbuchungen oder
   Geldverlust.
2. **Nebenläufigkeit.** Zwei Gäste dürfen denselben Tisch nicht gleichzeitig
   bekommen. Erfordert Transaktionen, Sperren, Idempotenz – und Tests mit
   parallelen Requests.
3. **Einmalige Zugangskontrolle.** QR-Codes müssen kryptografisch eindeutig und
   serverseitig genau einmal entwertbar sein, auch bei Verbindungsabbrüchen.
4. **Rollen- und Rechtekonzept.** Helfer dürfen nur scannen, Freigaben müssen
   sofort widerrufbar sein.
5. **Eigene Authentifizierung.** OTP-Login statt fertigem Provider bedeutet
   eigene Sicherheitsverantwortung.
6. **Zweisprachigkeit** über alle Inhalte inkl. Datenbankfeldern und PDF-Tickets.
7. **Mobile Adminoberfläche.** Der Wirt arbeitet am Handy im Zelt.
8. **DSGVO.** Personenbezogene Daten, Zahlungsdaten, Auftragsverarbeitung,
   Datenregionen, Löschfristen.
9. **Betrieb ohne Plattform.** Selbst gehostet bedeutet: Migrationen, Backups,
   Cleanup-Jobs, Monitoring sind Teil der Leistung.
10. **Dokumentations- und Abnahmeaufwand.** Die 11 Dokumente und die
    Testsuite sind bezahlte Arbeit, nicht Beiwerk.

---

## 11. Optionale Referenzschätzung

> **Diesen Abschnitt entfernen, wenn eine unvoreingenommene Schätzung gewünscht
> ist.** Er dient nur dem Abgleich.

- Grobe Aufwandsschätzung für den Nachbau: **220–380 Stunden**
- Realistischer Stundensatz Freelancer DE: 65–95 €/h
- Realistischer Stundensatz kleine Agentur DE: 90–140 €/h
- Daraus Nachbau: **ca. 15.000–50.000 €**
- Restaufwand bis Produktionsreife (Rechtstexte ausgenommen): **20–50 Stunden**
- Laufender Betreuungsaufwand: **2–4 Stunden/Monat**, mit Spitzen vor
  Saisonstart und vor einzelnen Veranstaltungen