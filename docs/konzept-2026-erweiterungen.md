# Konzept 2026: Vereinsfeste, Tischplan, Kunden- und Mitarbeiterportal

Stand: 02.11.2026
Status: Entwurf zur Abstimmung (noch keine Umsetzung)
Grundlage: Feedback des Festwirts + bestehender Code (Next.js 16, Drizzle/Postgres, Resend, Cloudinary, pdf-lib)

---

## 0. Kurzfassung

Der Wirt will weg von der Online-Tischbuchung mit Gebühren hin zu **Vereinsfesten mit Reservierung per E-Mail**, manueller Tischvergabe und einem professionellen Backoffice. Dazu kommen Druckartefakte (A3-Tischplan, Reservierungszettel) und Event-Dokumente (Speisekarte/Programm).

Empfohlene Module:

| Modul | Nutzen | Aufwand (PT) |
|---|---|---|
| A. Reservierungsmodi (`keine` / `per E-Mail` / `online`) + Paket-/Steueroptionen (nur Online) | Vereinsfeste ohne Stripe/Gebühren, klare Kennzeichnung, MwSt. korrekt | 5–7 |
| B. A3-Tischplan drucken | Plan fürs Zelt, Reihen/Sektionen, belegt/frei | 4–6 |
| C. Reservierungszettel drucken | Tischschilder im Maurer-Events-Look, 2-/4-up | 3–4 |
| D. Event-Dokumente + Quick Actions | Speisekarte/Programm als PDF/Bild, WebP-Vorschau, Layer | 4–6 (+1–2 Spike) |
| E. Kundenverwaltung + SnapTicket-Import | Kundenstamm, Tische zuweisen, Bestätigungsmails | 5–7 |
| F. Mitarbeiterportal + Onboarding + Verträge | Einladung, Stammdaten, Dokumente, Unterschrift, Rollen | 12–16 |
| G. Personalplanung | Verfügbarkeit, Bedarfsrechnung, Lücken, Kostenschätzung | 8–12 |
| H. DATEV-Export (Lohn-Stammdaten) | Schnittstelle zum Steuerberater, auditierbar | 2–3 |
| I. DSGVO-/Sicherheits-Härtung + Abnahme | Löschkonzept, Rechte, Audit, Tests | 4–6 |

**Gesamt: ca. 47–67 Personentage.** Für den Saisonstart reicht Stufe 1 (A+B+C+D) mit ca. 16–23 PT. Das Mitarbeiterportal ist der größte und rechtlich sensibelste Block und sollte erst nach Stufe 1 pilotiert werden.

**Fünf Grundsatzentscheidungen, die den Rest prägen:**

1. **Reservierungsmodus wird ein Enum** (`none` / `email` / `online`) statt zwei Boolean-Flags. `online` bleibt für bestehende Events erhalten, `email` ist der neue Standard für Vereinsfeste.
2. **E-Mail-Reservierung bekommt ein strukturiertes Anfrageformular + Anfragen-Postfach** statt reinem `mailto:`. Der Wirt verliert keine Mails, die Daten landen direkt in der Kundenverwaltung, und der Gast bekommt eine Eingangsbestätigung.
3. **Tische bleiben global, bekommen aber Sektion/Reihe/Tischnummer und echte Maße.** Eine komplette per-Event-Layoutverwaltung wäre ein eigenes Projekt; für A3-Druck reicht das erweiterte globale Layout.
4. **Paketpreise tragen ihre steuerliche Einordnung mit sich.** Bei der Eventerstellung wird pro Paket festgelegt: Preis, Einheit (pro Person/pro Tisch), inkl. oder exkl. MwSt., Steuersatz und Steuerhinweis. Netto/Brutto/MwSt. werden berechnet und gespeichert – damit der Wirt gegenüber Steuerberater und Gästen sauber bleibt. Kein separates Compliance-System.
5. **Online-Reservierung bleibt vorerst aus.** Neue Events starten mit `none` oder `email`; der bestehende Stripe-Wizard bleibt für Altdaten unangetastet. Das Gutscheinpaket gehört ausschließlich zum Online-Flow und wird deshalb zunächst nur konfiguriert, nicht aktiv verkauft.

**Wichtig:** E-Mail-Reservierungen sind **kein** Online-Checkout. Dort gibt es kein Getränkepaket und keine automatische Preislogik; der Wirt trägt den Preis bei Bedarf manuell ein.

---

## 1. Ausgangslage und technische Leitplanken

Bereits vorhanden und wiederverwendbar:

- `src/lib/ticket.ts` – PDF-Erzeugung mit pdf-lib, eingebetteter Roboto, Logo-SVGs, QR-Code. Vorlage für Bestätigungen und Verträge.
- `src/lib/ticket-delivery.ts` – idempotenter Mailversand mit eingefrorenem Payload.
- `src/app/actions/upload.ts` + `src/lib/imageOptimizer.ts` – Sharp-Pipeline nach WebP, Cloudinary-Upload.
- `src/app/[locale]/admin/events/[id]/print/page.tsx` + `PrintLayout.tsx` – A4-Druck per Browser, `window.print()`.
- `src/lib/reservation-policy.ts` / `reservation-admin.ts` – Validierung, Statusmaschine, Kapazitätsprüfung, Advisory Locks.
- `src/lib/auth.ts` / `staff-access.ts` – OTP-Login, Rollen `admin`/`scanner`, Session-Cookie.
- `src/db/schema.ts` – Events, Tables, Reservations, Settings, ScannerAccess.

Wichtige Einschränkungen, die den Plan bestimmen:

- **Tische sind global**, nicht pro Event (`tables` ohne `eventId`). Es gibt keine Reihe/Sektion/Tischnummer, nur `positionX/positionY` und ein globales `settings.tent_dimensions`.
- **Kein PDF-Viewer und keine PDF-Uploads.** Erlaubt sind nur JPG/PNG/WebP; Sharp kann PDFs mit den npm-Prebuilds nicht zuverlässig rastern.
- **CSP blockiert PDF-Einbettung:** `object-src 'none'`, `frame-src` nur Stripe/Turnstile, `X-Frame-Options: DENY`. Ein `<iframe src="...pdf">` ist damit ausgeschlossen.
- **Server-Action-Limit 4 MB** (`next.config.mjs`). Größere PDFs brauchen einen eigenen Route-Handler.
- **`api/cron/cleanup` verlangt Stripe** (503 ohne `STRIPE_SECRET_KEY`). Ein E-Mail-only-Betrieb muss diese Sperre optional machen, sonst stehen Ticket-Retry und Aufräumjobs.
- **`SiteShell` umschließt auch `/admin`** mit Navbar/Footer. Ein Mitarbeiterportal braucht eine eigene Chrome-Hülle (Route Groups).
- **Kein Modal-Primitive, kein Toast, kein Zod.** Bestehende Muster: `alert/confirm/prompt`, Inline-Statusboxen, handgeschriebene Validatoren.
- **Admin-Navigation ist Tab-State**, keine Routen. Neue große Bereiche (Kunden, Mitarbeiter) sollten routenbasiert werden.

---

## 2. Modul A: Reservierungsmodi und E-Mail-Reservierung

### 2.1 Zielbild

Drei klar getrennte Modi pro Event:

| Modus | Öffentliche Kennzeichnung | Verhalten |
|---|---|---|
| `none` | kein Badge, optional „Freie Platzwahl“ | Kein CTA, kein Formular. System weiß: keine Reservierung möglich. |
| `email` | **„Reservierung per E-Mail“** | Anfrageformular → Postfach beim Wirt → manuelle Bestätigung. Keine Stripe-Gebühr. |
| `online` | „Tische reservierbar“ (bestehend) | Bisheriger 4-Schritte-Wizard mit Stripe. Bleibt für bestehende Events. |

`events.reservable` und `allowTableSelection` bleiben übergangsweise bestehen (Backfill: `reservable=true` → `online`, sonst `none`), werden aber nicht mehr zur Steuerung gelesen. Nach einer Saison können sie entfallen.

### 2.2 Datenmodell

`events` erhält:

- `reservationMode` Enum `reservation_mode` (`none` | `email` | `online`), Default `none`
- `reservationEmail` (Default `servus@maurer-events.com`)
- `reservationNote` (optionaler Hinweis, DE/EN, z. B. „Reservierungen nur für Vereine ab 20 Personen“)
- `reservationDeadline` (optional: bis wann Anfragen angenommen werden)

`event_settings` erhält:

- `pricingMode` Enum `per_person` | `per_table` – **nur für Online-Reservierungen relevant**. Bei `email`/`none` ohne Funktion.
- `packages` (bestehendes JSON-Array) wird erweitert. Jedes Paket:
  ```json
  {
    "id": "getraenke",
    "name": "Getränkepaket",
    "description": "10 Getränkegutscheine à 12 €",
    "type": "voucher_bundle",
    "unit": "per_table",
    "priceCents": 12000,
    "priceIncludesVat": true,
    "vatRate": 19,
    "vatNote": "Getränke",
    "voucherCount": 10,
    "voucherValueCents": 1200,
    "voucherTerms": "Einlösbar am Veranstaltungstag im Zelt. Keine Barauszahlung.",
    "active": true,
    "popular": false
  }
  ```
  Die bisherigen 20-/50-€-Pakete pro Person bleiben als `unit: "per_person"` erhalten und werden um dieselben Steuerfelder ergänzt.
