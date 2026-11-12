# Festwirt Finder – ToDo Liste

> **Ziel:** n8n findet automatisch Vereinsjubiläen & Feste in Ingolstadt, Kelheim, Regensburg, München, die in 9–24 Monaten starten und wo man sich noch als Festwirt bewerben kann. Ergebnisse landen im Admin Bereich von Maurer Events.

**Status Datum:** 2026-11-07
**Workflow-Datei:** [`docs/n8n-festwirt-finder.json`](./n8n-festwirt-finder.json)
**Prinzip:** Human-in-the-Loop – n8n findet & scored nur, du entscheidest & bewirbst dich.

---

## Phase 0 – n8n Setup (bereits gehostet)

- [ ] Workflow `docs/n8n-festwirt-finder.json` in n8n importieren (Workflows → Import from File)
- [ ] Auf n8n Server diese Env-Variablen setzen & n8n neu starten:
  - [x] Suchprovider auf **Tavily** umgestellt (Serper hat API-Probleme) – siehe `docs/n8n-festwirt-finder.json`
  - [x] Tavily CLI (`tvly` 0.2.1) per pip installiert – `tvly auth --json` prüfen
  - [ ] n8n Credentials: `Tavily` als **HTTP Bearer Auth** anlegen (Key `tvly-...` aus Tavily Dashboard) – KEIN Env-Var! Credential-ID im Workflow: `TfOEMdPaz5HdkgTx`
  - [ ] `LLM_BASE_URL` – Standard: `https://integrate.api.nvidia.com/v1` (NVIDIA NIM)
  - [ ] `LLM_API_KEY`
  - [ ] `LLM_MODEL` – Standard: `meta/llama-3.1-8b-instruct`
  - [ ] `MAURER_API_URL` – Standard: `https://DEINE-DOMAIN.de/api/admin/fest-chancen/ingest` (später)
  - [ ] `MAURER_N8N_KEY` (gemeinsames Secret für Ingest-API)
- [ ] In n8n testen: **Manual Trigger → Execute** (Webhook `/webhook/festfinder-start` testen)
- [ ] Schedule prüfen: `Mo + Do 07:00 Uhr` (Europe/Berlin)
- [ ] Optional: Free-Tier Alternativen bereithalten – Groq / Gemini Flash / OpenRouter `:free` (nur Env-Variablen ändern, kein Umbau)

## Phase 1 – Kernkomponenten testen (noch ohne Maurer Events Backend)

