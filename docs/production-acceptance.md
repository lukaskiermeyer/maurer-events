# Produktionsabnahme Tischreservierungen

**Ergebnis: noch nicht zur Produktion freigegeben.** Prüfung am 6./7. Oktober 2026
gegen `https://maurer-events.madebylui.net` und den lokalen Produktionsbuild.
Die Datenbank wurde vom Betreiber ausdrücklich als ausschließlich Staging/Test
bestätigt. Stripe ausschließlich Testmodus, freigegebener Empfänger
`hello@madebylui.net`, Absender `Maurer Events <noreply@travellui.com>`.

Der frühere Bericht mit 35 behobenen Befunden ist
[reservation-security-audit.md](reservation-security-audit.md). Diese Abnahme
ergänzt reale Provider-, Deployment-, Datenbank- und Browsernachweise. Eine
bestandene Codeprüfung allein ist keine Produktionsfreigabe.

## Nachweise

| Bereich | Ergebnis | Konkreter Nachweis und Grenze |
| --- | --- | --- |
| Produktionsbuild / TypeScript | bestanden | Vollständiger `npm.cmd run build` mit Stripe-Typprüfung, PDF-Umbruch, Wizard-Rückwärtsnavigation und gezielter OTP-Diagnose; Next.js 16.3.8 |
| ESLint | bestanden mit Warnungen | TypeScript, Next.js, React aktiv; 0 Fehler, 145 Warnungen. Breite `any`-Typen und direkte State-Updates in Effekten sind ausdrücklich Warnungen |
| Sicherheitsregressionen | 46/46 bestanden | Isolierte PostgreSQL-Datenbank: Buchungs-/Zahlungsregressionen plus Helfer-OTP, veranstaltungsbezogener Scan, Widerruf, abgelaufene Freigaben/Sitzungen und gelöschte Events |
| Autorisierung | bestanden im geprüften Umfang | Anonyme Seiten geschützt; Helfer werden von Verwaltung/Export umgeleitet. Lokaler Produktionsserver: sechs direkte Verwaltungsaktionen sowie fremdes Event-Check-in durch Auth abgewiesen; nicht öffentlich exportierte Listenaktion HTTP 404. Scanantwort ohne E-Mail/Umsatz; Entwicklungslogin in Produktion deaktiviert |
| Mobiler Admin und Einlass-Team | lokal bestanden, Redeploy ausstehend | 360/390 Pixel mit Gästekarten, Desktop mit Tabelle; Übersicht, Anlegen/Bearbeiten, Einstellungen, Zeltplan und Helferfreigaben ohne horizontales Seiten-Overflow. Freigabe/Widerruf über UI, beide Scanner-Aktionen und Sperre bestehender Sitzung geprüft. Eigene temporäre Testsitzungen, kein Nachweis eines echten Helfer-OTP im Browser |
| OTP-Login | vom Betreiber im echten Browser bestätigt | CAPTCHA, tatsächlicher Mailempfang und erfolgreiche Anmeldung nach Korrektur der Vercel-Konfiguration. DB-Metadaten: aktive Adminsession, kein verbleibender gültiger OTP. Hashing, Ablauf, Versuchslimit und atomarer Einmalverbrauch zusätzlich lokal regressionsgeprüft; Sessionflags nicht in der Betreibersitzung ausgelesen |
| Browser lokal | 8/8 bestanden | Desktop Chromium und Pixel 7, deutscher/englischer Render, Login-Schutz, ungültige API-Aufrufe, aktueller Healthcheck und Sicherheitsheader; Listener und Ziel konsistent `localhost` |
| Browser Staging | 8/8 bestanden im bisherigen Smoke-Umfang | Deutsche/englische Seiten und geschützte Adminrouten bestanden. Später korrigierter Preflight prüft auch den echten Checkout-Origin; neuer Deploy besteht diesen Test |
| 404-Seite | lokal bestanden, Redeploy ausstehend | Homepage-Stil mit Wirt-SVG, DE/EN, Rücklinks. Sieben unbekannte Routen HTTP 404/noindex; 360/390/1280 Pixel, Sprachwechsel, JavaScript-freie Darstellung, Navigation hin/zurück und anonymer Admin-Redirect geprüft. Gemeinsame Seitenhülle in Root-Layout verschoben; Datenschutz-Browserprüfung weiterhin bestanden |
| Buchungswizard | echter Browserabschluss bestätigt | Betreiber durchläuft Einzeltermin ohne Tischwahl, 18:00, Brotzeit, eine Person, echten CAPTCHA und Stripe-Testkarte mit Rückkehr. Zusätzlicher DB-/Providerabgleich: 25,63 EUR `complete/paid`, Buchung `confirmed`, echter Completed-Webhook im Ledger, Ticket ausgestellt und versendet. Vor-/Zurücknavigation zusätzlich lokal und Staging geprüft |
| Native OTP-Datenbankschritte | bestanden mit lokaler Konfiguration | Echter Neon-Anwendungstreiber: Rate-Limit, OTP-Upsert/Wiederholung/Lesen in vollständig zurückgerollter Transaktion. Lokale Admin-Allowlist und AUTH_SECRET gültig; kein Nachweis für Vercels abweichende Runtime-Werte |
| CAPTCHA-Verbindung und Checkout-Origin | neuer Deploy geprüft | Leerer Token wird vor Verifikation abgewiesen, absichtlich ungültiger Token von Cloudflare korrekt zurückgewiesen (`captcha-rejected`); eigene Staging-Domain akzeptiert. Betreiber bestätigt zusätzlich gültiges CAPTCHA mit erfolgreichem OTP-Login |
| Datenbankschema | bestanden | Migrationen 0000–0008 im Staging-Ledger, einschließlich Scanner-Freigaben; erforderliche Felder/Enums/Unique-Indizes; keine doppelten QR-/Wartelistengruppen, keine Überkapazität |
| Sicherung / Wiederherstellung | bestanden für Anwendungstabellen | Konsistenter logischer Snapshot in `.acceptance-backups/`, alle Tabellen lokal restauriert, Zeilenzahlen übereinstimmend; vor Migration 0008 erneut geprüft, 25 Reservierungen erhalten |
| Stripe Checkout | bestanden für Providerpfad | Echter Sandbox-Checkout; identischer Wiederholungsaufruf liefert dieselbe Session; angebotene Zahlungsarten von Stripe akzeptiert. Dieser Provider-Test schließt Anwendungs-CAPTCHA bewusst aus |
| Stripe Kartenzahlung | bestanden | Offizielle Testkarte 4242, 25,63 EUR, Session `complete/paid`, Rückkehr nach Staging, Reservierung `confirmed` |
| Zahlungswebhook | bestanden | Echtes Stripe-Ereignis mit gültiger Signatur dreimal zugestellt, dreimal HTTP 200, genau ein Ledger-Eintrag; weitere drei Zustellungen nach Erstattung belassen `refunded` |
| Ticketversand | bestanden | `ticket_sent_at` gespeichert, Betreiber bestätigt tatsächlichen Mailempfang und öffnungsfähigen PDF-Anhang |
| PDF-Ticket | neues Layout geprüft | Vorhandenes Wirt-SVG als Vektorpfade, Datum/Uhrzeit/Ort, größerer QR mit Ruhezone. Normalfall und maximale Textlängen gerendert; vollständiger Text ohne Überlagerung; beide vollständigen PDFs exakt mit lokalem Decoder gelesen. Vorschau lokal, neues Layout noch nicht als echte Mail nach Deploy abgenommen |
| Check-in | physischer Scan vom Betreiber bestätigt | Betreiber meldet nach Decoder-Deploy erfolgreichen Scan; zugehörige Buchung `checked_in` mit Scanzeit. Zweiter physischer Scan nicht separat bestätigt; doppelte Entwertung durch Dienst-/Browserregressionen abgewiesen |
| QR-Erkennung im Browser | bestanden im geprüften Umfang | CSP-/CDN-Blockade reproduziert und korrigiert; sieben Scanner-Szenarien erneut bestanden. Tatsächliche Decoder-Auslieferung geprüft, Betreiber bestätigt echten Geräte-Scan |
| Rückerstattung | bestanden | Echte vollständige Stripe-Testerstattung `succeeded`, signierter Refund-Webhook HTTP 200, Reservierung `refunded`, QR entfernt, alter Code abgewiesen |
| Alte Test-Holds | bereinigt | Vier unzugeordnete Legacy-Testbuchungen; 54 Stripe-Testsessions durchsucht, keine Zuordnung, Originaldaten gesichert und Einträge storniert. Keine echten Kundendaten betroffen |
| Abhängigkeiten | bestanden | `npm audit --omit=dev`: 0 bekannte Schwachstellen zum Prüfzeitpunkt; keine Garantie gegen unbekannte Lücken |

