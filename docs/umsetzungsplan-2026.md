# Umsetzungsplan 2026

Stand: 02.11.2026
Bezug: `docs/konzept-2026-erweiterungen.md`

Wir arbeiten **einen Step nach dem anderen** ab. Jeder Step wird implementiert, geprüft und erst dann als erledigt markiert. Kein Step mischt mehrere große Themen.

## Arbeitsregeln

- Ein Step = eine lieferbare, testbare Einheit.
- Vor jedem Step: kurze Zieldefinition + betroffene Dateien.
- Nach jedem Step: `npx tsc --noEmit`, `npm run lint`, passende Tests.
- Datenbankänderungen immer additiv (neue Spalten/Tabellen, keine destruktiven Umbauten).
- Online-Reservierung bleibt vorerst deaktiviert; neue Events nutzen `none` oder `email`.
- Getränkegutscheine nur im Online-Flow; E-Mail-Reservierungen bleiben ohne Paketlogik.
- Gutscheine sind **eventgebunden** (`vouchers.eventId`) und nur bei genau diesem Event einlösbar.

## Testumgebung

```powershell
# Test-Postgres starten (einmal pro Testlauf)
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D '.reservation-test-db' -l '.reservation-test-db/server.log' -o '-p 55439 -h 127.0.0.1' -w start

npm run test:security

# danach stoppen
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D '.reservation-test-db' -w stop
```

Weitere Checks:

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

---

## Step 1 – Datenmodell-Fundament ✅ (02.11.2026)

**Ziel:** Alle späteren Features können auf einem stabilen Schema aufsetzen.

**Umgesetzt:**

- `events.reservationMode` (`none` | `email` | `online`), `reservationEmail`, `reservationNote`, `reservationDeadline`, `expectedGuests`.
- `reservation_status` um `requested` und `declined` erweitert.
- `reservations` um Quelle, Gruppe, Notizen, Paket-/Steuer-Snapshot, manuellen Preis, Datenschutz-Version, Bestätigungs-/Zettel-Zeitpunkte und Zahlungsstatus erweitert.
- `event_settings.pricingMode` (`per_person` | `per_table`) und erweiterte Paketfelder (Einheit, inkl./exkl. MwSt., Steuersatz, Gutschein-Felder).
- `vouchers` als **eventgebundene** Tabelle (`eventId` NOT NULL, FK auf `events`), optional mit Reservierung verknüpft.
- Migration `0009_reservation_modes_vouchers.sql` inkl. Backfill:
  - `reservable = true` → `reservation_mode = 'online'`
  - bestehende Stripe-Reservierungen → `source = 'online'`
