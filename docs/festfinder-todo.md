# Festwirt Finder – ToDo Liste

> **Ziel:** n8n findet automatisch Vereinsjubiläen & Feste in Ingolstadt, Kelheim, Regensburg, München, die in 9–24 Monaten starten und wo man sich noch als Festwirt bewerben kann. Ergebnisse landen im Admin Bereich von Maurer Events.

**Status Datum:** 2026-11-18
**Workflow-Datei:** [`docs/n8n-festwirt-finder.json`](./n8n-festwirt-finder.json)
**API-Doku (maßgeblich):** [`docs/fest-chances-ingest.md`](./fest-chances-ingest.md)
**Prinzip:** Human-in-the-Loop – n8n findet & scored nur, du entscheidest & bewirbst dich.

> **Stand der Umsetzung (17.11.2026):** Backend und Admin sind fertig.
> Die API schreibt auf `fest_chances` (Legacy-Zwilling `fest_opportunities`
> läuft mit, Abschaltpfad steht in der API-Doku). Schreibzugriffe der alten
> Phase-2/3-Spezifikation unten sind dadurch überholt – die Details stehen in
> der API-Doku, nicht mehr hier.

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
  - [ ] `MAURER_API_URL` – Ziel: `https://<PRODUKTIONSDOMAIN>/api/admin/fest-chances/ingest`
  - [ ] `MAURER_N8N_KEY` (bzw. `FEST_CHANCEN_INGEST_TOKEN`) – in Coolify als Runtime-Secret setzen (min. 32 zufällige Zeichen, siehe API-Doku)
- [ ] In n8n testen: **Manual Trigger → Execute** (Webhook `/webhook/festfinder-start` testen)
- [ ] Schedule prüfen: `Mo + Do 07:00 Uhr` (Europe/Berlin)
- [ ] Optional: Free-Tier Alternativen bereithalten – Groq / Gemini Flash / OpenRouter `:free` (nur Env-Variablen ändern, kein Umbau)

> Achtung: Der Workflow-Node muss `Authorization: Bearer` (oder `x-api-key`)
> gegen `FEST_CHANCEN_INGEST_TOKEN` verwenden. Der frühere
> `X-N8N-API-KEY`-Header aus dieser Datei ist nicht mehr aktuell.

## Phase 1 – Such- und Extraktionsqualität (offen)

- [ ] 1 Lauf mit allen 32 Queries (8 Templates x 4 Regionen) durchlaufen lassen
- [ ] Treffer-Qualität prüfen: 5–10 echte Vereinsseiten pro Region mit Datum 2027/2028?
- [ ] Irrelevante Treffer filtern (Facebook, Instagram, PDFs raus – bereits im Node „Suchtreffer parsen")
- [ ] Queries nachschärfen falls zu breit/eng
- [ ] 3–5 echte URLs manuell im Node „LLM extrahieren + scoren" testen; valides JSON prüfen
- [ ] Score-Logik verifizieren (Jubiläum +40, Festwirt offen +25, Kernregion +20, 9–24 Monate +15, vergeben −30, zu kurz/langfristig −20)
- [ ] Threshold `minScore = 60` kalibrieren (zu viel / zu wenig Treffer?)
- [ ] Aktualitäts-Filter gegenchecken: serverseitig weist die API veraltete Elemente als `stale` ab (Eventdatum > 31 Tage zurück, Quellen > 24 Monate) – siehe API-Doku

## Phase 2 – Maurer Events Backend ✅ (17.11.2026)

- [x] Tabelle `fest_chances` (+ Legacy `fest_opportunities`) im Schema
- [x] `POST /api/admin/fest-chances/ingest` – Bearer/x-api-key, max. 200 Items, Dedupe über `urlHash`, Soft-Delete-Regel
- [x] `GET /api/admin/fest-chances` (Filter, Sortierung, `?format=csv`)
- [x] Recheck-Cron `GET /api/cron/fest-chancen-recheck` (Erinnerungen an offene Chancen)
- [x] Backfill-Skript `npm run backfill:fest-chances` (idempotent, `--dry-run` verfügbar)
- [x] Legacy-Dedupe + Abschaltpfad für `fest_opportunities` dokumentiert (API-Doku, „Abschaltpfad Legacy")
- [ ] Legacy-Abschaltpfad tatsächlich durchziehen (Admin liest nur `fest_chances`, dann Tabelle archivieren) – wenn Stufe stabil läuft

## Phase 3 – Admin Bereich ✅ (17.11.2026)

- [x] Seite `src/app/[locale]/admin/festchancen` (Liste, Filter, Status, Kontakt, Quellen-Link, Soft-Delete)
- [x] Status-Workflow im Admin (neu → prüfen → beworben → …)
- [x] CSV-Export (`?format=csv`, RFC4180, UTF-8 mit BOM)
- [ ] E-Mail-Benachrichtigung bei X neuen Opportunities (Resend) prüfen/aktivieren
- [ ] Anschreibungs-Vorlagen-Generator (Textbaustein pro Jubiläum/Festtyp) – falls gewünscht

## Phase 4 – Go-Live & Monitoring (offen)

- [ ] n8n Schedule aktivieren (Mo + Do 07:00)
- [ ] 3 Test-Läufe beobachten: Trefferanzahl, Score-Verteilung, Fehlerrate, `stale`-Anteil
- [ ] Query-Templates & Threshold feintunen
- [ ] Error-Handling: n8n Error-Workflow → E-Mail/Telegram wenn Lauf fehlschlägt
- [ ] Logging: letzte n8n-Läufe (`runId`) im Admin sichtbar prüfen
- [ ] Kosten-Check: Bleibt alles im Free Tier? (Tavily ~120 Requests/Monat, LLM ~500–800k Tokens/Monat)
- [ ] Env-Variablen dokumentieren, Produktions-URL setzen

## Schwester-Feature: Vereins-Radar (undokumentiert)

Neben Fest-Chancen gibt es inzwischen `vereins_radar` (Tabelle, Admin-Seite
`/admin/vereins-radar`, Ingest `POST /api/admin/vereins-radar/ingest`, Auth
über `MAURER_API_KEY`). Dafür existiert **keine Doku** analog
`fest-chances-ingest.md` – kurz nachziehen, sobald der n8n-Workflow dafür
steht. Bis dahin ist der Ingest-Code selbst die Referenz.

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