## Weitere behobene Befunde

| Befund | Korrektur |
| --- | --- |
| Sicherheitslücken in Laufzeitpaketen | Next.js auf 16.3.8, Sharp auf 0.35.5, Quill und source-map-js aktualisiert; Lockfile angepasst |
| React #441 auf Startseite | Serverrenderfehler auf PostgreSQL `42P01` zurückgeführt. Neon-Verbindungen hatten leeren `search_path`; alle ORM-Tabellen und Enum explizit `public` qualifiziert |
| Gepoolter Neon-Endpunkt lehnt Startup-`search_path` ab | Option entfernt; Schemaqualifizierung und Regression mit leerem `search_path` |
| Healthcheck meldet gecachten Erfolg trotz defekter Datenbank | Dynamischer Schema-/DB-Readiness-Check mit `no-store`, Fehlerstatus 503 |
| Root-Redirect kollidiert mit Default-Locale | Redundante Root-Seite entfernt; sauberer Build und Standalone-Smoke-Test |
| Bedingter Hook in Navigation | Hook vor bedingter Admin-Rückgabe; Renderzustand für Nicht-Startseiten abgeleitet |
| Zufälliger Gallery-Skeleton verursacht instabilen Render | Deterministische Skeleton-Höhen |
| Kontaktformular akzeptiert andere CAPTCHA-Aktionen / fingiert Erfolg | Gemeinsame Host-/Aktionsprüfung, geteiltes Rate-Limit, konfigurierbarer Absender/Empfänger, Fehler bei fehlendem Versanddienst |
| Veraltete Absenderkonfiguration | Gemeinsames `EMAIL_FROM` für OTP, Ticket, Warteliste und Kontakt |
| Playwright löscht Datenbanksicherungen | Eigener Browser-Artefaktordner; Sicherungen getrennt und Git-/Docker-ignoriert. Die ursprüngliche Vor-Migrationssicherung wurde dabei verloren; eine zweite konsistente Sicherung wurde erstellt und restauriert |
| TypeScript-Lint wurde vollständig übersprungen | Aktuelle Flat Config; Korrektheitsfehler behoben, verbleibende Migration-Warnungen sichtbar |
| Veraltete Cloudflare-Deploymentanleitung | Vercel-/Node-Betrieb dokumentiert, riskanter `drizzle push`-Produktionspfad entfernt |
| PDF schneidet erlaubte lange Angaben ab und überlagert QR | Text auf eigene Spalte umbrechen, Tickethöhe anpassen; normaler und maximaler Text lokal gerendert und auf Seiten-/QR-Grenzen geprüft |
| Wizard löscht Uhrzeit beim Zurückgehen zu unverändertem Einzeltermin | Automatisches Datum nur bei Änderung setzen; erneute Auswahl desselben Events/Tages behält Folgedaten; vorher auf Staging reproduziert, korrigierter lokaler Build und neuer Deploy geprüft |
| OTP-Fehler ohne zuordenbaren Schritt | Feste, nicht sensitive Diagnose für CAPTCHA, Rate-Limit, Hash, Speicherung und Mailversand; CAPTCHA-Ablehnung, ungültiges Secret und Host-/Aktionsabweichung getrennt |
| CAPTCHA-Diagnose fasst fehlendes Secret und Verbindungs-/URL-/Antwortfehler als `validation:503` zusammen | Getrennte feste Fehlercodes; HTTP-Status und erlaubte Netzwerkcodes ohne Providerobjekte/Secrets. Erweiterte bestehende Regression prüft diese Fehlerfälle |
| Preflight prüft Checkout-Eingaben ohne Browser-Origin | Derselbe Test sendet jetzt den tatsächlichen HTTPS-Origin und erkennt abweichende `NEXT_PUBLIC_BASE_URL`-Konfiguration |
| Detailseite kennt neues Event, separat gecachte Wizard-Liste noch nicht | Bei direkter Testdatenanlage reproduziert: Event fehlt im Wizard und Weiter bleibt gesperrt. Detailseite übergibt jetzt ihr eigenes Event plus die übrigen Listeneinträge, ohne Duplikat. Produktionsserver lokal: Tisch-/Uhrzeit-/Kontakt-Auswahl beim Vor-/Zurückgehen auf Desktop und Pixel 7 erhalten; Staging-Nachweis nach Deploy noch ausstehend |
| Kamerabild sichtbar, QR wird ignoriert | Reproduziert: CSP blockiert Decoder-CDN. Bibliotheks-Decoder lokal ausgeliefert, WASM-Kompilierung erlaubt; Fehleranzeige/Neustart und Scan-Sperre ergänzt. Sieben lokale Kameraszenarien bestanden; Betreiber bestätigt anschließend erfolgreichen physischen Scan |
| Helfer benötigt Zugriff ohne Verwaltung | Veranstaltungsbezogene Scanner-Freigabe mit Mailcode, Ablauf und sofortigem Widerruf. Berechtigung bei jedem Aufruf erneut gelesen und beim Scan bis Commit gesperrt; fremde Tickets unverändert |
| Adminformulare laufen auf kleinen Bildschirmen über | Gästekarten, kleinere Abstände, große Bedienflächen, Datums-/Upload-/Paketfelder auf Mobile untereinander, direkter Einlass und Navigation passend zur Rolle mit Logout; 360/390-Pixel-Browserprüfung bestanden |
| Mobiler Zurück-Pfeil ohne zugänglichen Namen | Zurück-Button beschriftet; Tisch-Wizard auf Pixel 7 vor/zurück bis Kontaktdaten geprüft |