- Global in `settings`: `taxStatus` (`standard` | `small_business` nach § 19 UStG). Bei `small_business` werden keine MwSt.-Beträge ausgewiesen.
- `slipNote` (Text auf dem Zettel, Default „Dieser Tisch muss ab 15 Minuten vor der Reservierung freigehalten werden.“)
- `slipFreeAfterMinutes` Default 15
- `requestLeadDays` (Vorlauf für Anfragen)

`reservations` erhält:

- `status` zusätzlich `requested` und `declined`
- `source` (`online` | `email` | `manual` | `import`)
- `customerId` (nullable FK)
- `bookingGroupId` (UUID, für mehrere Tische eines Vereins)
- `groupLabel` (z. B. „SV Müchsmünster“), `groupIndex`, `groupSize`
- `notes` (Gastnachricht), `internalNotes`
- `packageId`, `packageName` (nur Online)
- `priceGrossCents`, `priceNetCents`, `vatCents`, `vatRate` (Snapshot der Berechnung)
- `agreedPriceCents` (nur manuell bei E-Mail/Manual; optional)
- `confirmedAt`, `confirmedBy`
- `slipPrintedAt` (für „nur neue/geänderte Zettel drucken“)

Statusmaschine erweitern:

```
requested → confirmed | declined | cancelled
declined  → (Ende)
```

`requested` belegt **keine** Kapazität. Erst `confirmed` prüft Kapazität und darf Tische zuweisen. `OCCUPYING_STATUSES` bleibt unverändert; `ADMIN_TRANSITIONS` wird ergänzt.

### 2.3 Öffentliche UX

**Event-Karte (Landingpage + `/termine`)**

- Badge-Logik zentral in `src/lib/reservation-badge.ts`, damit Karte, Detailseite und Admin dieselbe Wahrheit nutzen.
- `email`: Badge „Reservierung per E-Mail“ + Button „Tisch anfragen“.
- `none`: kein Badge; optional dezenter Hinweis „Freie Platzwahl“.
- `online`: wie heute.

**Event-Detailseite**

- Statt des Wizard-Blocks erscheint bei `email` eine `ReservationRequestCard`:
  - Kurztext, **keine Paket- oder Preisangabe** (Konditionen klärt der Wirt individuell per Mail)
  - Button öffnet ein Modal mit Formular:
    - Name, E-Mail, Telefon (optional), Verein/Firma
    - Datum (nur `reservableDates`), Uhrzeitwunsch, Personen, gewünschte Tischanzahl
    - Nachricht
    - Datenschutz-Checkbox mit Link
    - Turnstile + Rate Limit (5/15 min pro E-Mail, wie Warteliste)
  - Nach dem Absenden: „Anfrage ist beim Wirt eingegangen. Du erhältst eine Bestätigung per E-Mail.“
- Fallback-Link `mailto:` mit vorausgefülltem Betreff, falls jemand lieber direkt schreibt.
- Bei `none`: keine Sektion, stattdessen kurzer Hinweis „Keine Reservierung nötig – komm einfach vorbei.“

**E-Mail-Flows**

1. **Anfrage an den Wirt** an `reservationEmail`, `replyTo` = Gast. Inhalt strukturiert (Datum, Personen, Verein, Tischanzahl, Nachricht), plus Link in den Adminbereich.
2. **Eingangsbestätigung an den Gast** („Wir melden uns innerhalb von 2 Werktagen“), mit Zusammenfassung.
3. **Bestätigung nach manueller Vergabe**: Tisch(e), Datum, Uhrzeit, Personen, ggf. manuell eingetragener Preis, Zahlungshinweis, Storno-Link, Kontakt. Optional PDF „Reservierungsbestätigung“ (wiederverwendet `ticket.ts`, QR optional).

Alle Mails laufen über ein neues `src/lib/email-templates/` mit gemeinsamer HTML-Hülle (Logo, Farben, Footer) und `deliverReservationRequest` / `deliverReservationConfirmation` mit Idempotenz-Key.

### 2.4 Admin-UX

- Event-Detail: neuer Tab **„Anfragen“** (nur bei `email`), Zähler offener Anfragen.
- Liste mit Filter (offen / bestätigt / abgelehnt), Suche, Datum.
- Detailansicht: alle Angaben, „Bestätigen“ → Tischzuweisung (einzeln oder mehrere Tische für einen Verein), „Ablehnen“ mit Grund (Mail an Gast).
- Beim Bestätigen: Kapazitätsprüfung, Tische reservieren, optional `agreedPriceCents` manuell setzen, Bestätigungsmail senden, Status `confirmed`. **Kein Paket, keine automatische Preisberechnung.**
- Manuelles Anlegen bleibt möglich (`createManualReservation`), jetzt mit `source='manual'` und optionalem Kundenlink.
- Dashboard-KPI: „Offene Anfragen“.

### 2.5 Paket- und Steueroptionen bei der Eventerstellung (nur Online)

Ziel: Der Wirt soll bei der Eventerstellung die Paketoptionen auswählen und **steuerlich korrekt** hinterlegen können. Das gilt **ausschließlich für Online-Reservierungen**; bei `email`/`none` gibt es keine Pakete.

**Pro Paket konfigurierbar:**

| Feld | Bedeutung |
|---|---|
| `name`, `description` | Anzeigename und Beschreibung |
| `unit` | `per_person` oder `per_table` |
| `priceCents` | Preis in Cent |
| `priceIncludesVat` | Preis ist brutto (inkl. MwSt.) oder netto (zzgl. MwSt.) |
| `vatRate` | 0, 7 oder 19 % |
| `vatNote` | z. B. „Getränke“, „Speisen“, „Dienstleistung“ |
| `type` | `food_package`, `voucher_bundle`, `other` |
| `voucherCount`, `voucherValueCents`, `voucherTerms` | nur bei `voucher_bundle` (10 × 12 €, Einlösebedingungen als Text) |
| `active`, `popular` | Sichtbarkeit und Hervorhebung |

**Berechnung und Anzeige:**

- Brutto inkl. MwSt.:
  ```
  netto = brutto / (1 + vatRate/100)
  mwst  = brutto - netto
  ```
- Netto zzgl. MwSt.:
  ```
  brutto = netto × (1 + vatRate/100)
  mwst   = brutto - netto
  ```
- Beispiel 120 € brutto, 19 %: netto 100,84 €, MwSt. 19,16 €.
- Bei `taxStatus = small_business` (§ 19 UStG): keine MwSt. ausweisen, Hinweis „Keine Umsatzsteuer gemäß § 19 UStG“.
- Die berechneten Werte werden auf der Reservierung **eingefroren** (`priceGrossCents`, `priceNetCents`, `vatCents`, `vatRate`), damit spätere Paketänderungen alte Buchungen nicht verändern.

**Getränkepaket (10 × 12 €):**

- Nur als Paket im Online-Flow, `unit: per_table`, `type: voucher_bundle`, `priceCents: 12000`, `voucherCount: 10`, `voucherValueCents: 1200`.
- Berechnung: `Paketpreis × Anzahl Tische`, nicht × Personen.
- **Nicht** im E-Mail-Anfrageformular und **nicht** in der E-Mail-Bestätigung. Dort trägt der Wirt den Preis bei Bedarf manuell ein (`agreedPriceCents`).
- Die Gutscheinbedingungen sind ein einfaches Textfeld am Paket (`voucherTerms`), kein separates Compliance-System.
- Da Online vorerst aus ist, wird das Paket in Stufe 1 nur konfiguriert und angezeigt, nicht aktiv verkauft.

**Gutscheine und Umsatzsteuer (kurz):**

- Der Wirt ist **regelbesteuert** und muss Umsatzsteuer abführen (Stand 02.11.2026).
- Ob es „nur eine Wertmarke“ ist, entscheidet steuerlich nicht. Seit 2019 unterscheidet das UStG **Einzweck- und Mehrzweckgutscheine** (§ 3 Abs. 13–15 UStG).
- **Einzweckgutschein:** Ort der Leistung und Steuersatz stehen bei Ausgabe fest. Dann ist die Umsatzsteuer schon beim **Verkauf des Gutscheins** fällig; die spätere Einlösung ist keine separate Leistung.
- **Mehrzweckgutschein:** Ort oder Steuersatz stehen nicht fest (z. B. einlösbar für Speisen mit 7 % und Getränke mit 19 % oder bei verschiedenen Betrieben). Dann entsteht die Umsatzsteuer erst bei **Einlösung**.
- Der **Getränkegutschein gilt nur für Getränke beim eigenen Fest** → Ort und Steuersatz (19 %) stehen fest. Damit ist er ein **Einzweckgutschein**; die MwSt. ist beim Verkauf fällig. Bei 120 € brutto: 100,84 € netto + 19,16 € MwSt.
- **Eventbindung:** Der Gutschein gehört zu genau einem Event (`vouchers.eventId`). Er kann nicht bei einem anderen Fest eingelöst werden. Das wird zusätzlich auf dem Gutschein/Zettel ausgewiesen („Nur am 03.09.2026 im [Event] gültig“).
- **Das System entscheidet die Gutscheinart nicht automatisch.** Es speichert `priceIncludesVat`, `vatRate` und `vatNote`; die Einordnung bestätigt der Steuerberater einmalig. Danach rechnet das System nur mit den hinterlegten Werten.
- Ein Handelsregistereintrag (z. B. e. K.) sagt **nichts** über den umsatzsteuerlichen Status aus. Hier ist der Status „regelbesteuert“ gesetzt.

**Admin-UI bei der Eventerstellung:**

