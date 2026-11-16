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
{ "ok": true, "received": 2, "inserted": 1, "updated": 1, "skipped": 0, "runId": "run-123" }
```

Leeres Array:

```json
{ "ok": true, "received": 0, "inserted": 0, "updated": 0, "skipped": 0, "runId": null }
```

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