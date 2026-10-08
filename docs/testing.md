# Reservierungs- und Sicherheitstests

## Wiederholbare Projektabnahme

Nach `npm run build` und Start des unten beschriebenen PostgreSQL-Testservers:

```powershell
npm.cmd run test:acceptance
```

Der Runner erzeugt ausschließlich eine zufällig benannte Datenbank auf dem festen
Loopback-Testport 55439, prüft die Migrationen inklusive zweitem Aufruf und startet
den Standalone-Server auf `localhost` mit einem automatisch gewählten freien Port. Eine bereits laufende App
wird nicht beendet oder mitgetestet. Bestehende `.env.local`-Providerzugänge werden
für den Kindprozess geleert und durch lokale Testwerte ersetzt. Die Datenbank und
der gestartete Server werden beim Abschluss entfernt bzw. beendet.

Geprüft werden öffentliche Seiten, Zugriffsschutz, Admin-/Helferrollen, Formulare,
gefüllte Warteliste, Galerie-Dialog, mobile Bildaktionen und VIP-Bedienung von
320 bis 1280 Pixel, Buchungskomponenten, Bildverkleinerung vor dem Upload und
Readiness bei fehlendem Schema. Bericht und Screenshots liegen unter
`test-results/project-acceptance`; Komponentenberichte zusätzlich unter
`test-results/booking-browser`, `admin-role-browser` und `image-upload`.
Die Rollenprüfung benötigt keine echten OTPs, E-Mails, Stripe-Zahlungen oder Kamera.
Der Upload-Harness prüft echte Bildverarbeitung im Browser und ersetzt ausschließlich
den anschließenden Provideraufruf. Reale Cloudinary-Zustellung bleibt ein Deployment-Check.

Für den Cleanup-Runner: `node --test scripts/deployment-tools-test.mjs` verwendet
nur einen lokalen HTTP-Server; keine echten Bereinigungen.

Die browserseitige Prüfung benötigt Chromium (`npx playwright install chromium`).
Die zusätzlichen Admin-Tests überspringen sich bei direkten Staging-Smoke-Läufen,
wenn die temporären lokalen Fixtures nicht gesetzt sind.

`npm run test:security` führt die Regressionen für Tischbuchung, Statuswechsel,
Zahlung, OTP-Anmeldung, Warteliste und Ticketversand aus. `npm run test:concurrency`
verwendet dieselbe Suite einschließlich 50 paralleler Buchungsversuche für 8 Plätze.

Die Tests laden keine `.env.local`, senden keine E-Mails und erzeugen keine echten
Stripe-Sessions. Sie erstellen auf `127.0.0.1:55439` eine zufällig benannte eigene
PostgreSQL-Datenbank, wenden alle Migrationen an und entfernen ausschließlich diese
Datenbank beim Abschluss. Der produktive Ereignis-Ledger bleibt unangetastet.

## Lokaler PostgreSQL-Testserver (Windows)

PostgreSQL 17 ist erforderlich. Im Projektverzeichnis:

```powershell
& 'C:/Program Files/PostgreSQL/17/bin/initdb.exe' -D '.reservation-test-db' -U reservation_test -A trust --no-locale --encoding=UTF8
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D '.reservation-test-db' -l '.reservation-test-db/server.log' -o '-p 55439 -h 127.0.0.1' -w start
npm run test:security
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D '.reservation-test-db' -w stop
```

`initdb` nur beim ersten Mal ausführen. Das Testcluster ist in Git ignoriert,
lauscht ausschließlich auf Loopback und wird unabhängig vom bestehenden lokalen
PostgreSQL-Dienst betrieben. Windows-Sandboxes können den Start/Teststarter
blockieren; dann ist die Freigabe für die entsprechenden lokalen Befehle nötig.

## Weitere Prüfung

```powershell
npx tsc --noEmit --incremental false
npm run build
```

`npm.cmd run lint` prüft TypeScript, Next.js und React mit `--max-warnings 0`.
Explizites `any`, direkte synchrone State-Updates in Effekten und verletzte
Hook-Regeln sind Fehler. Die vorherigen 142 Warnungen sind behoben.
Der Produktionsbuild führt zusätzlich Typechecking aus.

## Browser- und Provider-Abnahme

`npm.cmd run test:browser` führt die Desktop-/Mobilprüfungen aus. Mit den lokalen
Fixtures aus `test:acceptance` laufen alle 20 Tests einschließlich Admin und Bildern.
Die Bildprüfung prüft erfolgreiche Abrufe, natürliche Galerieproportionen und
Lightbox-Größen; der Buchungsharness prüft außerdem verzögerte Antworten bei
schnellen Event- und Datumswechseln. Standardziel ist
`http://localhost:3100`; mit `ACCEPTANCE_URL` wird Staging geprüft. Getrennte parallele
Läufe benötigen eigene `ACCEPTANCE_ARTIFACTS` und `ACCEPTANCE_REPORT`.
Playwright löscht ausschließlich sein Artefakt-Unterverzeichnis. DB-Sicherungen
liegen getrennt in `.acceptance-backups/`, sensible Provider-/Sessionartefakte in
Git-ignorierten Verzeichnissen.