- Paketliste mit „Paket hinzufügen“, Reihenfolge, aktiv/inaktiv.
- Globaler **Steuerstatus** in den Einstellungen: regelbesteuert oder Kleinunternehmer (§ 19 UStG). Bei Kleinunternehmer wird keine MwSt. ausgewiesen.
- Jede Zeile: Name, Beschreibung, Einheit, Preis, „inkl. MwSt.“-Schalter, Steuersatz, Steuerhinweis.
- Live-Vorschau: „120,00 € inkl. 19 % MwSt. = 100,84 € netto + 19,16 € MwSt.“
- Warnung, wenn ein aktives Paket keinen Steuersatz hat.
- Hinweis: Steuerliche Sonderfälle (Gutscheine, Ermäßigungen) mit dem Steuerberater abstimmen.

### 2.6 Akzeptanzkriterien

- Ein Event lässt sich auf `none`, `email` oder `online` stellen; öffentliche Karte und Detailseite reagieren korrekt.
- Eine E-Mail-Anfrage erzeugt einen Datensatz mit Status `requested`, sendet Wirt- und Gastmail und ist im Admin sichtbar.
- Bestätigen ohne freie Kapazität ist blockiert und erklärt warum.
- Bestätigen sendet genau eine Mail (Idempotenz), auch bei Doppelklick.
- `none` zeigt nirgends einen Reservierungs-CTA.
- `email` zeigt **keine** Paketpreise und keine Gutscheine.
- `online` kann Pakete mit inkl./exkl. MwSt. und 0/7/19 % korrekt berechnen; 10 × 12 € = 120 € pro Tisch, 5 Tische = 600 €.
- Ein Gutschein ist an genau ein Event gebunden und kann bei einem anderen Event nicht eingelöst werden.
- Bei Kleinunternehmerstatus wird keine MwSt. ausgewiesen (hier nicht relevant, Wirt ist regelbesteuert).
- Bestehende Online-Events funktionieren unverändert; die 48 Security-Tests bleiben grün.

---

## 3. Modul B: A3-Tischplan drucken

### 3.1 Format und Inhalt

- **A3 quer** (420 × 297 mm), Rand 8 mm, `@page { size: A3 landscape }`.
- Kopf: Logo, Eventtitel, Datum, „Tischplan“, Stand-Uhrzeit, Maßstab/Scale-Bar.
- Zeltumriss mit Bühne, Theke, Eingang (als konfigurierbare Marker).
- Tische als Rechtecke/rund mit Sitzpunkten, Beschriftung:
  - Tischnummer (z. B. `T120`)
  - Kapazität
  - bei Belegung: Kurzname oder Initialen, Personen, Uhrzeit
- Farbcodes: frei (creme), reserviert (grün), VIP (gold), gesperrt (grau).
- Legende + Reihenbeschriftung („Reihe 10“) + Sektionsüberschrift („Mittelschiff“).
- Zwei Varianten:
  - **Interne Version** mit Namen (für Wirt/Service).
  - **Öffentliche Version** ohne Namen (nur „reserviert“, Personen, Zeit) – datenschutzfreundlich, wenn der Plan im Zelt hängt.
- Optional „leerer Plan“ (ohne Belegung) zum Aufhängen/Planen.

### 3.2 Datenmodell

`tables` erweitern:

- `section` (Text, z. B. „Mittelschiff“, „Links“, „Rechts“)
- `rowLabel` (Text, z. B. „10“)
- `displayNumber` (Text, z. B. „T120“; `name` bleibt interner Schlüssel)
- `shape` (`rect` | `round`), `widthM`, `heightM`, `rotation`
- `isBlocked` (gesperrt, z. B. Technik/Durchgang)
- `seatCountVisible` (optional)

`settings.tent_dimensions` erweitern zu:

```json
{ "width": 46, "height": 34, "cellSizeM": 1.2, "features": [
  { "kind": "stage", "x": 20, "y": 0, "w": 6, "h": 2 },
  { "kind": "bar", "x": 0, "y": 12, "w": 3, "h": 8 },
  { "kind": "entrance", "x": 22, "y": 33, "w": 2, "h": 1 }
] }
```

Bestehende `positionX/positionY` bleiben das Raster. `cellSizeM` macht daraus echte Maße. Kein per-Event-Layout in Stufe 1; falls der Wirt pro Fest umbaut, kommt später `event_layout_overrides`.

### 3.3 Umsetzung

- Neue Route `/admin/events/[id]/tischplan` (Server Component, `requireAdmin(true)`).
- Query-Parameter: `date`, `mode=internal|public`, `occupancy=1|0`.
- Rendering als **SVG** (skaliert exakt, druckt vektorscharf), nicht als CSS-Grid.
- Client-Komponente `PrintTrigger` ruft `window.print()` erst nach Font-/Bild-Load.
- Print-CSS im Route-Layout:
  ```css
  @page { size: A3 landscape; margin: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ```
- Browser druckt / „Als PDF speichern“. Kein serverseitiges PDF in Stufe 1 (deutlich weniger Aufwand, gleiche Qualität für den Anlass). Optional später pdf-lib/Playwright.
- Wenn Text unter 6 pt fällt: Warnung „Zu viele Tische für A3 – bitte A2 oder zwei Seiten“.

### 3.4 Nummerierung

Generator erweitern: pro Sektion Präfix und Startnummer, pro Reihe Fortschritt. Beispiel:

- Links: `T101`–`T120`, Reihe 1–5
- Mittelschiff: `T201`–`T240`, Reihe 6–15
- Rechts: `T301`–`T320`, Reihe 16–20

Die Nummer ist auf Plan und Zettel identisch – das ist der eigentliche Mehrwert gegenüber dem heutigen `Tisch 1…n`.

### 3.5 Akzeptanzkriterien

- A3-Druck passt auf eine Seite, nichts wird abgeschnitten, Farben bleiben erhalten.
- Jeder Tisch zeigt Nummer, Reihe, Sektion und Belegungsstatus.
- Öffentliche Version enthält keine Namen.
- Plan funktioniert für ein Event mit ≥ 100 Tischen ohne Layoutfehler.
- Bestehende Tischzuweisung/Drag&Drop bleibt unverändert.

---

## 4. Modul C: Reservierungszettel

### 4.1 Format

Orientiert am Foto des Kollegen, aber in Maurer-Events-DNA:

- **A6 quer** (148 × 105 mm), 4 Stück pro A4-Blatt, Schnittmarken.
- Alternativ **A5 quer** (210 × 148 mm), 2 Stück pro A4 – größere Schrift, besser für Zelte.
- Optional „1 pro Seite“ für Etikettendrucker.
- Papiervorschlag: 160–200 g/m², matt; kein Vollflächen-Druck, damit es nicht wellt.

### 4.2 Inhalt

```
┌──────────────────────────────────────────┐
│  [Logo]              MAURER EVENTS       │  grüne Leiste, goldene Haarlinie
├──────────────────────────────────────────┤
│              RESERVIERT                  │  Display-Font, grün
│  Dieser Tisch muss ab 15 Min. vor ...    │  editierbarer Hinweistext
│                                          │
│  #1908 · Mittelschiff · Reihe 10 · T120  │
│  Tobias Necker                           │  optional: Verein / Initialen
│                                          │
│  03.09.2026        30 Pers.      18:00   │
│  ─────────────────────────────────────   │
│  Tisch 2 von 5 · Servus!                 │  bei Gruppen
└──────────────────────────────────────────┘
│ [Scallop-/Zeltmotiv als dezente Grafik]  │
```

- Brand: `#F4F0E8` Creme, `#1F5732` Grün, `#cb7913` Gold, Logo invertiert auf Grün.
- Optional QR (nur Reservierungs-ID, keine Personendaten) für Service/Check-in.
- Namensmodus pro Event: `full` | `initial` | `club` (Datenschutz).
- Fußzeile: „Fragen? servus@maurer-events.com“.

### 4.3 Druck-Workflow

- Route `/admin/events/[id]/zettel?date=…&status=confirmed`.
- Auswahl: alle bestätigten Reservierungen des Datums, nur neue/geänderte (`slipPrintedAt`), oder manuelle Auswahl.
- Sortierung nach Sektion → Reihe → Tischnummer (Laufweg im Zelt).
- Beim Druck `slipPrintedAt` setzen (Server Action nach Bestätigung im UI, nicht im Print-Request – sonst zählt ein abgebrochener Druck).
- Vorschau im Browser, `window.print()`, `@page { size: A4 portrait; margin: 6mm }`.
- Schnittmarken über CSS-Pseudo-Elemente; `break-inside: avoid`.

### 4.4 Akzeptanzkriterien

- 4 Zettel pro A4 passen exakt, Schnittmarken sitzen.
- Jeder Zettel enthält ID, Sektion, Reihe, Tischnummer, Name (gemäß Modus), Datum, Personen, Uhrzeit.
- Kein Zettel ohne Tischzuweisung.
- Mehrfachdruck erzeugt keine Duplikate in der „nur neue“-Auswahl.

---

## 5. Modul D: Speisekarte und Programm als Event-Dokumente

### 5.1 Anforderungen

- Pro Event optional **Speisekarte** und **Programm/Ablauf** (Bands, Zeiten).
- Upload als **PDF oder Bild** (JPG/PNG/WebP), automatische **WebP-Vorschau**.
- Anzeige in der Event-Detailansicht.
- Quick-Action-Buttons auf der Landingpage öffnen die Vorschau in einem **Layer/Modal**.
- PDF bleibt als Original downloadbar; die Vorschau ist für alle sichtbar.

### 5.2 Technische Pipeline

**Bilder:** bestehende Sharp-Pipeline (`optimizeImage` → WebP, max. 1600 px) unverändert.

**PDFs:** Zwei Optionen, per Spike (1–2 PT) entscheiden:

