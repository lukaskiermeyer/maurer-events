# Reservierungs- und Sicherheitstests

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

Die vorhandene ESLint-Konfiguration ignoriert TypeScript-Dateien. Ein erfolgreicher
Lint-Aufruf ist deshalb derzeit kein Nachweis für die Reservierungslogik.

## Vor Inbetriebnahme der Sicherheitsänderungen

- Migrationen `0004_reservation_security`, `0005_ticket_delivery` und
  `0006_waitlist_uniqueness` in Reihenfolge anwenden. Die Test-Suite prüft die gesamte
  Migrationskette in einer leeren Datenbank.
- `AUTH_SECRET` mit mindestens 32 zufälligen Zeichen setzen. Alte Klartext-OTPs
  funktionieren nach dem Update nicht mehr; neue Codes anfordern.
- `NEXT_PUBLIC_BASE_URL` auf den tatsächlichen HTTPS-Ursprung setzen. Turnstile muss
  für dessen Hostname konfiguriert sein. CAPTCHA-Aktionen: `checkout`, `waitlist`,
  `admin-login`.
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
