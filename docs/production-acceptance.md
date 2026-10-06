# Produktionsabnahme Tischreservierungen

**Ergebnis: noch nicht zur Produktion freigegeben.** Prüfung am 6. Oktober 2026
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
| ESLint | bestanden mit Warnungen | TypeScript, Next.js, React aktiv; 0 Fehler, 147 Warnungen. Breite `any`-Typen und direkte State-Updates in Effekten sind ausdrücklich Warnungen |
| Sicherheitsregressionen | 44/44 bestanden | Isolierte PostgreSQL-Datenbank: 50 parallele Buchungen für acht Plätze ergeben acht Holds; Volltischbuchungen genau einen Gewinner; 20 Wiederholungen erzeugen eine Buchung/Session |
| Autorisierung | bestanden im geprüften Umfang | Admin, Eventdashboard und beide Scanner leiten anonym zum Login; Mutation-Services durch Server-Auth geschützt; Entwicklungslogin in Produktion deaktiviert |
| OTP-Codeverarbeitung | lokale Regression bestanden | Gehashte Codes, Ablauf, Versuchslimit und atomarer Einmalverbrauch; reale Browseranmeldung steht noch aus |
| Browser lokal | 8/8 bestanden | Desktop Chromium und Pixel 7, deutscher/englischer Render, Login-Schutz, ungültige API-Aufrufe, aktueller Healthcheck und Sicherheitsheader; Listener und Ziel konsistent `localhost` |
| Browser Staging | 8/8 bestanden | Nach Rücknahme der fehlerhaften Proxy-Änderung bestehen deutsche/englische Seiten und geschützte Adminrouten; Preflight vollständig bestanden |
| Buchungswizard | Navigation lokal und Staging geprüft | Vorwärts bis Kontakt/Zahlung sowie zurück zu Event/Datum und wieder vorwärts; Datum, Uhrzeit, Paket und Kontaktdaten erhalten; echte CAPTCHA-Übermittlung/Zahlung über diesen Pfad noch offen |
| Native OTP-Datenbankschritte | bestanden mit lokaler Konfiguration | Echter Neon-Anwendungstreiber: Rate-Limit, OTP-Upsert/Wiederholung/Lesen in vollständig zurückgerollter Transaktion. Lokale Admin-Allowlist und AUTH_SECRET gültig; kein Nachweis für Vercels abweichende Runtime-Werte |
| Datenbankschema | bestanden | Migrationen 0000–0007 im Ledger, erforderliche Felder/Enums/Unique-Indizes; keine doppelten QR-/Wartelistengruppen, keine Überkapazität |
| Sicherung / Wiederherstellung | bestanden für Anwendungstabellen | Konsistenter logischer Snapshot in `.acceptance-backups/`, alle Tabellen lokal restauriert, Zeilenzahlen übereinstimmend, 23 Reservierungen beim zweiten Sicherungslauf erhalten |
| Stripe Checkout | bestanden für Providerpfad | Echter Sandbox-Checkout; identischer Wiederholungsaufruf liefert dieselbe Session; angebotene Zahlungsarten von Stripe akzeptiert. Dieser Provider-Test schließt Anwendungs-CAPTCHA bewusst aus |
| Stripe Kartenzahlung | bestanden | Offizielle Testkarte 4242, 25,63 EUR, Session `complete/paid`, Rückkehr nach Staging, Reservierung `confirmed` |
| Zahlungswebhook | bestanden | Echtes Stripe-Ereignis mit gültiger Signatur dreimal zugestellt, dreimal HTTP 200, genau ein Ledger-Eintrag; weitere drei Zustellungen nach Erstattung belassen `refunded` |
| Ticketversand | bestanden | `ticket_sent_at` gespeichert, Betreiber bestätigt tatsächlichen Mailempfang und öffnungsfähigen PDF-Anhang |
| PDF-Ticket | Layoutfehler behoben und geprüft | Normalfall sowie 300 Zeichen Veranstaltungstitel und je 100 Zeichen Gast-/Tischname gerendert; vollständiger Text, klare QR-Fläche, kein Abschneiden. Tickethöhe wächst bei langen Angaben |
| Check-in | Dienstprüfung bestanden | Gegen die echte Staging-Buchung einmal angenommen, zweiter Scan abgewiesen; authentifizierte Scanner-UI und physische Kamera noch offen |
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

## Freigabeblocker und Abschlusskriterien

1. **Echter OTP-Login und Buchungswizard mit Turnstile.** Der alte Testschlüssel
   lieferte `example.com` ohne Aktion und wurde korrekt abgewiesen. Ein echtes
   Widget wurde anschließend eingerichtet. Im normalen Browser bestätigt der
   Betreiber erfolgreiches CAPTCHA, danach jedoch weiterhin „Anmeldecode konnte
   nicht angefordert werden“. Automatisierter Chromium-Browser erhält keinen Token.
   Der öffentliche Buildschlüssel stimmt mit `.env.local` überein; das beweist nicht
   die richtige Secret-Konfiguration zur Laufzeit. Neuer Deploy enthält gezielte
   OTP-Diagnose; dessen Fehlerzeile steht noch aus. Abschluss: OTP-Mail, Einmalcode, sichere Session,
   Adminnavigation, vollständiger Gast-Wizard bis Testzahlung, Warteliste und
   authentifizierter Scan. Kein CAPTCHA-Bypass zur Erteilung der Freigabe.
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
Challenge, reale Disputes, Livezahlungen, physische Kamera, Linux-/Docker-Laufzeit,
Ausfallsimulation des Zielhostings, Lastgrenze des tatsächlichen Vercel-Plans,
providerseitiges PITR und Wiederherstellung von Infrastruktur/Rollen. Asynchrone
Statuswechsel und Fehlerpfade sind lokal regressionsgeprüft; das ersetzt keine
Provider-E2E-Abnahme. Keine pauschale Behauptung vollständiger Fehlerfreiheit.

## Evidenzablage

Git-ignoriert: `test-results/staging-browser-report.json`,
`local-browser-final-report.json`, `lint-report.json`, `production-preflight-final.json`,
`staging-webhook-probe.json`, `staging-ticket-refund.json`, `staging-legacy-release.json`.
Sensitive Session-/Providerartefakte nicht veröffentlichen. Logische Sicherungen
und Originaldaten der vier stornierten Test-Holds liegen in `.acceptance-backups/`.
Der versandte PDF-Anhang wurde zur Sichtprüfung aus dem eingefrorenen Versandpayload
extrahiert; zusätzliche Layout-Fixtures wurden ausschließlich lokal erzeugt.
`wizard-report.json` und `staging-turnstile-report.json` ergänzen die Browsernachweise.
Alle Zahlungen und Erstattungen erfolgten im Stripe-Testmodus; kein echtes Geld.