- **Option A (bevorzugt): Cloudinary-Transformation.** PDF als `resource_type: image` hochladen, Vorschau über `.../image/upload/pg_1,f_webp,w_1600/<publicId>.pdf`. Keine neue Abhängigkeit, aber Account-Einstellung „PDF delivery“ muss aktiv sein und der Upload-Preset muss PDFs zulassen.
- **Option B: serverseitiges Rastern** mit `pdfjs-dist` + `@napi-rs/canvas` in einem Node-Route-Handler. Mehr Kontrolle, aber native Abhängigkeit und Kaltstart-Risiko.
- **Fallback:** PDF ohne Vorschau anzeigen, nur Download-Button. Kein Blocker für Stufe 1.

**Upload-Route:** `POST /api/admin/documents` (kein Server Action), weil das 4-MB-Limit sonst gilt:

- `requireAdmin()`
- `boundedBody` mit 15 MB Cap
- MIME-Whitelist: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
- signierter Cloudinary-Upload (`CLOUDINARY_API_KEY`/`SECRET`, vorhanden)
- Original + Vorschau(n) speichern; bei PDF alle Seiten bis max. 20 als WebP-Seiten
- Rückgabe: `{ fileUrl, previewUrl, pages: [{ page, url, width, height }] }`

**CSP:** PDF wird nie eingebettet. Die Vorschau ist ein `<img>` von Cloudinary (bereits erlaubt), der Download öffnet `target="_blank"` mit `rel="noopener"`. Damit bleibt `object-src 'none'` bestehen.

### 5.3 Datenmodell

`event_documents`:

- `id`, `eventId` (FK, cascade)
- `kind` (`menu` | `program`)
- `title`, `titleEn`
- `fileUrl`, `mimeType`, `sizeBytes`
- `previewUrl`, `pages` jsonb `[{ page, url, width, height }]`
- `sortOrder`, `isPublic`
- `createdBy`, `createdAt`, `updatedAt`

Damit sind mehrere Dateien/Seiten pro Art möglich (z. B. Karte Vorder-/Rückseite). Für Stufe 1 reicht ein Dokument pro Art; die Tabelle ist aber nicht im Weg.

### 5.4 UI

**Admin (Event-Detail, neuer Tab „Dokumente“)**

- Zwei Karten: Speisekarte, Programm.
- Drag&Drop oder Dateiauswahl, Fortschritt, Vorschau-Thumbnail.
- Ersetzen, löschen, Seite neu sortieren, Titel DE/EN, „öffentlich“-Toggle.
- Hinweis bei fehlender PDF-Vorschau.

**Landingpage-Karte**

- Die Karte ist heute ein einziges `<Link>`; echte Buttons darin wären ungültiges HTML.
- Umbau: Karte `relative`, Titel/Fläche als Stretched-Link (`absolute inset-0`), Quick-Actions mit `relative z-10`.
- Aktionszeile unten: links Pills „Speisekarte“ / „Programm“ (nur wenn vorhanden), rechts „Details“.
- Klick öffnet `DocumentViewer` (Portal, Fokus-Falle, ESC, Scroll-Lock, `role="dialog"`, `aria-modal`).
- Im Viewer: Seiten als Bilder, Zoom +/−, „PDF herunterladen“, Schließen. Mobil als Vollbild-Sheet.

**Event-Detailseite**

- Buttons unter dem Header und in der Sidebar.
- Optional: erste Seite als Vorschau eingebettet (SEO/Überblick), Rest im Viewer.

### 5.5 Akzeptanzkriterien

- PDF- und Bild-Upload funktionieren; die Vorschau ist WebP.
- Ohne Dokument erscheinen keine Buttons.
- Modal ist per Tastatur bedienbar, schließt mit ESC, blockiert Hintergrund-Scroll.
- Auf der Landingpage navigiert ein Klick auf die Karte weiterhin zum Event, ein Klick auf die Pills öffnet nur den Viewer.
- Kein PDF-iframe, keine CSP-Verletzung.

---

## 6. Modul E: Kundenverwaltung und SnapTicket-Import

### 6.1 Begriff klären

Der Wirt nennt es „Kundenportal“. Gemeint ist offenbar **eine interne Kundenverwaltung**, kein Login für Gäste. Stufe 2 baut die interne Sicht. Ein echtes Gäste-Login („meine Reservierungen“) ist ein separates Feature und nicht nötig, um Tische zuzuweisen und Mails zu senden.

### 6.2 Datenmodell

`customers`:

- `id`, `displayName`, `company` (Verein), `email` (unique, lower), `phone`
- `street`, `zip`, `city`
- `notes`
- `source` (`manual` | `request` | `snapticket`)
- `externalRef` (z. B. SnapTicket-ID), `externalSource`
- `marketingConsent` (bool, Zeitstempel)
- `createdAt`, `updatedAt`, `deletedAt`

**Bewusste Entscheidung:** Nur der Kundenstamm wird importiert, **keine historischen Reservierungen/ Umsätze**. Das hält den Import klein, vermeidet Konflikte mit alten Event-/Tischdaten und reicht für den Zweck (Kontakt + Zuordnung). Eine Besuchshistorie kann später ergänzt werden, wenn der Wirt sie tatsächlich braucht.

Reservierungen verweisen über `customerId` auf den Kunden. Beim Anlegen einer Anfrage wird per E-Mail gematcht oder ein Kunde erzeugt.

### 6.3 Import aus SnapTicket

Ablauf:

1. Upload CSV (UTF-8, `;` oder `,`) – XLSX nur, wenn das Exportformat es zwingend braucht (`exceljs` als zusätzliche Abhängigkeit).
2. Spalten-Mapping im UI (gespeicherte Profile pro Quelle).
3. Vorschau der ersten 20 Zeilen + Validierungsfehler pro Zeile.
4. Dedupe-Strategie: primär E-Mail (lower/trim), sekundär Telefon + normalisierter Name.
5. Import in einer Transaktion, idempotent über `externalRef`; Report: neu / aktualisiert / übersprungen / Fehler.
6. Kein Import von Zahlungs-, Gesundheits- oder Historien-Daten; nur Kontaktstammdaten.

`customer_imports` speichert Dateiname, Akteur, Zähler, Fehlerreport und Mapping-Version.

**Offen:** Beispiel-Export von SnapTicket. Ohne den ist das Mapping Raten. Falls Snapticket keine API hat, bleibt CSV der Weg.

### 6.4 Zuweisen und Bestätigen

- Kunden-Detail: Stammdaten, offene Anfragen, „Neue Reservierung“.
- Tischzuweisung wie heute per Drag&Drop im Zeltplan, zusätzlich „Unzugewiesen“-Liste.
- Mehrere Tische für einen Verein: `bookingGroupId` + `groupIndex/groupSize`; ein Zettel pro Tisch mit „Tisch 2 von 5“.
- „Reservierung festschreiben“:
  1. Kapazität prüfen
  2. Tische setzen
  3. Preis manuell erfassen (optional; kein Paket, keine automatische Berechnung)
  4. Bestätigungsmail mit PDF an den Kunden
  5. Status `confirmed`, `confirmedAt/By`
- Manuelle Zahlungsnotiz (`offen` / `Anzahlung` / `bezahlt`) ohne Stripe.

### 6.5 Akzeptanzkriterien

- CSV-Import legt keine Duplikate bei erneutem Upload an.
- Kunde ist über E-Mail auffindbar; Stammdaten sind editierbar.
- Mehrere Tische eines Vereins erscheinen gruppiert auf Plan und Zetteln.
- Bestätigung sendet eine Mail mit allen Daten und PDF; erneutes Senden ist idempotent.
- Die Bestätigung enthält **keine Paket-/Gutscheinangaben**, sondern nur den ggf. manuell erfassten Preis.

---

## 7. Modul F: Mitarbeiterportal, Onboarding und Verträge

### 7.1 Zugang und Rollen

Neue, vom Admin getrennte Identität:

- Tabelle `staff` mit eigenem Passwort (Argon2id) **oder** Magic-Link.
- Eigenes Cookie `staff_token`, eigene Session-Tabelle `staff_sessions`.
- Eigene Route `/[locale]/team` (Login, Onboarding, Dashboard, Schichten, Dokumente, Verträge).
- **Kein Zugriff auf Admin-Funktionen.** Event-Bezug nur über zugewiesene Feste.
- Admin kann einladen, deaktivieren, Passwort-Reset auslösen, Sichtbarkeiten setzen.

Rollen (Beispiele, vom Wirt pflegbar):

- Küche (Gesundheitszeugnis nötig, Mindestalter 18)
- Bedienung
- Ausschank/Bar
- Aufbau/Abbau
- Spülkraft
- Security/Einlass
- Springer

Jede Rolle hat: Stundensatz, benötigte Dokumente, Vertragsvorlage, Mindestalter, Max-Stunden.

### 7.2 Onboarding-Flow

1. **Admin** legt Mitarbeiter an (E-Mail, Rolle, Feste) → Einladung.
2. **Mitarbeiter** öffnet Link (Single-Use-Token, 7 Tage) → Passwort setzen.
3. **Wizard**:
   - Stammdaten (Name, Geburtsdatum, Adresse, Telefon, Notfallkontakt optional)
   - Lohn-/DATEV-relevante Daten: Steuer-ID, Steuerklasse, Kinderfreibeträge, SV-Nummer, Krankenkasse, IBAN/BIC, Eintrittsdatum, Beschäftigungsart (Minijob / kurzfristig / Werkstudent)
   - Dokumente: Ausweis, Gesundheitszeugnis (Küche), ggf. Steuerkarte
   - Verfügbarkeit pro Fest/Datum/Schicht
   - Vertrag lesen → akzeptieren → unterschreiben