### Such-Qualität
- [ ] 1 Lauf mit allen 32 Queries (8 Templates x 4 Regionen) durchlaufen lassen
- [ ] Treffer-Qualität prüfen: 5–10 echte Vereinsseiten pro Region mit Datum 2027/2028?
- [ ] Irrelevante Treffer filtern (Facebook, Instagram, PDFs raus – bereits im Node „Suchtreffer parsen")
- [ ] Queries nachschärfen falls zu breit/eng

### LLM Extraktion + Scoring
- [ ] 3–5 echte URLs manuell in Node „LLM extrahieren + scoren" testen
- [ ] Prüfen: Kommt valides JSON raus? `title, organizer, location, eventDate, festwirtStatus, score, scoreReason`
- [ ] Score-Logik verifizieren:
  - `+40` Jubiläum 50/75/100/125/150 Jahre
  - `+25` Festwirt offen / Ausschreibung / unklar
  - `+20` Kernregion
  - `+15` Fest in 9–24 Monaten (2027-08 bis 2028-11)
  - `-30` Festwirt vergeben / geschlossen
  - `-20` zu kurzfristig (<6 Monate ohne Notfall) oder zu früh (>36 Monate)
- [ ] Threshold testen: Score-Schwelle `minScore = 60` – zu viel / zu wenig Treffer?
- [ ] Datum-Check prüfen: >36 Monate raus, <4 Monate nur bei „Notfall / abgesprungen / frei"

### POST Test
- [ ] Node „An Maurer Events senden" vorerst auf webhook.site zeigen lassen, Payload prüfen
- [ ] Payload-Format checken: Array von Opportunities mit `status: 'new'`, `discoveredAt`, `runId`
- [ ] Erst wenn Test sauber läuft → weiter zu Phase 2

## Phase 2 – Maurer Events Backend (Next.js + Drizzle)

### Datenbank
- [ ] Tabelle `fest_opportunities` anlegen (Migration in `src/db/schema.ts`):
  - [ ] `id (uuid), title, organizer, location, region, eventDate, jubileeYears, categories[]`
  - [ ] `contactName, contactEmail, contactPhone, sourceUrl`
  - [ ] `festwirtStatus: open|unknown|taken|closed`
  - [ ] `score (0-100), scoreReason, monthsAhead`
  - [ ] `status: new|reviewing|applied|contacted|won|lost|ignore`
  - [ ] `nextAction, discoveredAt, n8nRunId, createdAt, updatedAt`
  - [ ] Unique Index auf `sourceUrl` + Index auf `status, region, eventDate, score`
- [ ] Tabelle `fest_runs` anlegen (Protokoll pro n8n-Lauf: `runId, startedAt, foundCount, syncedCount, error`)

### API
- [ ] `POST /api/admin/fest-chancen/ingest` (Route, z.B. `src/app/api/admin/fest-chancen/ingest/route.ts`):
  - [ ] Auth über Header `X-N8N-API-KEY` gegen Env `MAURER_N8N_KEY` prüfen (401 wenn falsch)
  - [ ] JSON-Array validieren, Duplikate über `sourceUrl` abgleichen (Upsert)
  - [ ] Einträge in `fest_opportunities` + Lauf in `fest_runs` schreiben
  - [ ] Rate-Limit / Max-Payload Limit (z.B. max 200 Items)
- [ ] Server Action `getFestOpportunities()` + `updateFestOpportunityStatus()` mit `requireAdmin()`-Guard (wie `src/lib/auth.ts`)
- [ ] Admin-Übersicht: Stats (X neu, X geprüft, X beworben)

## Phase 3 – Admin Bereich anzeigen

- [ ] Neue Seite `src/app/[locale]/admin/festchancen/page.tsx` (ähnlich zu `/admin/events`)
- [ ] Tabelle/Karten-Liste mit:
  - [ ] Score-Badge (grün ≥80, gelb 60–79), Event-Datum, Region, Jubiläum
  - [ ] Filter: Region (Ingolstadt / Kelheim / Regensburg / München), Status, Score ≥60, Datum 9–24 Monate
  - [ ] Detail-Expand: Score-Begründung, Kontakt, Quellen-Link, Snippet/Text
- [ ] Aktionen pro Eintrag:
  - [ ] Status setzen: `Neu → Prüfen → Beworben → Kontaktiert → Zusage/Absage`
  - [ ] Link „Vereinsseite öffnen" + „E-Mail schreiben" (falls Kontakt vorhanden)
  - [ ] „Als ignoriert markieren"
- [ ] Button **„Jetzt in n8n suchen"** → ruft n8n Webhook `/webhook/festfinder-start` auf
- [ ] Neue Unterseite in `AdminTabs` / Navigation verlinken
- [ ] `requireAdmin(true)` Schutz wie auf `/admin/page.tsx`

## Phase 4 – Bewerbungs-Workflow (Phase 2)

- [ ] Anschreibungs-Vorlage Generator (Textbaustein pro Jubiläum / Festtyp) – Platzhalter für Vereinsname + Festdatum
- [ ] Feld `nextAction` + „Nächster Termin / Follow-up Datum"
- [ ] Erinnerung / E-Mail Benachrichtigung: x neue Opportunities → E-Mail an Festwirt (Resend Free Tier, hast du schon in `package.json`)
- [ ] Export: Opportunities als CSV/Excel exportieren (für eigene Bewerbungsliste)
- [ ] Archivierung alter Einträge (`won/lost/ignore` nicht in Default-Liste)

## Phase 5 – Go-Live & Monitoring

- [ ] n8n Schedule aktivieren (Mo + Do 07:00)
- [ ] 3 Test-Läufe beobachten: Trefferanzahl, Score-Verteilung, Fehlerrate
- [ ] Query-Templates & Threshold feintunen
- [ ] Error-Handling: n8n Error-Workflow → E-Mail/Telegram wenn Lauf fehlschlägt
- [ ] Logging: `fest_runs` im Admin anzeigen (letzter Lauf: wann, wie viele gefunden)
- [ ] Kosten-Check: Bleibt alles im Free Tier? (Tavily ~120 Requests/Monat, LLM ~500–800k Tokens/Monat)
- [ ] Backup/Doku: Env-Variablen dokumentieren, Produktions-URL setzen

---

## Kosten / Free-Stack

| Komponente | Kosten | Free-Limit | Fallback |
|---|---|---|---|
| n8n (self-hosted) | 0 € | unbegrenzt | – |
| Tavily Search (Hauptprovider) | 0 € | Free Tier ~1.000 Credits/Monat – für 120 Requests ausreichend | Serper / Brave / DuckDuckGo HTML (Fallback) |
| NVIDIA NIM / Gemini Flash / Groq | 0 € | NIM 1.000 Credits, Gemini 1.500 Req/Tag | Ollama lokal (100% kostenlos) |
| Maurer Events Postgres | 0 € (bereits vorhanden) | – | – |
| Resend Benachrichtigung | 0 € | Free Tier | – |

**Wichtig:** LLM-Aufrufe laufen über OpenAI-kompatiblen Endpoint (`/v1/chat/completions`). Wechsel = nur `LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL` ändern.

## Erfolgskriterien für MVP

- [ ] 1 n8n-Lauf findet ≥5 echte, noch offene Feste in Zielregionen
- [ ] Alle Treffer haben Score ≥60 und realistische Begründung
- [ ] Treffer landen dedupliziert in der DB und sind im Admin sichtbar
- [ ] Status kann im Admin geändert werden (Bewerbung tracken)
- [ ] Manueller Admin-Button startet n8n – Schedule läuft automatisch

