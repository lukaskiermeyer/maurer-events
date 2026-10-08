# Maurer Events

Next.js 16 / React 19 mit deutsch-englischer Eventseite, Tischreservierung,
Stripe-Zahlung, PDF-Tickets und einem Adminbereich mit Einlass-Team.

## Lokal starten

Node.js 22 und PostgreSQL verwenden. `.env.example` nach `.env.local` kopieren
und eigene Entwicklungs-/Testdienste eintragen. Keine Liveschlüssel für Tests.

```sh
npm ci
npm run dev
```

## Prüfen

```sh
npm run lint
npm run build
npm run test:security
npm run test:acceptance
```

Sicherheitstests und Abnahme brauchen den isolierten PostgreSQL-Testserver auf
Port 55439. `test:acceptance` startet den Produktionsbuild auf einem freien lokalen Port,
erzeugt eine eigene Datenbank und entfernt diese wieder. Browserabhängigkeiten
müssen installiert sein. Einrichtung: [docs/testing.md](docs/testing.md).

## Hosting und Übergabe

- [Aktuelle Projektabnahme](docs/project-acceptance.md)
- [Vercel und Coolify auf Netcup](docs/coolify.md): Konfiguration, Umzug,
  Migrationen, geplanter Cleanup, Backups und Grenzen des kostenlosen Vercel-Tarifs.
- [Provider und Betrieb](docs/deployment.md): Variablen, Webhook-Ereignisse, CAPTCHA.
- [Admin-Anleitung](docs/admin-guide.md)
- [Offene Punkte vor echtem Verkauf](docs/KNOWN_ISSUES.md)

Das Docker-Image nutzt den vorhandenen kleingeschriebenen `dockerfile` und läuft
als Standalone-Server auf Port 3000. Vercel baut dasselbe Repository direkt über
`vercel.json`. Geheimnisse gehören in die jeweilige Hosting-Umgebung.