4. **Checkliste** im Admin: Stammdaten ✓, Dokumente ✓, Vertrag ✓, Verfügbarkeit ✓ → Status `ready`. Der Admin kann fehlende Lohnfelder ergänzen und als „geprüft“ markieren.
5. **Offboarding**: deaktivieren, Aufbewahrungsfristen, Löschung.

### 7.3 Verträge

- `contract_templates`: pro Rolle, versioniert, editierbar durch den Wirt (Quill, vorhanden).
- Status je Vorlage: `draft` → `reviewed` → `active`; `reviewedBy`, `reviewedAt`, `effectiveAt`, `reviewEvidenceUrl`. Nur `active`-Vorlagen können neuen Mitarbeitern zugewiesen werden (Override mit Audit).
- Variablen: `{{vorname}}`, `{{nachname}}`, `{{adresse}}`, `{{rolle}}`, `{{fest}}`, `{{stundensatz}}`, `{{startdatum}}`, `{{iban_masked}}` usw.
- Beim Versand wird der gerenderte Text **eingefroren** (`contracts.bodyHtml`), damit spätere Vorlagenänderungen unterschriebene Verträge nicht verändern.
- Version + SHA-256-Hash + Zeitstempel + IP/User-Agent + Consent-Version speichern.
- PDF-Erzeugung mit pdf-lib (Mehrseiter-Layout, vorhandene Roboto/Logo-Assets). Unterschriebene Fassung als PDF in Cloudinary, Hash in der DB.

**Unterschriftsmodi:**

| Modus | Einsatz | Ablauf |
|---|---|---|
| `text` | Nicht-Minijob, geringes Risiko | Checkbox + Name + Zeitstempel, PDF wird erzeugt und gespeichert |
| `handwritten` | **Minijob (Wunsch des Wirtes)** | PDF mit vorausgefüllten Daten → herunterladen, drucken, unterschreiben, Foto/Scan hochladen → Admin prüft und markiert „verifiziert“ |

Wichtig: Der Minijob-Vertrag muss laut Wirt händisch unterschrieben werden. Wir setzen das als **Schriftform-Workflow** um (Ausdruck + Scan). Eine qualifizierte elektronische Signatur (QES) wäre rechtlich eine Alternative, ist aber für diesen Anlass teurer und komplizierter. Rechtliche Prüfung durch den Wirt/Anwalt bleibt erforderlich.

### 7.4 Dokumente und DSGVO

- Ausweis: **Verify-and-delete** – Admin prüft, bestätigt (`idVerifiedAt`), Scan wird nach 30 Tagen automatisch gelöscht. Nur wenn der Wirt die Kopie zwingend aufbewahren muss, wird sie verschlüsselt gespeichert.
- Gesundheitszeugnis: nur Status + Ablaufdatum + verschlüsselte Datei; Erinnerung 4 Wochen vor Ablauf.
- IBAN/Steuer-ID/SV-Nummer: app-seitig mit AES-256-GCM verschlüsselt (`STAFF_DATA_KEY`), in der UI maskiert, nur für berechtigte Rollen entschlüsselbar.
- Zugriffsmatrix:
  - Wirt/Admin: alles
  - Admin-Mitarbeiter: alles außer Bankdaten (konfigurierbar)
  - Festleiter: nur Roster + Notfallkontakt, keine Personalakten
  - Mitarbeiter: nur eigene Daten
- Audit-Log für Anlegen/Ändern/Löschen/Export/Download sensibler Dokumente.

### 7.5 Admin-UX

- Neuer Bereich `/admin/mitarbeiter`: Liste, Filter (Rolle, Status, Fest), Suche.
- Detail: Stammdaten, Dokumente, Verträge, Verfügbarkeit, Einsätze, Notizen.
- Rollenverwaltung `/admin/rollen` inkl. Vertragsvorlage.
- Vertragsverwaltung `/admin/vertraege`: Vorlagen, Versionen, zuletzt unterschrieben, offene Unterschriften.
- Einladungsstatus und Erinnerungen („2 von 5 haben noch nicht unterschrieben“).
- Export für das Lohnbüro: DATEV-Profil (siehe 7.7), CSV, nur mit Berechtigung.

### 7.6 Akzeptanzkriterien

- Einladungslink funktioniert genau einmal und läuft ab.
- Mitarbeiter sieht nur eigene Daten und die ihm zugewiesenen Feste.
- Minijob-Vertrag ohne hochgeladene Unterschrift bleibt `pending`; Admin kann nicht versehentlich „abgeschlossen“ setzen.
- Vorlagenänderung verändert keinen bereits unterschriebenen Vertrag.
- Alle sensiblen Felder sind in der DB verschlüsselt und in Logs/URLs absent.
- Lösch-/Aufbewahrungslauf ist testbar und dokumentiert.

### 7.7 DATEV-Export für den Steuerberater

Der Wirt braucht einen Export der Mitarbeiterdaten für die Lohnabrechnung. Wichtig: Wir bauen **keine Lohnabrechnung**, sondern eine **Stammdaten-Schnittstelle**.

**Zuerst klären:** Welches DATEV-Produkt nutzt der Steuerberater?

- DATEV Lohn und Gehalt (LODAS/LuG) → Import über DATEV-ASCII-/CSV-Format mit festen Satzarten.
- DATEV Unternehmen online → meist Beleg-/Stammdatenübermittlung, anderes Format.
- Manche Steuerberater akzeptieren eine einfache Excel/CSV-Liste und pflegen selbst.

Ohne diese Info ist alles außer einer generischen CSV Spekulation.

**MVP (generisches Profil „Lohn-Stammdaten“):**

Felder (nur die, die der Steuerberater tatsächlich braucht):

- Personalnummer, Anrede, Titel, Vorname, Nachname
- Geburtsdatum, Geburtsort (optional), Staatsangehörigkeit (optional)
- Familienstand, Kinderfreibeträge (nur wenn lohnrelevant)
- Straße, PLZ, Ort, Land
- Eintrittsdatum, Austrittsdatum, Beschäftigungsart (Minijob/kurzfristig/Werkstudent)
- Berufsgruppe/Rolle, Stundenlohn oder Monatsgehalt
- Steuer-ID, Steuerklasse
- SV-Nummer, Krankenkasse
- IBAN, BIC
- Austrittsgrund (optional)

**Format und Sicherheit:**

- CSV, Semikolon, UTF-8 (optional Windows-1252), konfigurierbares Datumsformat.
- Validierung vor dem Export: Pflichtfelder, IBAN-Prüfsumme, SV-Nummer-Format, Steuer-ID.
- Export nur für aktive Mitarbeiter im gewählten Zeitraum; Austritte separat.
- **Kein unverschlüsselter E-Mail-Versand.** Download als passwortgeschützte ZIP-Datei oder Einmal-Link; Passwort über separaten Kanal.
- `payroll_exports`-Tabelle: Akteur, Zeitraum, Format/Version, Zeilenzahl, Datei-Hash, Zeitstempel. Download wird geloggt.
- exportierte Datei wird nicht dauerhaft in der DB gespeichert; nur der Hash + Report.
- Wenn der Steuerberater das echte DATEV-ASCII-Format braucht: eigenes Profil mit Satzarten, Testdatei und Abnahme durch den Steuerberater (zusätzlicher Aufwand, im Risiko markiert).

**DSGVO:** Der Export ist eine Datenübermittlung an den Steuerberater (Auftragsverarbeiter/Verantwortlicher). AVV/Vertrag prüfen, Zugriff auf „Lohn Export“ beschränken, Exporte auditieren, keine Empfänger-E-Mail im Klartext speichern.

**Akzeptanz:**

- Export enthält alle Pflichtfelder und keine leeren Pflichtzellen.
- Wiederholter Export erzeugt identische Werte (bis auf Zeitstempel).
- Nur berechtigte Rollen sehen den Export.
- Der Steuerberater kann die Datei importieren (Testimport).

---

## 8. Modul G: Personalplanung und Bedarfsrechnung

### 8.1 Ziel

Der Wirt will sehen:

- wer wann kann,
- wie viele Personen pro Rolle/Schicht nötig sind,
- wo Personal fehlt,
- was es kostet,
- und wie er fair verteilt.

### 8.2 Datenmodell

- `staff_availability`: `staffId`, `eventId`, `date`, `startTime`, `endTime`, `kind` (`available` | `unavailable` | `preferred`), `note`
- `event_staff_requirements`: `eventId`, `roleId`, `date`, `startTime`, `endTime`, `requiredCount`, `note`
- `staff_assignments`: `eventId`, `staffId`, `roleId`, `date`, `startTime`, `endTime`, `status` (`proposed` | `accepted` | `declined` | `confirmed`), `source` (`auto` | `manual`)
- `staffing_rules` pro Rolle: `guestsPerStaff`, `minStaff`, `fixedStaff`, `maxHoursPerDay`, `minRestHours`, `minAge`, `minijobOnly`

### 8.3 Bedarfsrechnung

Einfach und nachvollziehbar, keine Blackbox:

```
Bedarf(role, shift) = max(minStaff, ceil(expectedGuests / guestsPerStaff)) + fixedStaff
```

- `expectedGuests` kommt aus `events.maxCapacity` oder einem neuen Feld `expectedGuests`.
- Schichtvorlagen (z. B. 16:00–01:00) pro Fest, mit Peak-Faktor (18:00–22:00).
- Küche/Bar haben eigene Verhältnisse, nicht Gäste/Service.
- Ausgabe: Bedarfsmatrix pro Tag/Rolle/Schicht.

