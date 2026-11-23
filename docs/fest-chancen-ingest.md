# Fest-Chancen Ingest Endpoint

## Endpoint

- **Methode:** `POST`
- **Pfad:** `/api/admin/fest-chancen/ingest`
- **Content-Type:** `application/json`
- **Body:** JSON-Array von Fest-Chancen (max. 200 Elemente). Leeres Array `[]` ist gültig.

## Authentifizierung

Header (einer von beiden):

- `Authorization: Bearer <FEST_CHANCEN_INGEST_TOKEN>`
- `x-api-key: <FEST_CHANCEN_INGEST_TOKEN>`

Vergleich ist timing-safe. Fehlender/falscher Token → `401` (JSON).

## Beispiel-curl

```bash
curl -X POST "https://<PRODUKTIONSDOMAIN>/api/admin/fest-chancen/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FEST_CHANCEN_INGEST_TOKEN" \
  -d '[]'
```

## Payload-Schema (pro Element)

| Feld | Typ | Pflicht | Default |
|---|---|---|---|
| `sourceUrl` | string (URL) | ja | – |
| `sourceUrlNormalized` | string | nein | wird aus `sourceUrl` normalisiert |
| `title` | string \| null | nein | null |
| `organizer` | string \| null | nein | null |
| `location` | string \| null | nein | null |
| `region` | string \| null | nein | null |
| `eventDate` | string \| null (`YYYY-MM-DD`) | nein | null |
| `sourceDate` | string \| null (`YYYY-MM-DD`, Veröffentlichungsdatum der Quelle) | nein | null |
| `applicationDeadline` | string \| null (`YYYY-MM-DD`, Bewerbungs-/Einschreibefrist) | nein | null |
| `verificationStatus` | `verified` \| `unverified` \| `expired` \| `already_awarded` | nein | `unverified` |
| `verificationSummary` | string \| null (Ergebnis aus Stufe-2 Nachrecherche) | nein | null |
| `verifiedAt` | ISO-DateTime-String \| null | nein | null |
| `monthsAhead` | int \| null | nein | null |
| `jubileeYears` | int \| null | nein | null |
| `festwirtStatus` | `open` \| `taken` \| `unknown` \| `closed` | nein | `unknown` |
| `eventType` | `volksfest` \| `schuetzen` \| `trachten` \| `feuerwehr` \| `musik` \| `kirchweih` \| `other` | nein | `other` |
| `contactName` | string \| null | nein | null |
| `contactEmail` | string \| null | nein | null |
| `contactPhone` | string \| null | nein | null |
| `emergency` | boolean | nein | false |
| `score` | int 0..100 | nein | 0 |
| `scoreReason` | string \| null | nein | null |
| `nimModel` | string \| null | nein | null |
| `runId` | string \| null | nein | null |
| `notes` | string \| null | nein | null |
| `discoveredAt` | ISO-DateTime-String | nein | now() |

Unbekannte Felder werden ignoriert.

## Antwortformat

```json
{ "ok": true, "received": 2, "inserted": 1, "updated": 1, "skipped": 0, "stale": 0 }
```

Leeres Array:

```json
{ "ok": true, "received": 0, "inserted": 0, "updated": 0, "skipped": 0, "stale": 0 }
```

`skipped` zählt ungültige Elemente, fehlgeschlagene Items, gelöschte Treffer und
veraltete Elemente; `stale` ist die Teilmenge der veralteten Elemente.

## Aktualitäts-Filter

Elemente mit veralteter Datierung werden abgewiesen (`stale`), bevor sie
angelegt oder aktualisiert werden (immer dynamisch gegen `now`):

- `verificationStatus` ist `expired` oder `already_awarded`,
- `applicationDeadline` liegt vor dem heutigen Tag (abgelaufene Bewerbungsfrist),
- `eventDate` liegt mehr als 14 Tage in der Vergangenheit,
- `eventYear` liegt vor dem aktuellen Jahr,
- `monthsAhead` ist negativ,
- `sourceDate` ist älter als 12 Monate.

## Pre-Filter Endpoint (`known`)

- **Methode / Pfad:** `GET /api/admin/fest-chancen/known` (gleiche Auth wie Ingest)
- Liefert `{ ok, today, urls, eventKeys, radarDomains, radarDeletedLeadKeys }`,
  damit n8n bereits bekannte oder gelöschte URLs/Domains vor den LLM- und
  Verifizierungs-Nodes überspringen kann.

Der Filter greift serverseitig und unabhängig von der n8n-Workflow-Version.
Der Workflow `docs/n8n-festwirt-finder.json` filtert zusätzlich vor dem Senden
(Quellen älter als 24 Monate über `sourceDate` bzw. Tavily `published_date`).

## Löschen / Skip-Regel