## Freigabeblocker und Abschlusskriterien

Die Datenschutzerklärung ist am 7. Oktober 2026 an die aktuelle Anwendung
angepasst, einschließlich Hosting, Medien, Buchung, Warteliste, Team-Login und
QR-Einlass. Deutsch/Englisch und mobile Darstellung sind lokal geprüft.
Provider-Verträge, tatsächliche Datenregionen und das betriebliche Löschkonzept
sind vom Betreiber noch nicht bestätigt. Die konkreten offenen Angaben stehen
in [privacy-review.md](privacy-review.md); die Textanpassung ist keine Bestätigung
vollständiger Datenschutzfreigabe.

1. **Warteliste und Tischzahlung.** Der echte OTP-Login
   einschließlich CAPTCHA und Code-Mail ist nach erneutem Deploy vom Betreiber
   bestätigt. Die vorherigen CAPTCHA-Verbindungsfehler sind nicht mehr reproduzierbar;
   die genaue ursprüngliche Verbindungsursache bleibt ohne damalige Detaildiagnose
   offen. Checkout akzeptiert die eigene Domain wieder. Der vollständige Gast-Wizard
   ohne Tischwahl bis Testzahlung/Rückkehr ist vom Betreiber bestätigt und durch
   DB-/Providerstatus sowie tatsächlichen Webhook ergänzt. Der Betreiber bestätigt
   inzwischen den physischen Scan; Scanstatus ist in der DB gespeichert. Abschluss:
   Warteliste und echten Zahlungsabschluss mit Tischwahl gezielt prüfen. Neuer
   Scanner-Rollenzugang und PDF-Design sind lokal geprüft; nach Redeploy echte
   Helfer-Code-Mail, Scan und neue Ticketzustellung im Browser ergänzen.