### 8.4 Zuweisung

Phase 1 – Greedy:

1. Rollen mit den wenigsten verfügbaren Personen zuerst.
2. Kandidaten filtern: Qualifikation, Verfügbarkeit deckt Schicht, nicht schon eingeteilt, Reststunden, Minijob-Budget, Mindestalter.
3. Score: Präferenz + Fairness (wenige bisherige Einsätze) + Kontinuität (gleiche Rolle/Fest) + Wegzeit (optional).
4. Zuweisen, Lücken sammeln.

Phase 2 – lokale Tauschoptimierung, um Lücken zu schließen.

Phase 3 – manuelle Überschreibung per Drag&Drop.

Kein ILP im MVP. Falls später nötig: `javascript-lp-solver` (pure JS) oder OR-Tools als externer Dienst.

### 8.5 Ausgaben

- **Abdeckungsmatrix** pro Fest/Tag/Schicht (grün/gelb/rot).
- **Lückenliste**: „12.09., 18:00–22:00, Bedienung: 2 fehlen (6 Std.)“.
- **Kostenschätzung**: Stunden × Stundensatz, aufgeschlüsselt nach Rolle; Minijob-Grenzen-Warnung.
- **Personal-Pool**: Bewerber aus dem Karriereformular, ehemalige Mitarbeiter, Springer.
- **Schichtvorschläge** an Mitarbeiter mit Accept/Decline; `.ics`-Export.
- **Warnungen**: > 10 h/Tag, < 11 h Ruhezeit, Pausen, Minderjährige, Doppelbelegung.

### 8.6 „Keine Arbeitslosen anstellen“ – rechtliche Einordnung

**Kurzantwort: Eine Checkbox „Ich bin nicht arbeitslos“ ist rechtlich nicht „genug“ und sollte nicht umgesetzt werden.**

Begründung:

- **AGG:** „Arbeitslosigkeit“ ist kein ausdrücklich genanntes Merkmal in § 1 AGG (dort: ethnische Herkunft, Geschlecht, Religion/Weltanschauung, Behinderung, Alter, sexuelle Identität). Eine Checkbox ist deshalb nicht automatisch AGG-widrig. Sie kann aber **mittelbar diskriminierend** wirken, wenn sie bestimmte Gruppen trifft (z. B. ältere Menschen, Menschen mit Behinderung, Alleinerziehende), und sie erzeugt ein erhebliches Reputations- und Prozessrisiko.
- **DSGVO:** Der Beschäftigungsstatus ist personenbezogen, für die Einstellung aber nicht erforderlich. Es fehlt die Zweckbindung und Datenminimierung (Art. 5 DSGVO). „Wir wollen keine Arbeitslosen“ ist kein legitimer, objektiv nachvollziehbarer Zweck für eine Pflichtabfrage.
- **Beweiswert:** Die Checkbox beweist nichts. Niemand wird wahrheitswidrig angeben, arbeitslos zu sein, wenn das zum Ausschluss führt. Sie schützt also nicht vor dem, was der Wirt verhindern will.
- **Kostenprämisse:** Die Annahme „Arbeitslose sind teurer“ ist fachlich falsch. Für die Einstellung von Arbeitslosen gibt es Förderungen (z. B. Eingliederungszuschuss); die Kosten steuern sich über Stundensatz, Stunden, Minijob-Grenzen und Bedarf, nicht über den Beschäftigungsstatus.
- **Frage im Bewerbungsprozess:** Fragen nach Arbeitslosigkeit sind nicht per se unzulässig, aber sie sind heikel und für die Auswahlentscheidung regelmäßig nicht erforderlich. Wenn der Wirt sie stellt, sollte die Antwort **freiwillig** sein, nicht gespeichert und nicht als Ausschlusskriterium verwendet werden.

**Empfehlung:** Nicht als Pflicht-Checkbox umsetzen. Stattdessen objektive Kriterien:

- Qualifikation/Rolle (Küche, Bedienung, Ausschank …)
- Erfahrung und Zuverlässigkeit
- Verfügbarkeit an den Festtagen
- Kostenrahmen pro Rolle (Stundensatz, Minijob-/Kurzfristig-Grenze)
- Einarbeitungsaufwand

Falls der Wirt eigentlich „keine ungelernten Aushilfen“ oder „keine teuren Aushilfen“ meint: Das lässt sich sauber über Rollen, Qualifikationsstufen und den Kostenrechner abbilden. Das sollten wir im Gespräch klären.

**Wenn der Wirt auf einer Abfrage besteht:** Nur als freiwillige Selbstauskunft, ohne Speicherung, ohne automatische Ablehnung, mit dokumentierter objektiver Begründung und anwaltlicher Prüfung. Das ist aber ausdrücklich die schlechtere Lösung.

### 8.7 Akzeptanzkriterien

- Bedarf ist pro Fest/Tag/Rolle/Schicht sichtbar und editierbar.
- Verfügbarkeiten der Mitarbeiter fließen in die Vorschläge ein.
- Lücken werden konkret benannt (Rolle, Zeit, Anzahl, Stunden).
- Keine Zuweisung ohne Qualifikation/Verfügbarkeit, außer manuell mit Warnung.
- Kostenschätzung stimmt mit den hinterlegten Sätzen überein.

---

## 9. Datenmodell: alle Migrationen auf einen Blick

Neue Tabellen:

- `customers`, `customer_imports`
- `staff`, `staff_sessions`, `staff_invites`, `staff_documents`, `staff_availability`
- `staff_roles`, `staff_qualifications`
- `contract_templates`, `contracts`
- `event_staff_requirements`, `staff_assignments`, `staffing_rules`
- `event_documents`
- `vouchers` (eventgebunden)
- `payroll_exports`
- `audit_log`

Erweiterungen:

- `events`: `reservationMode`, `reservationEmail`, `reservationNote`, `reservationDeadline`, `expectedGuests`
- `event_settings`: `pricingMode`, `packages` (erweitert um `unit`, `priceIncludesVat`, `vatRate`, `vatNote`, `voucherCount`, `voucherValueCents`, `voucherTerms`), `slipNote`, `slipFreeAfterMinutes`, `requestLeadDays`
- `settings`: `taxStatus` (`standard` | `small_business`)
- `reservations`: `status` + `requested`/`declined`, `source`, `customerId`, `bookingGroupId`, `groupLabel`, `groupIndex`, `groupSize`, `notes`, `internalNotes`, `packageId`, `packageName`, `priceGrossCents`, `priceNetCents`, `vatCents`, `vatRate`, `agreedPriceCents`, `privacyVersion`, `privacyAcceptedAt`, `confirmedAt`, `confirmedBy`, `slipPrintedAt`, `paymentStatus`
- `staff`: `passwordHash`, `dateOfBirth`, `street`, `zip`, `city`, `taxIdEnc`, `taxClass`, `childAllowances`, `socialSecurityEnc`, `healthInsurance`, `ibanEnc`, `bic`, `employmentType`, `hourlyRateCents`, `monthlySalaryCents`, `entryDate`, `exitDate`, `status`
- `tables`: `section`, `rowLabel`, `displayNumber`, `shape`, `widthM`, `heightM`, `rotation`, `isBlocked`
- `settings.tent_dimensions`: `cellSizeM`, `features[]`

Migrationsstrategie:

- Neue Enum-Werte per `ALTER TYPE ... ADD VALUE` (nicht in derselben Transaktion verwenden, Drizzle-Snapshot prüfen).
- Backfill `reservable` → `reservationMode`.
- Bestehende `tables` bekommen Defaults (`section='Zelt'`, `displayNumber=name`, `widthM/heightM` aus Zellgröße).
- Alle Migrationen auf frischer DB + Bestandsdump testen (`npm run db:migrate`, `test:security`).

---

## 10. Technische Architektur

### 10.1 Routen

Öffentlich:

- `/[locale]/termine/[id]` – Detailseite mit Dokumenten und Anfrage-Card
- `/[locale]/team/*` – Mitarbeiterportal

Admin:

- `/admin` – Dashboard
- `/admin/events/[id]` – Tabs: Bearbeiten, Anfragen, Gäste, Tische, Dokumente, Warteliste, Team
- `/admin/events/[id]/tischplan` – A3
- `/admin/events/[id]/zettel` – Zettel
- `/admin/events/[id]/print` – bestehende A4-Liste
- `/[locale]/admin/kunden`, `/[locale]/admin/kunden/[id]`
- `/[locale]/admin/mitarbeiter`, `/[locale]/admin/mitarbeiter/[id]`, `/[locale]/admin/mitarbeiter/export`
- `/[locale]/admin/rollen`, `/[locale]/admin/vertraege`

### 10.2 Layout-Refactor

Heute umschließt `SiteShell` auch Admin-Seiten mit Navbar/Footer. Für das Team-Portal und einen sauberen Adminbereich:

```
src/app/[locale]/(site)/...      → SiteShell (Navbar/Footer)
src/app/[locale]/(portal)/admin/... → PortalShell (ohne öffentliche Navbar)
src/app/[locale]/(portal)/team/...  → TeamShell
```

Route Groups ändern keine URLs. Der Refactor ist überschaubar, aber regressionsträchtig → eigene Tests, schrittweise migration.

### 10.3 Auth

- Bestehendes Admin-OTP bleibt.
- Team: eigenes Passwort (Argon2id) + Session `staff_token`, optional Magic-Link.
- Einladungs-/Reset-Token: 32 Byte random, nur Hash in der DB, Single-Use, Ablauf.
- Rate Limits für Login, Reset, Einladung.
- Keine Wiederverwendung des Admin-Cookies.