- Neue Constraints für Modi, Quellen, Gruppen, Preise, MwSt.-Sätze und Gutscheinstatus.
- `VoucherRecord` in `src/types/domain.ts`.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run test:security` → **49/49** ✅ (inkl. neuer Test für Modi, `requested` und Eventbindung)

**Done:** Schema und Migration sind stabil; bestehende Online-Flows unverändert grün.

**Nicht in diesem Step:** UI, Formulare, Mails, Druckansichten.

---

## Step 2 – Reservierungsmodi und Badges ✅ (02.11.2026)

**Ziel:** Der Wirt kann pro Event `keine`, `per E-Mail` oder `online` wählen; die Website zeigt das korrekt.

**Umgesetzt:**

- Zentrale Logik in `src/lib/reservation-mode.ts`:
  - `resolveReservationMode` (mit Legacy-Fallback auf `reservable`)
  - `reservationBadge`, `reservationStatusLabel`
  - `reservationMailto` (vorausgefüllte E-Mail)
- Admin-Eventerstellung: Modus `none`/`email`; `online` ist für neue Events gesperrt. E-Mail-Adresse und Hinweistext konfigurierbar.
- Admin-Eventbearbeitung: Moduswechsel inkl. `online` nur für bestehende Online-Events; E-Mail-Felder.
- Landingpage, `/termine` und Event-Detailseite nutzen die zentrale Badge-/Statuslogik.
- Event-Detailseite:
  - `online` → bestehender Wizard
  - `email` → `EmailReservationCard` mit `mailto:`-Link
  - `none` → kein CTA, Status „Freie Platzwahl“
- Admin-Liste zeigt den Modus als Badge; Statistik zählt nur noch Online-Events.
- Nebenbei: `"XXXX"`-Platzhalter in `/termine` durch „Unsere“ ersetzt.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **51/51** ✅ (inkl. Badge-/Mailto- und Policy-Tests)

**Done:** Modus ist im Admin setzbar und öffentlich sichtbar; keine Reservierung ohne Modus.

**Nicht in diesem Step:** Anfrageformular, Mails, Tischvergabe.

---

## Step 3 – E-Mail-Reservierungsanfragen ✅ (02.11.2026)

**Ziel:** Vereine können Tische per Formular anfragen; der Wirt bearbeitet sie im Admin.

**Umgesetzt:**

- `EmailReservationCard` ist jetzt ein Client-Formular mit Modal, Turnstile, Datenschutz-Checkbox und `mailto:`-Fallback.
- Formular: Name, E-Mail, Telefon, Verein, Datum, Uhrzeitwunsch, Personen, Tischanzahl, Nachricht.
- Server Action `submitReservationRequest`:
  - Validierung, Turnstile (`reservation-request`), Rate Limit 5/15 min
  - Event muss `reservationMode = email` haben; Deadline und Buchungstag werden geprüft
  - speichert `status = requested`, `source = email`, `groupLabel`, `groupSize`, `notes`, `privacyVersion`, `privacyAcceptedAt`
  - idempotent über `idempotencyKey` (Doppelklick/Retry erzeugt keine zweite Anfrage)
- Admin-Tab **„Anfragen“** mit Zähler:
  - Karten mit Datum, Personen, Tischen, Uhrzeit, Nachricht, Kontakt
  - Tischzuweisung + optionaler Preis pro Tisch
  - „Bestätigen & Mail senden“ → `confirmed`, `confirmedAt/By`, `agreedPriceCents`
  - „Ablehnen“ → `declined`, Grund in `internalNotes`
- E-Mail-Vorlagen (`src/lib/reservation-request-email.ts`):
  - Anfrage an den Wirt (`replyTo` Gast)
  - Eingangsbestätigung an den Gast
  - Bestätigung mit Tisch/Preis/Details
  - Ablehnung mit optionalem Grund
  - Idempotenz-Keys pro Empfänger/Vorgang
- Statusmaschine: `requested → confirmed | declined | cancelled`; `requested` belegt keine Kapazität.
- Neue Spalte `reservations.phone` (Migration `0010_reservation_request_phone.sql`).

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **52/52** ✅
  - inkl. Bestätigen/Ablehnen ohne Kapazitätsbelegung
  - Eventbindung, Statuswechsel, Policy
- **Offen:** echter Mailversand mit Resend und Turnstile im Browser (benötigt gültige Keys); im lokalen Test wird nur die Datenlogik geprüft.

**Done:** Anfrage → Admin → Bestätigung/Ablehnung funktioniert; Mailversand ist implementiert und muss mit echten Provider-Keys einmal manuell abgenommen werden.

**Nicht in diesem Step:** Kundenstamm, SnapTicket, Mehrfach-Tische über `groupSize` hinaus, PDF-Bestätigung/QR.

---

## Step 4 – Paket- und Steueroptionen (nur Online) ✅ (02.11.2026)

**Ziel:** Der Wirt kann Pakete inkl./exkl. MwSt. konfigurieren und sieht Netto/Brutto/MwSt. korrekt.

**Umgesetzt:**

- Globaler **Steuerstatus** in den Event-Einstellungen:
  - `standard` (regelbesteuert, Wirt) oder `small_business` (§ 19 UStG)
  - gespeichert in `settings.tax_status`, gilt global
- Paket-Editor pro Event:
  - Name, Beschreibung, Preis, Einheit (`per_person`/`per_table`)
  - Typ (`food_package`/`voucher_bundle`/`other`)
  - `priceIncludesVat` (inkl./exkl. MwSt.), `vatRate` (0/7/19), `vatNote`
  - Gutschein-Felder: Anzahl, Wert je Gutschein, Bedingungen
  - aktiv/inaktiv, „Beliebt“
- Preishelfer `src/lib/pricing.ts`:
  - `packageTax()` berechnet brutto/netto/MwSt. für 7 %/19 %, inkl./exkl. und Kleinunternehmer
  - `formatEuroCents()` für die Vorschau
- Live-Vorschau pro Paket: „Steuer: 120,00 € brutto · 100,84 € netto · 19,16 € MwSt. (19 %)“
- Validierung:
  - Gutscheinpakete müssen `per_table` sein und Anzahl/Wert enthalten
  - MwSt.-Satz nur 0/7/19, keine negativen Preise, max. 20 Pakete
- Vorlagen (`package_presets`) übernehmen die neuen Felder.
- E-Mail-Modus bleibt ohne Paketlogik; öffentlicher Online-Checkout bleibt unverändert.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **53/53** ✅
  - 120 € inkl. 19 % → 100,84 € netto / 19,16 € MwSt.
  - 120 € netto + 19 % → 142,80 € brutto
  - 107 € inkl. 7 % → 100,00 € netto / 7,00 € MwSt.
  - Kleinunternehmer → keine MwSt.
  - Gutscheinpaket-Validierung

**Done:** Paketkonfiguration und steuerliche Vorschau funktionieren; noch kein Verkauf, da Online aus ist.

**Nicht in diesem Step:** Gutscheinausgabe/-einlösung, Preis-Snapshot auf Reservierungen, Online-Checkout mit `per_table`.

---

## Step 5 – Eventgebundene Gutscheine ✅ (02.11.2026)

**Ziel:** Ein Gutschein gilt nur für genau ein Event und kann nicht bei einem anderen Fest eingelöst werden.

**Umgesetzt:**

- Checkout speichert jetzt `packageId`, `packageName`, `source = online` und den MwSt.-Snapshot (`priceGrossCents`, `priceNetCents`, `vatCents`, `vatRate`).
- `per_table`-Pakete werden im Checkout korrekt **einmal pro Tisch** berechnet, nicht pro Person.
- Neue Tabelle `vouchers` wird genutzt:
  - `eventId` ist Pflicht
  - `code` ist eindeutig (`ME-XXXXXXXXXX`)
  - Status `issued` / `redeemed` / `void`
- Automatische Ausgabe:
  - nur bei `source = online` und `status = confirmed`
  - nur wenn das Paket `type = voucher_bundle` ist
  - 10 Gutscheine à 12 € pro Tisch, idempotent (kein doppelter Satz bei erneuter Bestätigung)
- Einlösung:
  - `redeemVoucher(code, eventId)` prüft Eventbindung
  - falsches Event → „gehört zu einem anderen Event“
  - doppelte Einlösung → blockiert
  - `void` → blockiert
- Storno/Refund:
  - Admin-Storno entwertet offene Gutscheine (`issued → void`)
  - Stripe-Webhook entwertet bei `refunded`/`cancelled`/`disputed`/`payment_review`
  - bereits eingelöste Gutscheine bleiben `redeemed`
- Admin-Seite `/admin/events/[id]/gutscheine`:
  - Übersicht (gesamt/offen/eingelöst/ungültig)
  - Code einlösen
  - Karten mit Wert, Code, Event, „Nur am … gültig“
  - Drucken / Als PDF speichern über den Browser (A4)
- E-Mail-Reservierungen erhalten **keine** Gutscheine.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **55/55** ✅
  - 120 € pro Tisch inkl. 19 % → 100,84 € netto / 19,16 € MwSt.; Gesamt 122,05 € inkl. Gebühr
  - 10 Gutscheine pro Tisch
  - Gutschein aus Event A kann nicht bei Event B eingelöst werden
  - doppelte Einlösung blockiert
  - erneute Bestätigung erzeugt keine Duplikate
  - Storno entwertet offene Gutscheine

**Done:** Gutscheine sind eventgebunden, werden automatisch bei Online-Bestätigung erzeugt, sind im Admin einlösbar und druckbar. Online-Verkauf bleibt bis zur Aktivierung aus.

**Nicht in diesem Step:** POS-Integration, digitale Wallet, QR-Code auf dem Gutschein, automatischer PDF-Versand per E-Mail.

---

## Step 6 – A3-Tischplan ✅ (02.11.2026)

**Ziel:** Ein belegter/leerer Tischplan als A3-Druck.

**Umgesetzt:**

- `tables` erweitert: `section`, `rowLabel`, `displayNumber`, `shape`, `widthM`, `heightM`, `rotation`, `isBlocked` (Migration `0011_table_plan_metadata.sql`).
- Layout-Generator setzt automatisch:
  - Sektion (`Links` / `Mittelschiff` / `Rechts`)
  - Reihe (`R1`, `R2`, …)
  - Tischnummer (`T001`, `T002`, …)
- `tent_dimensions` unterstützt `cellSizeM` und Marker (`stage`, `bar`, `entrance`, `blocked`).
- Neue Route `/admin/events/[id]/tischplan`:
  - A3 quer, SVG-Plan
  - interne Version mit Namen/Verein/Personen/Uhrzeit
  - öffentliche Version ohne Namen
  - Datumsauswahl, Legende, Maßstab, Stand-Uhrzeit
  - Zeltmarker (Bühne/Theke/Eingang), falls hinterlegt
  - Drucken / Als PDF speichern über den Browser
- Fallback für alte Tische: `displayNumber || name`, `section || "Zelt"`, `rowLabel || positionY + 1`.
- `updateTableMeta`-Action für spätere manuelle Pflege vorhanden.
- Link „Tischplan“ im Event-Header.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **56/56** ✅
  - Plan rendert Tischnummer, Sektion und interne Namen
  - öffentliche Version zeigt „reserviert“ statt Namen
- **Manuell offen:** echter A3-Druck auf dem Drucker (100 %-Skalierung, Farben, Lesbarkeit bei ≥ 100 Tischen).

**Done:** A3-Plan ist im Browser druckbar, intern/öffentlich umschaltbar und nutzt die echten Tischzuweisungen.

**Nicht in diesem Step:** Drag&Drop-Editor für Tischpositionen, automatische PDF-Erzeugung serverseitig.

---

## Step 7 – Reservierungszettel ✅ (02.11.2026)

**Ziel:** Tischschilder im Maurer-Events-Look drucken.

**Umgesetzt:**

- Neue Route `/admin/events/[id]/zettel`.
- Formate:
  - **A6 · 4 pro A4** (2 × 2)
  - **A5 · 2 pro A4** (1 × 2)
- Inhalt pro Zettel:
  - Logo + „Reserviert“
  - editierbarer Hinweis (`slipNote`)
  - ID, Sektion, Reihe, Tischnummer
  - Name/Verein je nach Modus
  - Datum, Personen, Uhrzeit, Eventtitel
- Namensmodi:
  - `full` (voller Name)
  - `initial` (Vorname + Nachname-Initial)
  - `club` (Verein/Firma, sonst Name)
- Filter:
  - Datum
  - nur `paid`/`confirmed` mit Tisch
  - „Alle“ oder „Nur neue“ über `slipPrintedAt`
- Sortierung nach Sektion → Reihe → Tischnummer.
- „Als gedruckt markieren“ setzt `slipPrintedAt` für die aktuelle Auswahl.
- Event-Einstellungen: Zettel-Hinweis und „Tisch freihalten ab X Minuten“ editierbar.
- Migration `0012_slip_settings.sql`.
- Link „Zettel“ im Event-Header.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **57/57** ✅
  - voller Name, Initialen und Verein
  - Tischnummer/Sektion im Zettel
  - Slip-Einstellungen validiert
- **Manuell offen:** echter A4-Druck, Schnittkanten und Lesbarkeit auf 100 % prüfen.

**Done:** Zettel sind pro Datum druckbar, im Maurer-Events-Look und respektieren den Namensmodus.

**Nicht in diesem Step:** Etikettendrucker-Integration, QR-Code auf dem Zettel, automatischer PDF-Versand.

---

## Step 8 – Event-Dokumente und Quick Actions ✅ (02.11.2026)

**Ziel:** Speisekarte/Programm hochladen und auf Landingpage/Detailseite in einem Layer zeigen.

**Umgesetzt:**

- Neue Tabelle `event_documents` (Migration `0013_event_documents.sql`):
  - Art `menu`/`program`, Titel, Datei, Vorschau, MIME-Typ, Größe
  - `isPublic`, Sortierung, Ersteller
- Upload-Route `/api/admin/documents`:
  - nur Admin
  - PDF/JPG/PNG/WebP, max. 15 MB
  - signierter Cloudinary-Upload
  - Bilder werden vorher per Sharp zu WebP optimiert
  - PDFs werden als Bild hochgeladen; Vorschau über Cloudinary-Transformation (`pg_1,f_webp,w_1600`)
  - Fallback: Wenn die PDF-Vorschau nicht möglich ist, wird das PDF als Raw-Datei gespeichert und ohne Vorschau angezeigt
- Admin-Tab **„Dokumente“**:
  - Upload mit Art, Titel, öffentlich/privat
  - Vorschau, Datei öffnen, löschen
- Öffentlich:
  - Event-Detailseite: „Speisekarte“- und „Programm“-Buttons
  - Landingpage: Quick-Action-Pills auf den Event-Karten
  - gemeinsamer Viewer-Layer mit Bildvorschau, Navigation, „Datei öffnen“
  - kein PDF-iframe, daher CSP-konform
- Karten bleiben als Ganzes klickbar; die Pills öffnen nur den Viewer.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **58/58** ✅
  - öffentliche Dokumente rendern Speisekarte/Programm-Buttons
  - bestehende Tests unverändert
- **Manuell offen:** echter Cloudinary-Upload, PDF-Vorschau und Kartenklick im Browser.

**Done:** Dokumente sind im Admin hochladbar und öffentlich im Layer nutzbar.

**Nicht in diesem Step:** Mehrsprachige Dokumentversionen, serverseitiges PDF-Rendering ohne Cloudinary, automatische Löschung der Cloudinary-Originale.

---

## Step 9 – Kundenverwaltung und SnapTicket-Import ✅ (02.11.2026)

**Ziel:** Kundenstamm importieren, Tische zuweisen, Bestätigungen senden.

**Umgesetzt:**

- Neue Tabellen `customers` + `customer_imports` (Migration `0014_customers.sql`).
- `customers`:
  - Name, Verein/Firma, E-Mail (optional, unique lower), Telefon, Adresse, Notizen
  - Quelle `manual`/`request`/`snapticket`
  - externe Referenz (SnapTicket) + Soft-Delete
- CSV-Import:
  - Semikolon oder Komma, Quotes/BOM
  - automatisches Spalten-Mapping + manuelle Korrektur
  - Vorschau der ersten 5 Zeilen
  - Dedupe: externe ID → E-Mail → Telefon + normalisierter Name
  - Upsert: neue Kunden anlegen, bestehende aktualisieren
  - Report: neu / aktualisiert / übersprungen / Fehlerzeilen
  - `customer_imports` protokolliert Akteur und Ergebnis
- Admin:
  - `/admin/kunden` mit Suche, Liste, „+ Kunde“
  - `/admin/kunden/[id]` mit Stammdaten, Bearbeitung, Löschen und Reservierungshistorie
  - „Kunden“-Link im Admin-Header
- Reservierung ↔ Kunde:
  - Beim Bestätigen einer E-Mail-Anfrage wird ein Kunde per E-Mail/Telefon+Name gesucht oder angelegt
  - Die Reservierung wird mit `customerId` verknüpft
- Mehrfach-Tische bleiben über `bookingGroupId`/`groupSize` vorbereitet; die Gruppierungs-UI kommt später.
- Nur Stammdaten, keine alten Reservierungen/Umsätze importiert.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **60/60** ✅
  - CSV-Parser mit Semikolon, Quotes und leerer E-Mail
  - E-Mail-/Telefon-Normalisierung
  - Kunde wird beim Bestätigen einmal angelegt und wiederverwendet
  - Reservierung wird korrekt verknüpft
- **Manuell offen:** echter SnapTicket-Export, großer Import und Browser-Durchlauf.

**Done:** Kundenstamm, Import und Verknüpfung zu Reservierungen funktionieren.

**Nicht in diesem Step:** Gäste-Login, Besuchshistorie aus SnapTicket, Mehrfach-Tisch-Gruppierungs-UI, PDF-Bestätigung.

---

## Step 10 – Mitarbeiterportal, Onboarding und Verträge ✅ (02.11.2026)

**Ziel:** Mitarbeiter einladen, onboarden, Dokumente hochladen, Vertrag unterschreiben.

**Umgesetzt:**

- Neue Tabellen (Migration `0015_staff_portal.sql`):
  - `staff_roles`, `staff`, `staff_invites`, `staff_sessions`, `staff_documents`
  - `contract_templates`, `contracts`, `audit_log`
- Eigene Mitarbeiter-Auth:
  - Passwort-Hashing mit `scrypt` (kein Klartext)
  - eigenes Cookie `staff_token`, eigene `staff_sessions`
  - Einladungslink mit 32-Byte-Token, nur Hash in der DB, 7 Tage gültig, atomar einmalig
- Admin:
  - `/admin/mitarbeiter` mit Teamliste, Einladung, Rollen und Vertragsvorlagen
  - `/admin/mitarbeiter/[id]` mit Stammdaten, Status, Dokumentenprüfung und Vertragsprüfung
  - „Mitarbeiter“-Link im Admin-Header
- Mitarbeiterportal:
  - `/team/login`, `/team/einladung`, `/team`, `/team/onboarding`, `/team/vertrag`
  - eigenes Layout ohne öffentliche Navbar/Footer
- Onboarding:
  - persönliche Daten, Adresse, Beschäftigungsart, Lohn-/Steuerdaten
  - Steuer-ID, Sozialversicherungsnummer und IBAN werden mit AES-256-GCM verschlüsselt (`STAFF_DATA_KEY`)
  - Dokument-Upload (Ausweis, Gesundheitszeugnis, Steuerkarte, Minijob, Sonstiges)
- Verträge:
  - Vorlagen pro Rolle, versioniert, Status `draft`/`reviewed`/`active`
  - gerenderte Fassung wird beim Anlegen eingefroren (`contracts.bodyHtml`)
  - digitale Bestätigung mit vollständigem Namen + Hash/Zeitstempel/IP/User-Agent
  - handschriftlicher Weg: Vertrag drucken, unterschreiben, Scan/Foto hochladen
  - Admin kann Unterschrift verifizieren
  - Vertragsänderung erzeugt eine neue Version, alte Verträge bleiben unverändert
- Dokumente liegen mit zufälligen IDs in Cloudinary (`maurer-events/staff`); private Delivery ist noch Härtungsthema.
- `STAFF_DATA_KEY` in `.env.example` ergänzt (Fallback auf `AUTH_SECRET` nur in Entwicklung).

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **63/63** ✅
  - scrypt-Passwort Hash/Verify
  - Einladungs-Token-Hashing
  - AES-256-GCM Roundtrip und Maskierung
  - Vertrags-Rendering mit Variablen und unveränderlicher Snapshot
- **Manuell offen:** kompletter Einladung→Onboarding→Vertrag→Admin-Freigabe-Durchlauf, echter Resend-Versand und Dokument-Upload.

**Done:** Auth, Einladungen, Onboarding, verschlüsselte Personaldaten und Vertragsunterschrift sind implementiert.

**Nicht in diesem Step:** Personalplanung/Verfügbarkeit (Step 11), DATEV-Export (Step 12), private/signed Dokumenten-Delivery, Lohnabrechnung, Zeiterfassung.

---

## Step 11 – Personalplanung ✅ (02.11.2026)

**Ziel:** Bedarf, Verfügbarkeit, Lücken und Kostenschätzung sichtbar machen.

**Umgesetzt:**

- Neue Tabellen (Migration `0016_staffing.sql`):
  - `staffing_rules`, `staff_availability`, `event_staff_requirements`, `staff_assignments`
- Admin `/admin/events/[id]/personal`:
  - Personalschlüssel pro Rolle (Gäste/Person, Min./Fixbesetzung, Max.-Stunden, Ruhezeit, Mindestalter)
  - Personalbedarf pro Datum/Schicht/Rolle anlegen und löschen
  - automatische Zuweisung pro Datum
  - Abdeckung, Zuweisungen, fehlende Personen und Kostenschätzung
  - Lücken- und Warnungsliste
  - Einteilung bestätigen oder löschen
- Team:
  - `/team/verfuegbarkeit`: Verfügbarkeit pro Fest/Datum/Schicht eintragen
  - `/team/schichten`: vorgeschlagene Schichten annehmen oder ablehnen
- Planungslogik `src/lib/staffing.ts`:
  - Bedarf: `max(minStaff, ceil(guests / guestsPerStaff)) + fixedStaff`
  - Filter: Rolle, Status, Verfügbarkeit, Mindestalter, Tagesstunden, Ruhezeit, Überschneidung
  - Greedy-Zuweisung, Fairness nach bisherigen Einsätzen, bevorzugte Zeiten zuerst
  - Kosten aus Stundensatz × Schichtstunden
- `autoAssign` ersetzt nur offene automatische Vorschläge, nicht bestätigte oder manuelle Einteilungen.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **64/64** ✅
  - Bedarfsformel
  - keine Zuweisung ohne Verfügbarkeit
  - keine Zuweisung Minderjähriger
  - Lückenberechnung und Abdeckung
  - Kostenschätzung
- **Manuell offen:** kompletter Admin-/Team-Durchlauf mit echten Verfügbarkeiten und Schichten.

**Done:** Der Wirt sieht pro Fest, wer kann, wer eingeplant ist und wo Personal fehlt.

**Nicht in diesem Step:** `.ics`-Export, Pausenregelung im Detail, Minijob-Monatslimit, Drag&Drop-Umplanung, automatische Lohnabrechnung.

---

## Step 12 – DATEV-Export und Härtung ✅ (02.11.2026)

**Ziel:** Lohn-Stammdaten exportieren und das Gesamtsystem abnehmen.

**Umgesetzt:**

- Neue Tabelle `payroll_exports` (Migration `0017_payroll_exports.sql`):
  - Akteur, Zeitraum, Zeilenzahl, Datei-Hash
  - gehashter Einmal-Token, Ablauf, Verwendung
- DATEV-Seite `/admin/mitarbeiter/export`:
  - Pflichtfeld-Prüfung pro Mitarbeiter
  - blockiert Export bei fehlenden Steuer-/Sozial-/Bankdaten
  - generisches CSV-Profil (Semikolon, UTF-8 BOM, deutsche Spalten)
  - Entschlüsselung von Steuer-ID, SV-Nummer und IBAN nur für den Export
  - Einmal-Download-Link, 15 Minuten gültig
  - Audit bei Erstellung und Download
- Download-Route `/api/admin/payroll-export`:
  - nur Admin
  - Token nur einmal verwendbar
  - `Cache-Control: no-store`
- Retention-Cleanup (`src/lib/retention.ts`):
  - abgelaufene Einladungen und Sessions
  - alte `payroll_exports`, `customer_imports`, `audit_log`
- Cleanup-Cron läuft jetzt auch **ohne Stripe**; Stripe-Abgleich wird nur ausgeführt, wenn ein Key gesetzt ist.
- DATEV-Hinweis in `.env.example`/Doku: Steuerberater muss Feldliste und Importformat bestätigen.

**Tests:**

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:security` → **66/66** ✅
  - CSV-Header, entschlüsselte Werte, Dezimalformat
  - CSV-Escaping
  - Pflichtfeld-Erkennung
  - Retention-Cleanup für Invites/Sessions/Audit