2. **Vertrags- und Stornobedingungen.** `/agb` und `/widerruf` liefern 404;
   Betreiber hat noch keine freigegebenen Texte. Bedingungen für Vertragspartner,
   Leistung/Mindestverzehr, Zahlung, Gäste-Storno und Veranstalter-Absage festlegen
   und für das konkrete Angebot rechtlich prüfen lassen. Eine mögliche Ausnahme
   vom Widerrufsrecht bei termingebundenen Freizeitveranstaltungen ersetzt keine
   Stornoregelung. Ein konkretes Entscheidungsblatt steht in
   [booking-terms-decisions.md](booking-terms-decisions.md); es ist kein freigegebener
   Vertragstext. Keine aus den Code-Defaults erfundenen Vertragsversprechen.
3. **Betrieb nachweisen.** Authentifizierter regelmäßiger Cleanup, Alarmierung
   bei Webhook-/Mail-/DB-Ausfällen, Backup/PITR und Wiederherstellungsplan auf dem
   tatsächlichen Zielsystem. Kein Scheduler im Repository konfiguriert; realer
   geplanter Lauf ist bislang nicht nachgewiesen.
4. **Live-Konfiguration gesondert abnehmen.** Eigene Produktionsdatenbank,
   Liveschlüssel/-webhook, passende verifizierte Absenderdomain und korrektes
   Kontaktpostfach. Staging verwendet Vercel-Environment `Production`, aber
   Stripe-Testmodus. Wechsel zum Livebetrieb erst nach Abschluss dieser Punkte.

