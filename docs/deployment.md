# Deployment und Betrieb

Die Anwendung benötigt eine Node.js-Laufzeit, PostgreSQL, Stripe, Resend und
Cloudflare Turnstile. Die abgenommene Staging-Domain ist
`https://maurer-events.madebylui.net`; Vercel bedient diese Domain aus seiner
Umgebung **Production**. Das ist eine Vercel-Zuordnung, keine Freigabe für echte
Kundendaten oder Stripe-Livezahlungen.

## Vercel

Node.js 22 verwenden, Abhängigkeiten mit `npm ci` installieren und `npm run build`
ausführen. Die Variablen müssen zur tatsächlich verwendeten Vercel-Umgebung passen.
Nach Änderungen neu deployen; öffentliche Werte werden in den Build eingebettet.

`npm run build` führt automatisch `scripts/prepare-scanner.mjs` aus. Das Skript
kopiert den zur installierten Scanner-Bibliothek gehörenden WASM-Decoder nach
`public/scanner/zxing_reader.wasm` und prüft dessen Bibliotheks-Prüfsumme. Die Datei
ist generiert und Git-ignoriert; bei Direktaufruf von `next build` vorher das Skript
ausführen. Nach dem Deploy muss `/scanner/zxing_reader.wasm` mit HTTP 200 und
`application/wasm` ausgeliefert werden. Die CSP erlaubt `wasm-unsafe-eval` für diesen
Decoder; zusätzliche externe Decoder-CDNs sind nicht erforderlich. Bei Standalone-
Betrieb wie unten beschrieben den erzeugten `public`-Ordner mitkopieren.

| Variable | Zeitpunkt und Zweck |
| --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Build und Laufzeit; tatsächlicher HTTPS-Ursprung ohne abschließenden Slash |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Build; echtes Widget für den tatsächlichen Host |
| `TURNSTILE_SECRET_KEY` | Laufzeit; Secret desselben Widgets |
| `DATABASE_URL` | Laufzeit; getrennte Staging- und Produktionsdatenbanken |
| `STRIPE_SECRET_KEY` | Laufzeit; `sk_test_` auf Staging, eigener Liveschlüssel bei Produktionsfreigabe |
| `STRIPE_WEBHOOK_SECRET` | Laufzeit; zum Endpoint und Stripe-Modus gehörendes Secret |
| `RESEND_API_KEY`, `EMAIL_FROM` | Laufzeit; verifizierter Absender |
| `CONTACT_EMAIL` | Laufzeit; Kontaktpostfach, auf Staging ausschließlich autorisiertes Testpostfach |
| `ADMIN_EMAILS` | Laufzeit; explizite Administrator-Allowlist |
| `AUTH_SECRET` | Laufzeit; mindestens 32 zufällige Zeichen |
| `CRON_SECRET` | Laufzeit; mindestens 32 zufällige Zeichen |

`ALLOW_DEV_LOGIN` deaktiviert lassen. Weitere Medien-/Übersetzungsvariablen stehen
in `.env.example`. Geheimnisse nicht in öffentliche Variablen oder Logs schreiben.
Staging verwendete den freigegebenen Absender
`Maurer Events <noreply@travellui.com>`; für Produktion einen passenden verifizierten
Absender und funktionierendes Kontaktpostfach bereitstellen.

## Datenbank

Vor Migration eine konsistente Sicherung erstellen und die Wiederherstellung in
einer getrennten Datenbank erproben. Eine leere Datenbank mit der vollständigen
Drizzle-Migrationskette initialisieren. Für Datenbanken mit verifiziertem Ledger:

```powershell
npx.cmd drizzle-kit migrate
```

Kein `drizzle-kit push` als Produktionsmigration verwenden. Bei fehlendem Ledger
zuerst das vorhandene Schema gegen die Baseline prüfen. Das Skript
`staging-migrate.mjs --confirmed-test-database` ist ausschließlich für die
ausdrücklich bestätigte Testdatenbank bestimmt. Es erstellt eine logische
Anwendungssicherung und prüft sie mit PostgreSQL auf Loopback-Port 55439; es ersetzt
keine providerseitige Sicherung, Rollenverwaltung oder PITR.

Migrationen 0004–0006 führen Sicherheitsfelder, Zahlungsstatus, Ticketzustellung
und Wartelisten-Eindeutigkeit ein. 0007 dokumentiert die explizite `public`-
Qualifizierung. Neon-Pooling kann einen leeren `search_path` liefern; alle ORM-
Tabellen und Enums sind deshalb qualifiziert. Keine `search_path`-Startup-Option
an den gepoolten Neon-Endpunkt senden.

## Stripe und CAPTCHA

