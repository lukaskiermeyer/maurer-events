# Vercel-Testbetrieb und Netcup mit Coolify

Ein Repository unterstützt beide Ziele. Next.js läuft als Node-22-Anwendung;
PostgreSQL, Cloudinary, Stripe, Resend und Turnstile sind über Umgebungsvariablen
angebunden. Der Standard-PostgreSQL-Treiber funktioniert sowohl mit Neon als auch
mit einer privaten PostgreSQL-Datenbank in Coolify. Ein Neon-WebSocket-Proxy ist
auf Netcup nicht erforderlich. Es gibt keine lokalen Benutzeruploads und keine
Sessions im Arbeitsspeicher: Medien liegen bei Cloudinary, Sessions und Limits
in PostgreSQL.

## Kosten und Testumgebung

Vercel Hobby ist für persönliche, nicht kommerzielle Nutzung bestimmt. Eine
Kundenwebsite sollte deshalb nicht als dauerhaft kostenloses Hobby-Projekt
eingeplant werden, auch wenn zunächst nur getestet wird. Die tatsächlich zulässige
Nutzung bzw. ein Pro-Tarif muss vor Übergabe geklärt sein:
[Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Fair Use](https://vercel.com/docs/limits/fair-use-guidelines).
Die technische Konfiguration erzwingt keinen Vercel-Tarif. Eine Staging-App auf
einem ohnehin vorhandenen Netcup-Server ist eine Alternative ohne zusätzlichen
Vercel-Tarif; Server und externe Dienste bleiben gegebenenfalls kostenpflichtig.

Staging verwendet eine eigene Datenbank, Stripe-Testschlüssel und ein separates
Test-Webhook-Secret. Keine echten Gastdaten oder Livezahlungen. Für den Kundentest
eine stabile Domain verwenden; `NEXT_PUBLIC_BASE_URL` und Turnstile müssen genau
dazu passen. Beliebige dynamische Preview-URLs sind ohne passende Konfiguration
kein vollständiger Buchungs-/Login-Test.

## Vercel

1. Repository als Next.js-Projekt importieren, Node.js **22.x** wählen.
2. `vercel.json` verwendet `npm ci`, `npm run build` und Frankfurt (`fra1`).
3. Variablen aus `.env.example` in der tatsächlich eingesetzten Umgebung setzen.
   Die bestehende Testdomain nutzt Vercels Environment **Production**; das darf
   dennoch ausschließlich Stripe-Testschlüssel enthalten.
4. Für `DATABASE_URL` die TLS-geschützte gepoolte Neon-URL verwenden. Vor dem
   Deployment Migrationen mit der **direkten** Datenbankverbindung ausführen.
5. Nach Änderungen an öffentlichen Variablen neu bauen. Nach dem Deploy
   `/api/health`, Login, Reservierung und `/scanner/zxing_reader.wasm` prüfen.
6. Cleanup alle fünf Minuten über einen externen Scheduler oder einen geeigneten
   Vercel-Cron-Tarif einrichten. Im Repository ist bewusst kein täglicher
   Hobby-Cron als Ersatz für diesen Buchungsabgleich hinterlegt.

## Netcup / Coolify: konkrete Einstellungen

Für einen ersten Betrieb mit einer App-Instanz ist ein Linux-Server mit etwa
2 vCPU und 4 GB RAM ein sinnvoller Ausgangspunkt; Builds können mehr RAM benötigen.
Das ist keine Lastzusage. Coolify installieren, DNS auf den Server zeigen lassen
und HTTPS über Coolifys Reverse-Proxy einrichten. Nur erforderliche öffentliche
Ports freigeben; PostgreSQL bleibt im privaten Docker-Netz.

In Coolify eine **Application → Git Repository → Dockerfile** anlegen:

| Einstellung | Wert |
| --- | --- |
| Base Directory | `/` |
| Dockerfile Location | `/dockerfile` (vorhandener Dateiname ist kleingeschrieben) |
| Port / Ports Exposes | `3000` |
| Domain | `https://<Produktionsdomain>`; intern auf Port 3000 |
| Healthcheck | HTTP `GET /api/health`, Port 3000, erwartet 200 |
| Startperiode / Intervall / Timeout | 30 s / 30 s / 10 s, 3 Versuche |
| Start Command | Docker-CMD beibehalten: `node server.js` |
| Instanzen | zunächst 1 |
| Shutdown-Grace | mindestens 30 Sekunden |

Der Dockerfile baut einen Standalone-Server, kopiert statische Dateien und den
QR-Decoder und startet als Benutzer 1001. Keine Host-Portfreigabe ist nötig, wenn
Coolify direkt über sein Proxy-Netz routet. Der Proxy muss den öffentlichen Host
in `Host` bzw. `X-Forwarded-Host` korrekt weitergeben; keine Wildcard-Ausnahme für
Server Actions eintragen. Dynamische Antworten, Admin, Health und APIs nicht
über eine pauschale Proxy-Cache-Regel zwischenspeichern.

### Umgebungsvariablen

**Build UND Runtime:** `NEXT_PUBLIC_BASE_URL` (HTTPS-Origin ohne Pfad oder Slash),
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Diese zwei Variablen in Coolify als Build-Argumente
aktivieren. Ein Image mit anderer Domain/Widget-Konfiguration muss neu gebaut werden.

**Nur Runtime:** `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_EMAIL`, `ADMIN_EMAILS`, `AUTH_SECRET`,
`CRON_SECRET`, `TURNSTILE_SECRET_KEY`, die `CLOUDINARY_*`-Variablen und optional
`GEMINI_API_KEY`. `ALLOW_DEV_LOGIN=false`. Auth- und Cron-Secret jeweils separat
mit mindestens 32 zufälligen Zeichen erzeugen. Secrets nicht als Docker-Build-ARG
setzen; `.env`-Dateien sind aus dem Build-Kontext ausgeschlossen.

### Datenbank

Einfachster erster Umzug: Neon weiterverwenden und nur die App verschieben.
Alternativ in Coolify eine PostgreSQL-17-Ressource mit dauerhaftem Datenvolume
anlegen. App und Datenbank ins gleiche private Netz aufnehmen, Datenbanknamen,
Benutzer und Passwort erstellen und die **interne** Connection-URL als
`DATABASE_URL` setzen. Keine öffentliche Portfreigabe für die Datenbank.

Schemaänderungen sind ein eigener Release-Schritt nach einer Sicherung. Das Image
enthält den gesamten Migrationsstand und den Runner:

```sh
# In einem einmaligen Container des neuen Images, im gleichen Datenbanknetz:
docker run --rm --network <db-netz> --env-file /sicherer/pfad/migration.env <neues-image> node scripts/db-migrate.mjs
```

`migration.env` enthält `DATABASE_URL` als direkte Verbindung zum gewünschten Ziel.
Alternativ im bereits zugänglichen App-Container `node scripts/db-migrate.mjs`
ausführen oder aus dem ausgecheckten Release `npm run db:migrate` mit gesetzter
direkter `DATABASE_URL`. Beim ersten Start ohne Schema wird der Healthcheck 503
melden, bis die Migration abgeschlossen ist. Ein Coolify-Pre-Deployment-Hook ist
nur geeignet, wenn er nachweislich im **neuen Image** und dessen Datenbanknetz
läuft; kein Migration-Hook im Docker-Build und keine automatische Migration bei
jedem Serverstart.

Der Runner lädt keine `.env.local`, verwendet Drizzles Ledger und serialisiert
Migrationen über eine Session-Sperre. **Keine Transaction-Pooler-URL für diesen
Migrationslauf verwenden.** Eine bestehende Datenbank ohne passendes Ledger zuerst
prüfen; nicht mit `drizzle-kit push` oder gefälschten Ledger-Einträgen reparieren.

### Geplanter Cleanup

In Coolify bei der Application eine Scheduled Task eintragen:

| Einstellung | Wert |
| --- | --- |
| Zeitplan | `*/5 * * * *` |
| Befehl | `node /app/scripts/run-cleanup.mjs` |
| Runtime-Variable | `CLEANUP_BASE_URL=http://localhost:3000` |
| Authentifizierung | `CRON_SECRET` aus derselben App-Umgebung |

Der Aufruf gleicht abgelaufene Zahlungs-Holds ab und wiederholt fehlgeschlagene
Ticketzustellungen. Fehler erzeugen einen Exit-Code ungleich null. Läufe nicht
überlappen lassen und Fehler/ausbleibende Läufe alarmieren. Für Vercel denselben
Runner mit `CLEANUP_BASE_URL=https://<Testdomain>` und `CRON_SECRET` in einem
externen Node-22-Scheduler verwenden. Dieser Runner prüft TLS, folgt keinen
Weiterleitungen und gibt weder Token noch Antworten mit Gastdaten aus.

### Sicherung und Überwachung

Datenbankvolume ist keine Sicherung. Tägliche verschlüsselte Backups außerhalb
des Netcup-Servers, passende Aufbewahrung und Wiederherstellungsproben einrichten.
Bei echtem Verkauf auch PITR/RPO/RTO festlegen. Coolify-Konfiguration, Secrets und
Medienbestand müssen ebenfalls wiederherstellbar sein. Mindestens Health-503,
Webhooks mit 5xx, ausgefallenen Cleanup und ausstehende Tickets überwachen.

## Wechsel von Vercel nach Netcup

1. Produktion als getrennte App/Datenbank vorbereiten, keine Testzahlungen oder
   Testgäste als produktive Buchungen übernehmen. Fachliche Inhalte gezielt
   übertragen; beim Umzug einer echten Datenbank `pg_dump`/`pg_restore` mit
   geprüften Backups verwenden, einschließlich Migrationsledger.
2. Endgültige Domain für Build, Runtime und Turnstile konfigurieren. Probelauf mit
   getrennten Staging-Schlüsseln auf Netcup durchführen.
3. Migrationen, Admin-Login, Tischbuchung, Ticket, Scan, Bilder und Cleanup auf dem
   Linux-Zielsystem prüfen. Neue Stripe-Webhook-Adresse mit allen sechs Ereignissen
   aus [deployment.md](deployment.md) einrichten und eine echte Testzustellung prüfen.
4. Vor Übernahme echter Bestandsdaten Schreibzugriffe kurz anhalten und offene
   Checkout-Sessions/noch eintreffende Webhooks berücksichtigen. DNS-Wechsel erst
   nach synchronisierten Daten; alte Instanz darf keine neuen abweichenden
   Buchungen annehmen. Alte Webhooks bis zum gesicherten Übergang bedienen.
5. DNS umstellen, HTTPS/Health/Provider prüfen, erst danach alte Instanz abschalten.
   Vorherige Image-Version und Backup bereithalten. Bei neuen produktiven
   Buchungen niemals blind auf einen älteren Datenbankstand zurückrollen.
6. Beim Hosting-/Datenbankwechsel Datenschutzhinweise, Auftragsverarbeitung und
   tatsächliche Datenregionen aktualisieren. Die aktuellen Texte nennen Vercel/Neon.

Docker und Coolify sind im lokalen Windows-Prüfumfeld nicht installiert. Der
Standalone-Betrieb mit regulärem PostgreSQL wird lokal geprüft; Build und Betrieb
des Linux-Images sowie der tatsächliche Scheduler müssen auf Netcup abgenommen werden.