Im Admin gelöschte Chancen werden als Soft-Delete markiert
(`fest_chances.status = 'deleted'`, Legacy-Zwilling `fest_opportunities.status =
'ignore'`). Die Zeilen bleiben für das Dedupe-Matching erhalten: Trifft ein
späterer Lauf per `eventKey` oder normalisierter URL auf eine gelöschte Chance,
wird das Element übersprungen (kein Update, kein Legacy-Sync, keine
Benachrichtigung). Gelöschte Chancen erscheinen nicht in Admin-Listen, im
Lese-Endpoint (außer mit explizitem `?status=deleted`) und nicht in
Recheck-Erinnerungen. Archivierte Legacy-Zeilen (`ignore`) werden ebenfalls
nicht mehr aktualisiert.

## Fehlercodes

- `401` – fehlender/falscher Token (JSON)
- `400` – Validierungsfehler: `{ "ok": false, "errors": [{ "index": 0, "path": "sourceUrl", "message": "..." }] }`
- `405` – falsche HTTP-Methode (JSON)
- `404` – unbekannter `/api`-Pfad (JSON, `{ "ok": false, "error": "not_found", "path": "..." }`)
- `500` – Serverfehler (JSON)

## Idempotenz

Duplikate werden über den SHA-256-Hash der normalisierten URL (`urlHash`) erkannt.
Bei einem Update werden nur `score`, `scoreReason`, `festwirtStatus`, `eventType`,
`eventDate`, `monthsAhead`, `jubileeYears`, `contact*`, `emergency`, `nimModel`,
`runId` und `lastSeenAt` überschrieben. `status` und `notes` (manuelle
Bearbeitung im Admin-UI) bleiben erhalten.

## n8n-Hinweis

Der n8n-Node „An Maurer Events senden" muss die passende Domain (die
Next.js-App, nicht die Astro-Marketing-Site) und die Credential „Mauerer Events
API Key" mit `Authorization: Bearer` verwenden. Env in n8n: `MAURER_API_URL`,
`MAURER_N8N_KEY` (bzw. `FEST_CHANCEN_INGEST_TOKEN`).

## Umgebungsvariable

`FEST_CHANCEN_INGEST_TOKEN` – in Coolify als Runtime-Variable (Secret) setzen,
mindestens 32 zufällige Zeichen. Nie loggen. Optionaler Fallback auf
`MAURER_N8N_KEY` / `MAURER_API_KEY` für Bestands-Deployments.

## Lese-Endpoint (Admin-UI)

`GET /api/admin/fest-chancen` (gleiche Auth) mit Query-Params `status`, `region`,
`minScore`, `q`, `sort`, `limit`, `offset`. Antwort `{ "ok": true, "total": N, "items": [...] }`.
Mit `?format=csv` maschinenlesbarer Export (RFC4180, UTF-8 mit BOM).

## Dedupe-Regel Legacy (`fest_opportunities`)

Bei Kollision auf `url_hash` (sha256 der normalisierten URL) gewinnt die Zeile mit
höchstem `score`, bei Gleichstand jüngstes `updated_at`, dann jüngstes
`discovered_at`, dann kleinste `id`. Verlierer werden in
`fest_opportunities_dedupe_log` protokolliert und aus der Haupttabelle entfernt.

## Abschaltpfad Legacy (`fest_opportunities`)

Zwei Wahrheiten sind ein Übergang, kein Dauerzustand. Schrittweise Abschaltung:

1. Admin-UI liest ausschließlich aus `fest_chances` (ersetze Queries auf `fest_opportunities`).
2. Ingest schreibt nur noch `fest_chances`; `syncFestOpportunity` entfernen.
3. Backfill ausführen: `npm run backfill:fest-chances` (idempotent, `--dry-run` prüfen).
4. Verifikation: Zähler und UI stimmen mit `fest_chances` überein; `fest_opportunities` wird nicht mehr geschrieben.
5. Legacy-Tabelle archivieren (`ALTER TABLE fest_opportunities RENAME TO fest_opportunities_legacy`) bzw. Migration zum Drop nach Backup.
6. `fest_opportunities` aus Schema und Doku entfernen.

## Beispiel-curl (echter Datensatz)

```bash
curl -X POST "https://<PRODUKTIONSDOMAIN>/api/admin/fest-chancen/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FEST_CHANCEN_INGEST_TOKEN" \
  -d '[{"sourceUrl":"https://example.com/volksfest-2026","title":"Volksfest 2026","organizer":"Festverein","location":"Muenchen","region":"Bayern","eventDate":"2026-09-19","score":85,"festwirtStatus":"open","eventType":"volksfest","contactName":"Max Mustermann","contactEmail":"max@example.com","runId":"run-2026-09"}]'
```