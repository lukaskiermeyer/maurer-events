# Faktenblatt (belegte technische Fakten)

Stand: Repository-Stand 2026-11-14. Unbekannte Werte: "MESSEN ERFORDERLICH" + Messmethode.

| # | Kategorie | Fakt | Beleg |
|---|-----------|------|-------|
| 1 | Framework/Version | Next.js 16.3.8, React 19.2.4, Node.js 22.x | `package.json` |
| 2 | Rendering | App Router (SSR + Server Actions + API Routes), output `standalone` | `next.config.mjs`, `src/app/` |
| 3 | API-Routes | 12 Route-Handler (`src/app/api/**/route.ts`) | Repo-Glob |
| 4 | Server-Actions | 29 Dateien in `src/app/actions/` | Repo-Glob |
| 5 | ORM | Drizzle 0.45.2 + `postgres` 3.4.9; `prepare: false` (Transaction-Pooler) | `src/db/index.ts` |
| 6 | Neon-Endpoint | Pooled (`-pooler…eu-central-1.aws.neon.tech`), sslmode=require, channel_binding=require | `.env.local` (Staging) |
| 7 | Autosuspend/Cold-Start | Neon Free Tier Autosuspend aktiv; `connect_timeout: 30s` adressiert Cold-Start | `src/db/index.ts` Kommentar |
| 8 | Pool-Größe | 5 Connections pro App-Instanz | `src/db/index.ts` `max: 5` |
| 9 | Upload-Pfad | Server-Proxy (Next.js → Cloudinary); kein Browser→Cloudinary | `src/app/api/team/upload/route.ts`, `cloudinary-audit.md` |
| 10 | Dateigrößen | Bilder 10 MB, Admin-Dokumente 15 MB, Team-Upload 10 MB | Upload-Routes |
| 11 | Bild-Transformationen on-the-fly | Ja (Cloudinary URL-Transformationen, z. B. `pg_1` für PDF-Preview) | `src/lib/cloudinary.ts` |
| 12 | PDF-Generierung | `pdf-lib` 1.17.1 + `@pdf-lib/fontkit`; serverseitig | `package.json`, `src/lib/ticket.ts` |
| 13 | Chromium/Playwright im App-Prozess | Nein (Playwright nur Dev/Test) | `devDependencies`, kein Import in `src/` |
| 14 | Cron/Queue-Jobs | `/api/cron/cleanup` alle 5 Minuten; maxDuration 300s (Vercel) | `vercel.json`, `src/app/api/cron/cleanup/route.ts` |
| 15 | Worker | Kein separater Worker; Cleanup als HTTP-Cron; `scripts/run-cleanup.mjs` | `docs/coolify.md` |
| 16 | Redis | Nicht verwendet (Sessions/Limits in PostgreSQL) | `docs/coolify.md`, grep |
| 17 | Websockets/SSE | Nicht verwendet | grep |
| 18 | Mail | Resend SDK; synchron im Request-Pfad (Ticket-Versand, Kontaktformular, OTP) | `src/lib/email.ts`, `src/lib/ticket-delivery.ts` |
| 19 | Nutzerzahlen (Mitarbeiter/Gäste) | MESSEN ERFORDERLICH | — |
| 20 | Saisonprofil/Festtermine | MESSEN ERFORDERLICH | — |
| 21 | Vorhandene Metriken (RAM/CPU/p95) | MESSEN ERFORDERLICH | — |
| 22 | N+1-Queries | MESSEN ERFORDERLICH (Code-Review nötig) | — |
| 23 | Fehlende Indizes | MESSEN ERFORDERLICH (Schema-Review nötig) | — |
| 24 | Cloudinary-Upload-Latenz | MESSEN ERFORDERLICH | — |
| 25 | Neon-Compute-Seconds/Connection-Spikes | MESSEN ERFORDERLICH | — |
| 26 | Steal-Time | MESSEN ERFORDERLICH | — |
| 27 | RAM-Peak je Container | MESSEN ERFORDERLICH | — |
| 28 | CPU-Peak | MESSEN ERFORDERLICH | — |
| 29 | sysbench single/multi | MESSEN ERFORDERLICH | — |
| 30 | fio fsync-Latenz | MESSEN ERFORDERLICH | — |

## Messmethoden für offene Werte

| Wert | Messmethode |
|------|-------------|
| Nutzerzahlen | DB-Query `SELECT count(*) FROM staff`, Reservierungen pro Event; Admin-Auskunft |
| Saisonprofil | Event-Kalender (`events`-Tabelle) auswerten; Lastspitzen aus Logs |
| Metriken RAM/CPU/p95 | `docker stats`, Prometheus/cAdvisor, Neon-Dashboard, APM (z. B. Vercel Analytics) |
| N+1/Indizes | Drizzle-Query-Logging + `EXPLAIN ANALYZE` auf Hot-Paths |
| Cloudinary-Upload-Latenz | k6/Loadtest mit Timing-Header; Cloudinary-Dashboard |
| Neon-Compute-Seconds | Neon-Dashboard (Compute time, connections) |
| Steal-Time | `mpstat -P ALL 1` auf Host |
| RAM/CPU-Peak | `docker stats --no-stream` + cAdvisor |
| sysbench | `sysbench cpu --threads=N run`, `sysbench memory run` |
| fio fsync | `fio --name=fsync --fsync=1 --rw=randwrite --bs=4k --size=1G` |