### 10.4 Uploads

- Bilder: bestehende Server Action.
- Dokumente/PDF: eigener Route-Handler mit signiertem Cloudinary-Upload und 15-MB-Cap.
- Vorschau: WebP; PDF-Seiten als Bilder (Cloudinary oder pdfjs).
- Löschen: `deleteCloudinaryAsset` mit korrektem `resource_type`.
- Keine Dateien im Repo, keine Base64-Blobs in der DB.

### 10.5 Druck

- Browser-Druck mit `@page` (A3/A4), `print-color-adjust: exact`, `window.print()`.
- SVG für den Plan, CSS-Grid für Zettel.
- Kein PDF-Zwang; „Als PDF speichern“ über den Browser.
- Später optional serverseitiges PDF (pdf-lib/Playwright) für E-Mail-Versand.

### 10.6 E-Mail

- Gemeinsame HTML-Hülle, Text-Fallback, `replyTo`, Idempotenz-Keys.
- Resend-Domain (SPF/DKIM/DMARC) prüfen; Bounce-Handling später.
- Vorlagen: Anfrage an Wirt, Eingangsbestätigung, Bestätigung, Ablehnung, Einladung, Vertragserinnerung, Schichtvorschlag.

### 10.7 Validierung

- Bestehende handgeschriebene Validatoren weiterverwenden.
- Für die neuen, komplexen Formulare (Import, Personal, Verträge) empfehle ich **Zod** als kleine, typsichere Ergänzung. Alternative: die vorhandenen Policy-Helfer ausbauen. Entscheidung offen.

### 10.8 Wiederverwendbare UI-Primitives

- `Overlay`/`Modal` (Portal, Fokus-Falle, ESC, Scroll-Lock, `role="dialog"`)
- `Button`, `Field`, `Badge`, `Alert` – leichtgewichtig, Tailwind, keine neue UI-Library.
- `DocumentViewer` (Seiten, Zoom, Download).
- `AdminShell` mit Sidebar für die neuen Bereiche.

---

## 11. DSGVO-Mindestmaßnahmen und Recht

Kein Rechtsrat, aber die Leitplanken. Das ist **kein eigener Produktbereich und kein Compliance-Center**, sondern die technische und organisatorische Mindestabsicherung, die beim Speichern von Kunden- und Mitarbeiterdaten ohnehin nötig ist.

### 11.1 Rechtsgrundlagen und Datenminimierung

- Kunden: Art. 6(1)(b) Vertragsanbahnung/-erfüllung; Kontaktdaten nur, was für Reservierung nötig ist.
- Mitarbeiter: Art. 6(1)(b) Arbeitsvertrag, Art. 6(1)(c) steuer-/sozialrechtliche Pflichten.
- Bewerber: Art. 6(1)(b) Bewerbungsverfahren, Löschung nach ca. 6 Monaten.
- Keine Gesundheitsdiagnosen speichern; Gesundheitszeugnis nur als Nachweis mit Ablaufdatum.
- Ausweis: Verify-and-delete, keine dauerhafte Kopie ohne Zwang.
- **Beschäftigungsstatus wird nicht erhoben** (keine „Arbeitslosen“-Checkbox); Auswahl nach Qualifikation, Erfahrung und Verfügbarkeit. Keine ethnische Herkunft, keine Gewerkschaft, keine Religion.

### 11.2 Löschkonzept

| Datum | Frist |
|---|---|
| Nicht bestätigte Anfragen | 30 Tage nach Event oder 90 Tage nach Anfrage |
| Kundenstamm | solange Geschäftsbeziehung + gesetzliche Fristen |
| Bewerber | 6 Monate |
| Einladungs-/Reset-Token | 7 Tage bzw. 1 Stunde |
| Ausweis-Scan | 30 Tage nach Verifikation |
| Gesundheitszeugnis | bis Ablauf + 1 Jahr, danach löschen |
| Personalakte | Beschäftigung + steuerliche Aufbewahrung (6/10 Jahre), danach archivieren/löschen |
| Verfügbarkeiten | Event + 3 Monate |
| DATEV-Exportdatei | nicht dauerhaft speichern; Log/Hash 12 Monate |
| Audit-Log | 12 Monate (oder länger bei sicherheitsrelevanten Vorfällen) |

Cron-Job erweitern (`/api/cron/cleanup`), Stripe-Abhängigkeit optional machen.

### 11.3 Technische und organisatorische Maßnahmen

- TLS überall, HSTS prüfen.
- RBAC + minimale Rechte, eigene Sessions, Cookie `httpOnly`/`secure`/`sameSite`.
- Verschlüsselung sensibler Felder (AES-256-GCM), Schlüssel außerhalb der DB.
- Audit-Log für sensible Aktionen.
- Backups verschlüsselt, Restore getestet.
- AVV mit Neon, Cloudinary, Resend, Hosting; EU-Region wo möglich, sonst SCC/DPF prüfen.
- Verzeichnis von Verarbeitungstätigkeiten ergänzen.
- Datenschutzerklärung erweitern: Kundenverwaltung, Personal, Verträge, Dokumente, Speicherfristen.
- Betroffenenrechte: Export/Löschung im Admin, mit Sperrvermerk bei Aufbewahrungspflichten.

### 11.4 Verträge und Signaturen

- Vorlagen vom Wirt editierbar, aber versioniert und unveränderlich nach Unterschrift.
- Handschriftliche Unterschrift für Minijobs als Scan-Workflow; QES als spätere Option.
- Zeitstempel, IP, User-Agent, Hash, Consent-Version.
- Arbeitszeitgesetz-Warnungen in der Planung (10 h/Tag, 11 h Ruhe, Pausen, Minderjährige).
- AGG: kein Ausschluss von Arbeitslosen; Qualifikation statt Status.

### 11.5 Gedruckte Daten

- A3-Plan: Standard „öffentlich“ ohne Namen; interne Version nur für Service.
- Zettel: Namensmodus pro Event; Option „Verein statt Person“.
- Entsorgung: Zettel/Pläne nach dem Fest datenschutzgerecht entsorgen (Hinweis im Admin).

### 11.6 Beschäftigungsstatus / AGG

Eine Checkbox „Ich bin nicht arbeitslos“ wird **nicht** umgesetzt. Sie ist datenschutzrechtlich nicht erforderlich, hat keinen Beweiswert und kann mittelbar diskriminierend wirken. Die ausführliche Einordnung steht in Abschnitt 8.6. Auswahlkriterien sind Qualifikation, Erfahrung, Verfügbarkeit und Kostenrahmen.

### 11.7 Rechtstexte und Steuern (bewusst schlank)

- **Kein Compliance-Center.** AGB, Datenschutz, Storno und Widerruf bleiben statische Seiten bzw. werden wie bisher gepflegt.
- Die Reservierungsanfrage speichert lediglich `privacyVersion` + `privacyAcceptedAt`, damit die Einwilligung nachvollziehbar ist.
- **Steuerliche Korrektheit** passiert dort, wo sie hingehört: bei der Paketkonfiguration in der Eventerstellung (inkl./exkl. MwSt., Steuersatz, Netto/Brutto/MwSt.-Snapshot). Siehe 2.5.
- Sonderfälle (Gutscheine, ermäßigte Umsatzsteuer, Kleinunternehmer) werden mit dem Steuerberater abgestimmt; das System rechnet nur nach den hinterlegten Werten.

---

## 12. Design-DNA für Print und Portal

- **Farben:** Creme `#F4F0E8`, Grün `#1F5732`, Gold `#cb7913`, Schwarz `#0A0A0A`.
- **Typografie:** Display = Helvetica-Now-Stack, Text = Inter/Roboto. Auf Druck mindestens 8 pt, besser 9–10 pt.
- **Logo:** `public/Logo.png`, auf Grün invertiert; Schutzzone einhalten.
- **Motive:** Zeltbahn-Scallops, grün-weiße Markise, goldene Haarlinie, dezente Papierstruktur.
- **Tonalität:** „Servus“, herzlich, bayerisch, aber nicht kitschig. Keine Stock-Icons als Hauptmotiv.
- **Print:** 100 % Skalierung, keine „An Seite anpassen“-Falle; Farben exakt (`print-color-adjust`), Schnittmarken, großzügige Ränder.
- **Portal:** ruhige, klare Karten, große Touch-Ziele (Admin mobil), Statusfarben konsistent (grün = bestätigt, gold = offen, rot = Problem).

---

## 13. Phasenplan und Aufwand

### Stufe 1 – Saisonstart / Vereinsfeste (ca. 16–23 PT)

1. **Modul A** – Modi, Anfragen, Paket-/Steueroptionen bei der Eventerstellung (nur Online), Badges, Mails (5–7 PT)
2. **Modul B** – A3-Plan inkl. Sektionen/Reihen (4–6 PT)
3. **Modul C** – Zettel 2-/4-up (3–4 PT)
4. **Modul D** – Dokumente + Quick Actions + Modal (4–6 PT, inkl. PDF-Spike)
5. Migrationen, Tests, Doku, Abnahme (in den Schätzungen enthalten)

**Hinweis:** Die Paket-/Steueroptionen werden in Stufe 1 konfigurierbar gemacht, aber nur im Online-Flow verwendet. Da Online vorerst aus ist, sind sie zunächst „vorbereitet“; E-Mail-Reservierungen bleiben ohne Paketlogik.