`npm.cmd run check:production` prüft Konfiguration, Datenbank und Provider lesend.
Die Provider-Skripte `staging-provider-probe.ts`, `staging-payment.mjs --pay-test`,
`staging-webhook-probe.mjs`, `staging-ticket-refund.ts` und `staging-otp.mjs` sind
ausdrücklich manuelle Abnahmewerkzeuge: Sie greifen auf die freigegebene
Staging-Datenbank und echte Provider-Testdienste zu; sie können Testzahlungen,
E-Mails und Statusänderungen auslösen. Sie gehören nicht in die isolierte CI-Suite.
Der Provider-Probe schließt CAPTCHA bewusst aus. Ein Diensttest ersetzt weder
den echten Wizard noch die authentifizierte Scanner-UI.

`staging-otp.mjs --interactive` öffnet einen sichtbaren Browser für echten CAPTCHA-
und OTP-Abschluss durch den Betreiber. Automatisierte Browser können von Turnstile
abgelehnt werden; dies ist kein Anlass für einen Produktions-CAPTCHA-Bypass.
`staging-turnstile-check.mjs` prüft das öffentliche Widget lesend, ohne Schlüssel
oder Tokens auszugeben. `staging-wizard.mjs [URL]` prüft Vor-/Zurücknavigation am
dedizierten Testevent; es führt keine Buchung aus.
`staging-auth-storage-check.ts` prüft den nativen Neon-Treiber und OTP-/Rate-Limit-
Schreibpfade in einer zurückgerollten Diagnose-Transaktion. Es erzeugt weder
reale Login-Codes noch Sessions oder E-Mails.
`staging-captcha-config-check.mjs` weist leere/absichtlich ungültige CAPTCHA-Tokens
ab, prüft die Checkout-Origin-Konfiguration und meldet ausschließlich feste
Diagnosecodes. Es erzeugt keine Buchung und keine E-Mail; der ungültige Token wird
zum Prüfen der Verbindung an Turnstile gesendet.
`staging-wizard-payment-check.mjs` liest anschließend ausschließlich die vom Betreiber
im normalen Browser erzeugten Testbuchungen des dedizierten Events sowie den
zugehörigen Stripe-Teststatus und Webhook-Nachweis. Kein Checkout wird erzeugt,
bezahlt oder erstattet, keine E-Mail versendet und kein QR-Code protokolliert.

`tsx scripts/ticket-layout-check.ts` erzeugt ausschließlich zwei lokale PDF-Fixtures
und die Vorschau `output/pdf/ticket-vorschau.pdf` mit fiktiven Gastdaten.
`python scripts/verify-ticket-layout.py` benötigt PyMuPDF und prüft vollständige
Angaben, Seitenbegrenzung und Abstand zur QR-Fläche. Die gerenderten PNGs zusätzlich
visuell prüfen. Es werden weder Datenbank noch Versanddienste angesprochen.
`node scripts/ticket-decoder-check.mjs` decodiert die vollständigen gerenderten
normalen und langen Tickets mit dem lokalen WASM-Decoder und vergleicht den
fiktiven QR-Wert. Es sendet keine Check-in-Anfrage.

`node --env-file=.env.local scripts/admin-role-browser-check.mjs --confirmed-test-database`
prüft den lokalen Produktionsserver auf `localhost:3100` mit der ausdrücklich
freigegebenen Testdatenbank: 360/390-Pixel-Gästekarten, Desktop-Tabelle, Formulare,
Anlegen/Widerrufen einer Scanner-Freigabe, Helfer-Redirects, direkte geschützte
Server-Aktionen, Scan nur im freigegebenen Event, einmalige Entwertung und Sperre
der bestehenden Sitzung nach Widerruf. Das Skript erzeugt eigene temporäre
Events, Reservierungen, Freigaben und Testsitzungen und entfernt sie danach.
Es versendet keine Mails, erzeugt keine Zahlung und ersetzt weder einen echten
OTP-Login noch einen physischen Kameratest. Die isolierte Sicherheitssuite prüft
zusätzlich Helfer-OTP, Ablauf, Widerruf und gelöschte Veranstaltungen.