- **Manuell offen:** Testimport beim Steuerberater, kompletter `test:acceptance`-Lauf, echter Einmal-Download im Browser.

**Done:** Export, Einmal-Link, Audit und Retention-Cleanup sind implementiert.

**Wichtig:** Der Download ist ein **Einmal-Link über HTTPS**, keine verschlüsselte ZIP-Datei. Das CSV enthält Klartext-Personaldaten und darf nur über den Einmal-Link bezogen werden. Für den produktiven DATEV-Import muss das genaue Format (DATEV-ASCII/LODAS oder CSV) mit dem Steuerberater abgestimmt werden.

**Nicht in diesem Step:** Lohnabrechnung, Zeiterfassung, zertifizierte DATEV-Schnittstelle.

---

## Aktueller Stand

| Step | Status |
|---|---|
| 1 – Datenmodell-Fundament | ✅ erledigt |
| 2 – Reservierungsmodi & Badges | ✅ erledigt |
| 3 – E-Mail-Anfragen | ✅ erledigt |
| 4 – Paket-/Steueroptionen | ✅ erledigt |
| 5 – Eventgebundene Gutscheine | ✅ erledigt |
| 6 – A3-Tischplan | ✅ erledigt |
| 7 – Reservierungszettel | ✅ erledigt |
| 8 – Event-Dokumente | ✅ erledigt |
| 9 – Kunden & SnapTicket | ✅ erledigt |
| 10 – Mitarbeiterportal | ✅ erledigt |
| 11 – Personalplanung | ✅ erledigt |
| 12 – DATEV & Härtung | ✅ erledigt |

Alle geplanten Steps sind umgesetzt. Offen sind die manuellen Abnahmen (echter Druck, Cloudinary-Upload, Resend-Versand, Steuerberater-Testimport, kompletter Browser-Durchlauf).