**Ergebnis:** Der Wirt kann Vereinsfeste ohne Online-Gebühren abwickeln, Pläne und Zettel drucken, Speisekarte/Programm zeigen.

### Stufe 2 – Kunden (ca. 5–7 PT)

6. **Modul E** – Kundenverwaltung, SnapTicket-Import (nur Stammdaten), Mehrfach-Tische, Bestätigungsmails.

### Stufe 3 – Team (ca. 26–37 PT)

7. **Modul F** – Mitarbeiterportal, Onboarding, Dokumente, Verträge (12–16 PT)
8. **Modul G** – Personalplanung, Bedarf, Lücken (8–12 PT)
9. **Modul H** – DATEV-Export Stammdaten (2–3 PT)
10. **Modul I** – DSGVO-/Sicherheits-Härtung, Löschläufe, Audit, Abnahme (4–6 PT)

**Reihenfolge-Empfehlung:** Stufe 1 vor der nächsten Saison. Stufe 2, sobald der Kundenstamm aus SnapTicket vorliegt. Stufe 3 als Pilot mit einem Fest und wenigen Rollen, nicht „big bang“.

**MVP-Alternative:** Nur A + C + ein reduziertes B (ohne Sektionen) + D ohne PDF-Vorschau = ca. 11–15 PT.

---

## 14. Test- und Abnahmekonzept

- **Unit/Integration:** Statusmaschine (`requested/confirmed/declined`), Paket-/MwSt.-Berechnung (brutto/netto, 7/19 %, Kleinunternehmer), Import-Dedupe, Staff-Token, Vertragsversionierung, Bedarfsrechnung, DATEV-Feldvalidierung.
- **Security-Suite erweitern:** bestehende 48 Tests dürfen nicht brechen; neue Fälle für E-Mail-Anfragen, Rechte, Token, Upload-Caps.
- **Browser (Playwright):** Anfrageformular, Modal, Quick Actions, Admin-Anfragen, Zettel/Druck-Smoke (PDF-Größe/Seitenzahl), Team-Onboarding.
- **Manuell:** A3-Druck auf echtem Drucker, Zettel-Schnitt, Farben, Lesbarkeit bei 100 %.
- **DSGVO-Abnahme:** Löschlauf, Export, Rechte-Matrix, Logs, Verschlüsselung.
- **Migration:** frischer DB-Reset + Bestandsdump.

---

## 15. Risiken

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| PDF→WebP ohne verlässliche Pipeline | Dokumente ohne Vorschau | Spike, Cloudinary-Option, Fallback nur Download |
| Tische global statt pro Event | Plan passt nicht zu jedem Fest | Stufe 1 global, später `event_layout_overrides` |
| CSP blockiert PDF-Viewer | Feature unmöglich | Nur Bilder/Canvas, kein iframe |
| Status-Enum-Migration | Bestehende Tests brechen | Additive Migration, Tests erweitern |
| Team-Portal vergrößert Angriffsfläche | Datenleck | Eigenes Auth, RBAC, Verschlüsselung, Pen-Test |
| DATEV-Format unklar | Steuerberater kann Datei nicht importieren | Feldliste und Testimport vorab, CSV-MVP |
| MwSt.-Behandlung falsch | falsche Rechnungen/Preise | Steuersatz pro Paket, Netto/Brutto-Snapshot, Steuerberater abstimmen |
| Vertragsrecht/AGG | rechtliche Probleme | Anwaltliche Prüfung, keine Diskriminierungsfilter |
| A3-Druck browserabhängig | falsche Skalierung | Test auf Chrome/Edge, Druckanleitung |
| Mailzustellung | Anfragen kommen nicht an | Domain-Auth, Monitoring, Fallback im Admin |
| Scope-Menge | Stillstand | Stufenplan, MVP zuerst |

---

## 16. Offene Fragen (bitte im Feedback beantworten)

**Bereits geklärt:**

- **Getränkepaket:** 10 Gutscheine à 12 € = 120 € pro Tisch, **ausschließlich im Online-Reservierungsflow**. Bei E-Mail-Reservierungen gibt es kein Paket und keine automatische Preislogik.
- **Online vorerst aus:** neue Events starten mit `none` oder `email`; der Stripe-Wizard bleibt nur für Bestandsdaten. Die Paket-/Steueroptionen werden vorbereitet, aber nicht aktiv verkauft.
- **Paket-/Steueroptionen** gehören in die Eventerstellung: Preis, Einheit, inkl./exkl. MwSt., Steuersatz, Netto/Brutto/MwSt.-Vorschau.
- **Wirt ist regelbesteuert** (Umsatzsteuer). Getränkegutschein = Einzweckgutschein mit 19 %, MwSt. beim Verkauf; Gutschein ist an genau ein Event gebunden.
- **Kein Compliance-Center.**
- **SnapTicket** = nur Kundenstamm, keine historischen Reservierungen.
- **„Keine Arbeitslosen“** = keine Pflicht-Checkbox; Auswahl nach Qualifikation/Erfahrung/Verfügbarkeit (siehe 8.6).

**Noch offen:**

1. **Speisensteuer:** Welcher Satz gilt für Speisen im Zelt (7 % oder 19 %)? Getränke sind 19 %, der Gutschein ist darauf beschränkt.
2. **Preisdarstellung:** Sollen Gäste im Online-Flow nur Bruttopreise sehen, oder auch netto/MwSt. ausgewiesen bekommen?
3. **Gutscheinbedingungen:** Einlösbarkeit (nur im Zelt? nur am Eventtag?), Übertragbarkeit, Verfall, Barauszahlung, Ersatz bei Verlust? Reicht ein einfaches Textfeld am Paket?
4. **Online-Aktivierung:** Soll der Online-Flow später wieder sichtbar werden, oder bleibt er dauerhaft für neue Events verborgen?
5. **E-Mail-Anfrage:** Strukturiertes Formular mit Anfragen-Postfach (Empfehlung) oder wirklich nur `mailto:`? Soll der Gast eine automatische Eingangsbestätigung bekommen?
6. **Tischplan:** Sind Tische pro Fest unterschiedlich oder global? Brauchen wir „Mittelschiff/Links/Rechts“ und Reihen? A3 quer korrekt?
7. **Zettel:** A6 (4-up) oder A5 (2-up)? Name voll, Initialen oder Verein? QR-Code gewünscht?
8. **Dokumente:** Mehrere Dateien/Seiten pro Event? Dürfen Gäste das PDF herunterladen oder nur die Vorschau sehen?
9. **SnapTicket:** Gibt es einen Beispiel-Export (CSV/XLSX)? Welche Spalten?
10. **Kundenportal:** Interne Verwaltung (Empfehlung) oder Login für Kunden? Wer darf Kunden sehen/exportieren?
11. **Mitarbeiterrollen:** Welche Rollen genau? Sollen Mitarbeiter Schichten selbst bestätigen?
12. **Verträge:** Vorlagen als DOCX/PDF hochladen oder im Browser editieren? Sollen Nicht-Minijobs digital unterschreiben (Textform) oder auch händisch?
13. **Unterschrift Minijob:** Reicht Foto/Scan der unterschriebenen Seite? Wer prüft und markiert „verifiziert“?
14. **DATEV:** Welches Produkt nutzt der Steuerberater (Lohn und Gehalt/LODAS, Unternehmen online, eigene CSV)? Braucht er das echte DATEV-ASCII-Format oder reicht eine validierte CSV? Wer darf exportieren?
15. **DATEV-Felder:** Welche Felder verlangt der Steuerberater zwingend (Steuerklasse, Kinderfreibeträge, Krankenkasse, Staatsangehörigkeit, Konfession)? Bitte dessen Feldliste besorgen.
16. **Aufbewahrung/Zugriff:** Wer darf Personalakten und Bankdaten sehen? Gibt es feste Fristen vom Steuerberater?
17. **Reihenfolge:** Soll Stufe 1 vor der nächsten Saison fertig sein? Gibt es einen harten Termin?
18. **Budget:** Eher MVP (11–15 PT) oder voller Stufe-1-Umfang (16–23 PT)?

---

## 17. Nicht im Scope (bewusst später)

- Gäste-Login / Self-Service-Kundenportal
- Online-Zahlung im E-Mail-Modus (Anzahlung, Rechnung)
- Lohnabrechnung und Zeiterfassung (DATEV-Export ja, Abrechnung nein)
- Native App, WhatsApp-Integration
- Rechts- & Compliance-Center / juristische Textgenerierung (nicht benötigt)
- Digitale Gutschein-Codes / Einlösung am POS (Stufe 1 nur Paketdokumentation)
- Per-Event-Tischlayout mit Drag&Drop-Editor
- Foto-/Video-Uploads für Mitarbeiter
- Mehrsprachiges Team-Portal (erst Deutsch)
- Kunden-Besuchshistorie aus SnapTicket (nur Stammdaten)

---

## 18. Nebenbefunde (kleine Aufräumarbeiten, die im Umfeld auffallen)

- `src/app/[locale]/termine/page.tsx` hat ein Platzhalter-`"XXXX"` im H1.
- Mehrere hartkodierte deutsche Texte auf `/en`-Seiten (Event-Detail, Metadaten).
- `getTables()` und `getBookedTableIds()` sind öffentliche Server Actions ohne Auth.
- `api/cron/cleanup` bricht ohne Stripe komplett ab.
- `reservations.pdfUrl` ist toter Code.
- Admin läuft unter derselben Navbar/Footer-Hülle wie die Website.
- `updateTablePosition` und `saveTentSettings` existieren, werden aber nicht genutzt – gute Andockpunkte für den Plan-Editor.