`node scripts/staging-scanner-ticket.mjs` extrahiert ausschließlich das bereits
versendete PDF der freigegebenen Testbuchung für die Scanner-Diagnose. PDF und
QR-Vergleichswert bleiben in `test-results`; keine Ausgabe des QR-Werts und kein
Check-in. `python scripts/prepare-scanner-camera.py` erzeugt daraus die Y4M-Datei
mit PyMuPDF, Pillow und NumPy. `scanner-browser-check.mjs` prüft beide tatsächlichen Scanner-Clients mit
einer daraus erzeugten Y4M-Kamerafixture und der Produktions-CSP: ursprüngliche
CDN-Blockade bei sichtbarem Video, Decoder von eigener Domain, wiederholter Scan
nach Fortsetzen, Fehleranzeige/Neustart bei Decoder-Ausfall und Server-Ausnahme.
Die Server-Aktionen werden ausschließlich im lokalen Harness ersetzt. Die Prüfung
ersetzt weder die echte Authentifizierung noch einen Scan mit physischer Kamera.
`scanner-deployment-check.mjs [Basis-URL]` prüft HTTP-Status, MIME-Typ, exakte
Decoder-Datei und WASM-Freigabe der tatsächlichen Deployment-Antwort nur lesend.
`staging-table-navigation.mjs [Basis-URL]` prüft am separaten Testevent die Tisch-,
Uhrzeit- und Kontakt-Auswahl beim Vor-/Zurückgehen; keine Buchung oder E-Mail.

`node scripts/booking-browser-check.mjs --app-origin=http://localhost:3100`
prüft die Reservierungs- und Bestätigungskomponenten lokal mit fiktiven Daten:
10 Personen bei Tischreservierungen, 1 Person ohne Tischwahl, tatsächliche
Tischkapazität, Wechsel zwischen Eventarten sowie Bestätigung, ausstehende
Zahlung und nicht verfügbarer Status auf Deutsch/Englisch bei 390/1440 Pixeln.
Der lokale Harness ersetzt Server-Aktionen und Turnstile und prüft auch die
automatische Statusaktualisierung. Der optionale `--app-origin` prüft zusätzlich
die echten Next.js-Routen, `noindex`, die alte Stripe-Rückleitung und den
Sprachwechsel mit erhaltener Zahlungszuordnung. Vorschauen
und Bericht liegen in `test-results/booking-browser`; keine echten Buchungen,
Zahlungen oder E-Mails. Vorher `npm run build` für das tatsächliche CSS ausführen.

## Vor Inbetriebnahme der Sicherheitsänderungen

- Migrationen `0004_reservation_security`, `0005_ticket_delivery`,
  `0006_waitlist_uniqueness`, `0007_explicit_public_schema` und `0008_scanner_access`
  in Reihenfolge anwenden. Die Test-Suite prüft die gesamte
  Migrationskette in einer leeren Datenbank.
- `AUTH_SECRET` mit mindestens 32 zufälligen Zeichen setzen. Alte Klartext-OTPs
  funktionieren nach dem Update nicht mehr; neue Codes anfordern.
- `NEXT_PUBLIC_BASE_URL` auf den tatsächlichen HTTPS-Ursprung setzen. Turnstile muss
  für dessen Hostname konfiguriert sein. CAPTCHA-Aktionen: `checkout`, `waitlist`,
  `admin-login`, `contact`.
- `/api/cron/cleanup` regelmäßig mit `Authorization: Bearer <CRON_SECRET>` aufrufen.
  Die Route gleicht abgelaufene Zahlungs-Holds mit Stripe ab und wiederholt
  fehlgeschlagenen Ticketversand. Ohne Abgleich werden unklare Holds weiterhin als
  belegt gezählt.
- Stripe-Webhooks müssen die in `src/lib/stripe-webhook.ts` aufgeführten sechs
  Ereignistypen liefern. Die ausgewählten Zahlungsarten müssen im Stripe-Konto
  verfügbar sein.
- Legacy-Reservierungen ohne Session-ID/gespeicherte Checkout-Parameter sowie
  Zahlungsfehler, die länger als die Stripe-Idempotenz-Aufbewahrung ungeklärt sind,
  manuell mit Stripe abgleichen; sie werden nicht automatisch freigegeben.

Migrationen brechen bei alten doppelten QR-Codes/Wartelisteneinträgen explizit ab.
Zur Vorprüfung (nur lesen):

```sql
SELECT qr_code_text, count(*)
FROM reservations
WHERE qr_code_text IS NOT NULL
GROUP BY qr_code_text HAVING count(*) > 1;

SELECT event_id, lower(trim(email)), count(*)
FROM waitlists
GROUP BY event_id, lower(trim(email)) HAVING count(*) > 1;
```

Vorhandene Duplikate bewusst bereinigen bzw. betroffene Tickets neu ausstellen.
Die Migrationen löschen keine Gästedaten, um Eindeutigkeit herzustellen.