Endpoint: `<NEXT_PUBLIC_BASE_URL>/api/webhooks/stripe`. Diese sechs Ereignisse
abonnieren:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`

Das Endpoint-Secret in derselben Vercel-Umgebung setzen. Nach dem Deploy eine gültige
Zustellung und Wiederholung prüfen; ein Test nur mit ungültiger Signatur beweist
die erfolgreiche Zustellung nicht. Zahlungsarten im jeweiligen Stripe-Konto
aktivieren und in dessen Checkout prüfen.

Ein echtes Turnstile-Widget für die Domain verwenden. Erwartete Aktionen:
`checkout`, `waitlist`, `admin-login`, `contact`. Cloudflare-Testschlüssel liefern
keinen belastbaren Nachweis für Hostname oder Aktion und sind für diese Abnahme
ungeeignet. CAPTCHA-Prüfungen bleiben geschlossen, wenn der Dienst ausfällt.

Bei `OTP request failed` helfen die festen `stage`-/`reason`-Label im Runtime-Log:
`captcha-secret-missing` bedeutet fehlendes Runtime-Secret, `captcha-url-invalid`
eine ungültige Basis-URL, `captcha-service-timeout` einen Timeout und
`captcha-service-http-…` einen HTTP-Fehler des Prüfdienstes. `captcha-rejected`
bezeichnet einen abgewiesenen Token; `captcha-hostname-mismatch` und
`captcha-action-mismatch` eine unpassende Widget-/Domain-Konfiguration.
Bei `captcha-secret-invalid` das Secret des tatsächlich eingebetteten Widgets
überprüfen. Keine Token-/Secret-Werte zur Diagnose veröffentlichen.

## Cleanup, Monitoring und Wiederherstellung

Ein authentifizierter Scheduler muss `/api/cron/cleanup` regelmäßig, beispielsweise
alle fünf Minuten, mit `Authorization: Bearer <CRON_SECRET>` aufrufen. Vercel-Cron
planabhängig konfigurieren oder einen externen Scheduler einsetzen. Ein
Cloudflare-`scheduled`-Trigger ruft diesen HTTP-Endpunkt nicht automatisch auf.

Der Cleanup gleicht Holds mit Stripe ab, wiederholt Ticketversand und entfernt
abgelaufene Authentifizierungsdaten. Seine tatsächliche Ausführung überwachen.
Unklare Zahlungszuordnungen dürfen bei echten Buchungen nicht allein aufgrund
ihres Alters freigegeben werden. Status `payment_review` und `disputed`,
Webhook-503, fehlende Ticketzustellungen und Health-503 müssen bearbeitet werden.

`/api/health` prüft Datenbank und wesentliche Sicherheitsfelder ohne Cache. Zusätzlich
einen Browser-Smoke-Test durchführen: Bei gestreamten Serverfehlern kann eine
Seite trotz Fehler HTTP 200 melden. Sicherungsintervall, PITR-Aufbewahrung,
Wiederherstellungszeit, Alarmempfänger und Zuständigkeiten vor Livebetrieb festlegen.

## Standalone und Docker

```powershell
npm.cmd ci
npm.cmd run build
Copy-Item -LiteralPath public -Destination .next/standalone/public -Recurse -Force
Copy-Item -LiteralPath .next/static -Destination .next/standalone/.next/static -Recurse -Force
$env:PORT='3100'
$env:HOSTNAME='localhost'
node --env-file=.env.production .next/standalone/server.js
```

Bei lokaler Loopback-Abnahme denselben Hostnamen `localhost` verwenden. Next.js
normalisiert `127.0.0.1` in Proxy-URLs; eine davon abweichende Listener-URL kann
Locale-Rewrites als externe Weiterleitung behandeln. Der mit `localhost`
gestartete Standalone-Build wurde auf Desktop und Mobil geprüft.

Docker nutzt `HOSTNAME=0.0.0.0`, einen Nicht-Root-Benutzer und HTTP-Healthcheck.
Mit `.env.production` und gesetzten öffentlichen Buildwerten:

```powershell
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

TLS-Reverse-Proxy vorschalten. Docker war im Abnahmeumfeld nicht verfügbar; Image,
Linux-Laufzeit, Healthcheck und Neustart müssen im tatsächlichen Zielsystem geprüft
werden. Die Docker-Sicherung darf keine `.env`, Testdaten oder lokalen Backups
enthalten; `.dockerignore` schließt diese aus.

## Freigabe

Die Freigabeblocker und Nachweise stehen in `production-acceptance.md`. Vor echtem
Verkauf gehören dazu funktionierende OTP-Anmeldung und Buchungswizard mit echtem
CAPTCHA, freigegebene Vertrags-/Stornobedingungen, tatsächlicher Ticketempfang,
Scheduler und geprüfte Betriebsverfahren. Staging-Testzahlungen sind kein Nachweis
für Liveschlüssel, Livewebhooks oder spätere SEPA-Abrechnung.