## Nicht nachgewiesene Bereiche

Echte zeitverzögerte SEPA-Abrechnung, Klarna-/PayPal-Zahlungsabschluss, 3DS-
Challenge, reale Disputes, Livezahlungen, weitere Kamera-/Browsermodelle, Linux-/Docker-Laufzeit,
Ausfallsimulation des Zielhostings, Lastgrenze des tatsächlichen Vercel-Plans,
providerseitiges PITR und Wiederherstellung von Infrastruktur/Rollen. Asynchrone
Statuswechsel und Fehlerpfade sind lokal regressionsgeprüft; das ersetzt keine
Provider-E2E-Abnahme. Keine pauschale Behauptung vollständiger Fehlerfreiheit.

## Evidenzablage

Git-ignoriert: `test-results/staging-browser-report.json`,
`local-browser-final-report.json`, `lint-report.json`, `production-preflight-final.json`,
`staging-webhook-probe.json`, `staging-ticket-refund.json`, `staging-legacy-release.json`.
Scanner: `test-results/scanner-browser/report.json`, `scanner-deployment-check.json`,
Tisch-Navigation: `test-results/staging-table-navigation.json`.
Neue Rollen-/Mobilprüfung: `test-results/admin-role-browser/report.json`;
PDF-Decoder: `test-results/ticket-decoder-report.json`. Sämtliche temporären
Events, Buchungen, Freigaben und Testsitzungen aus dem Rollenlauf wurden entfernt.
Sensitive Session-/Providerartefakte nicht veröffentlichen. Logische Sicherungen
und Originaldaten der vier stornierten Test-Holds liegen in `.acceptance-backups/`.
Der versandte PDF-Anhang wurde zur Sichtprüfung aus dem eingefrorenen Versandpayload
extrahiert; zusätzliche Layout-Fixtures wurden ausschließlich lokal erzeugt.
`wizard-report.json` und `staging-turnstile-report.json` ergänzen die Browsernachweise.
`staging-captcha-config.json` enthält die sichere Prüfung mit leerem/ungültigem Token.
`staging-auth-session.json` und `staging-wizard-payment.json` bestätigen dazugehörige
Session-/Buchungsmetadaten ohne OTP-/Bearer-/QR-Werte in der Ausgabe.
`not-found-report.json` und `not-found-*-*.png` dokumentieren die lokale 404-Abnahme.
Fehlende Dateien ohne Sprachpräfix können wegen des vorhandenen Streaming-Loaders
HTTP 200 mit `noindex` liefern; auch dort wird die neue Fehlerseite angezeigt.
Alle Zahlungen und Erstattungen erfolgten im Stripe-Testmodus; kein echtes Geld.
