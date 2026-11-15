# Cloudinary-Integration – Sicherheits- & Datenschutz-Audit

Stand: 2026-11-14 · Repo: `maurer-events` · Scope: alle Cloudinary-Touchpoints im Code.

## Inventar der Integrationen

| # | Pfad | Zweck | Upload-Pfad | resource_type |
|---|------|-------|-------------|---------------|
| 1 | `src/app/actions/upload.ts` `uploadImage` | Admin-Galeriebilder | Server-Proxy (Next.js) | image |
| 2 | `src/app/api/team/upload/route.ts` | Mitarbeitende: Ausweise, Gesundheitszeugnisse, Verträge | Server-Proxy | image/raw (nach MIME) |
| 3 | `src/app/api/admin/documents/route.ts` | Event-Dokumente (Menü/Programm) | Server-Proxy | image (PDF als image für Vorschau, Fallback raw) |
| 4 | `src/lib/document-forms.ts` `uploadPdf` | Generierte Minijob-Formulare (PDF) | Server-Proxy | raw |
| 5 | `src/lib/cloudinary.ts` `deleteCloudinaryImage` | Löschung/Purge | Server (signed Admin-API) | image (ursprünglich) |
| 6 | `src/app/api/cron/cleanup/route.ts` | Retention/Purge (Staff, Events, Galerien) | Server | nutzt deleteCloudinaryImage |
| 7 | `src/app/actions/staff.ts` | Erasure/Anonymisierung | Server | nutzt deleteCloudinaryImage |
| 8 | `src/app/actions/eventDocuments.ts` `deleteEventDocument` | Dokument löschen | Server (DB only) | **kein** Cloudinary-Purge |
| 9 | `scripts/*` (Migration, Unsplash-Import, Permission-Test) | Ops-Skripte | Server | image/raw |

Kein direkter Browser→Cloudinary-Upload (kein `NEXT_PUBLIC_CLOUDINARY_*`). Alle Uploads laufen über Next.js-Server (relevant für Serverlast, aber kein Client-Secret).

---

## 1) Delivery-Typ (upload vs. authenticated/private)

**Befund: Alle Assets werden als `type=upload` (öffentlich per URL) ausgeliefert.** Es wird nirgends `access_mode=authenticated` oder `type=authenticated/private` gesetzt oder angefordert.

- Uploads in `team/upload/route.ts:33`, `admin/documents/route.ts:35`, `document-forms.ts:156`, `upload.ts` verwenden die Endpunkte `…/image/upload`, `…/raw/upload` ohne `access_mode`-Parameter → Cloudinary-Default = public.
- Delivery erfolgt über `secure_url` (z. B. `https://res.cloudinary.com/<cloud>/image/upload/...`), die direkt abrufbar sind.
- `src/lib/cloudinary.ts:getImageUrl` baut ebenfalls öffentliche Transformations-URLs (`image/upload/...`).

**Konsequenz:** Auch „interne/nicht-öffentliche" Dokumente (`eventDocuments.isPublic=false`, `staffDocuments`, signierte Verträge) sind über ihre URL ohne Authentifizierung abrufbar. Die Vertraulichkeit beruht auf Raten-/UUID-Schutz (Security by Obscurity), nicht auf Zugriffskontrolle.

**Beweis (Delivery-Seite separat geprüft):**
- `src/app/api/team/file/route.ts` implementiert einen Proxy mit Ownership-Check (Admin oder eigener Mitarbeiter) und streamt das Cloudinary-Asset mit `Cache-Control: private, no-store`.
- **Aber:** Der Proxy holt das Asset von der öffentlichen Cloudinary-URL (`fetch(target.toString())`). Wer die Cloudinary-URL kennt (z. B. aus Browser-Netzwerk/Referrer/DB-Leak), umgeht den Proxy und damit den Ownership-Check vollständig. Der Proxy schützt nur vor Enumeration über die App, nicht vor direktem Zugriff.

---

## 2) Serverseitige Signierung der Zugriffs-URLs

**Befund: Zugriffs-URLs werden NICHT signiert.** Es gibt keine signed delivery (keine `s--…--`-Signaturen, keine `auth_token`, keine zeitlich begrenzten URLs). Die `secure_url`s sind permanent und öffentlich.

Signierung existiert nur auf der **Upload**-Seite (signed upload), nicht auf der Delivery-Seite. Das ist der im Task genannte Unterschied „signed UPLOAD ≠ signed DELIVERY".

**TTL:** keine. URLs laufen nicht ab.

**Exposition in Logs/Mails/DB/Referrer:**
- **DB:** `secure_url` wird in `staff_documents.file_url`, `event_documents.file_url/preview_url`, `contracts.signed_file_url`, `events.image_url`, `galleries.image_url` gespeichert (Klartext-URLs). Bei DB-Leak sind alle Assets kompromittiert.
- **Mails:** `src/app/actions/contracts.ts` speichert `signedFileUrl` (Cloudinary-URL); Mails/Tickets? Ticket-Delivery nicht geprüft, aber URLs können in Admin-Views landen.
- **Logs:** `src/app/api/cron/cleanup/route.ts:85,98` loggt bei Fehlern die vollständige Cloudinary-URL (`console.error(..., event.imageUrl)`). `src/lib/cloudinary.ts` loggt URLs bei Parse-Fehlern.
- **Referrer:** `Referrer-Policy: strict-origin-when-cross-origin` (next.config.mjs:52). Beim Öffnen von `target="_blank"` sendet der Browser den Origin als Referrer an Cloudinary. Die volle Pfad-URL (inkl. public_id) landet nicht im Referrer, aber der Origin. Cloudinary sieht den anfragenden Origin. Kein direkter URL-Leak über Referrer, aber Origin-Tracking.
- **Preview-Transformationen** (`previewUrl = secure_url.replace("/upload/", "/upload/pg_1,...")`) sind ebenfalls öffentliche URLs.

---

## 3) Unsigned Upload Presets / API-Secret im Client / Signatur-Erzeugung

**Unsigned Preset:**
- `.env.example:37` und `.env.local:24`: `CLOUDINARY_UPLOAD_PRESET="maurer-events-preset"`.
- `src/app/actions/upload.ts` (vor Fix) nutzte ausschließlich `upload_preset` **ohne** `api_key`/`timestamp`/`signature` → unsigned upload. Preset-Konfiguration (erlaubte Formate, Größen, Folder, Overwrite) liegt nur in der Cloudinary-Console und ist im Repo nicht überprüfbar.
- `scripts/upload_unsplash_to_cloudinary.ts` nutzt ebenfalls unsigned Preset.

**Risiko:** Wenn das Preset nicht auf einen festen Folder/Format eingeschränkt ist oder „unsigned uploads" global erlaubt sind, kann jeder mit dem Cloud-Namen beliebig in den Account hochladen (Storage-Abuse, Malware-Hosting). → Preset in der Console prüfen: unsigned deaktivieren oder auf strikte Bedingungen begrenzen; idealerweise nur signed Uploads.

**API-Secret im Client/Bundle:** Kein `NEXT_PUBLIC_CLOUDINARY_*` gefunden. Secret wird nur serverseitig (`process.env.CLOUDINARY_API_SECRET`) verwendet. **Ausnahme (kritisch):** `scripts/test-cloudinary-permissions.ts:9-10` enthielt einen **hartkodierten API-Key + Secret** (alter Account `873674939743311` / `RZYpKZqDKHAZ12WfQK7Db-lznkg`) im Git-Tracking. → Datei ist in Git; Secret gilt als kompromittiert (Rotation erforderlich, siehe §7). Im Code wurde es auf Env-Variablen umgestellt, aber die Historie bleibt.

**Wer erzeugt die Signatur, mit welcher TTL?**
- `src/app/api/team/upload/route.ts:13-16`, `src/app/api/admin/documents/route.ts:16-19`, `src/lib/document-forms.ts:135-138`: serverseitige SHA-1-Signatur über sortierte Parameter + `apiSecret`. TTL: **keine** – Cloudinary-Upload-Signaturen sind einmalig pro Request (Timestamp aktuell), aber es gibt keine separate Ablaufzeit; der Timestamp wird von Cloudinary gegen Replay geprüft (Standard: wenige Minuten Toleranz). Upload-Signatur ist kurzlebig, aber nicht explizit TTL-basiert.
- `src/app/actions/upload.ts` (nach Fix) ebenfalls serverseitig signiert.

---

## 4) IDOR (Cross-User-Zugriff via public_id/folder/Transformation)

**Befunde:**

a) **Staff-Dokumente:** Ownership-Check existiert in `src/app/api/team/file/route.ts:36` (`doc.staffId !== auth.staffId` → 403). **Aber** wie oben: der Cloudinary-Originallink ist öffentlich; der Check gilt nur für den Proxy. Jeder, der `public_id`/URL kennt, liest das Dokument.

b) **Event-Dokumente:** `getPublicEventDocuments` filtert `isPublic=true`. Intern markierte Dokumente werden in Admin-UI über `fileUrl` (öffentliche Cloudinary-URL) angezeigt; keine serverseitige Zugriffskontrolle auf der Datei.

c) **Transformationen als IDOR-Vektor:** Cloudinary erlaubt beliebige Transformationen auf öffentlichen `public_id`s (z. B. `/upload/fl_attachment/...`, `/upload/pg_1/...`). Ein Angreifer mit bekannter `public_id` kann Formate/Seiten extrahieren, auch wenn die App nur eine transformierte Vorschau zeigt. Beispiele: Event-Dokumente, deren `public_id` in HTML/Netzwerk sichtbar ist.

d) **public_id-Erratbarkeit:** public_ids sind UUIDs (v4) bzw. `minijob-<staffId>` (document-forms.ts:197: `minijob-${staffId}`). Letzteres ist **vorhersagbar** aus der Staff-ID → IDOR/Enumeration möglich, wenn Folder bekannt. `maurer-events/staff/minijob-<uuid>.pdf` ist erratbar.

e) **Folder-Traversal/Injection:** Uploads setzen `folder` serverseitig fest; `public_id` wird aus `crypto.randomUUID()` generiert (außer minijob). Kein User-Input in public_id außer `title` (nur für Dateiname, nicht public_id). Kein offensichtlicher Path-Traversal.

**Fazit IDOR:** Der Ownership-Check im Code ist an der falschen Stelle (Proxy statt Storage). Für echte Vertraulichkeit muss Cloudinary authenticated/private delivery + signierte URLs genutzt werden oder Assets über den Server proxied werden (aktuell nur team/file).

---

## 5) Löschung (Art. 17) – destroy, derived versions, CDN-Invalidierung, Backup/Versionierung

**Befunde:**

a) `deleteCloudinaryImage` (vor Fix): **nur `resource_type=image`**, public_id-Extraktion per Regex `/\/maurer-events\/([^/.]+)/` → brach bei verschachtelten Ordnern (`maurer-events/staff/<uuid>`, `maurer-events/documents/<uuid>`) und bei raw/PDFs. Ergebnis: Löschen von Staff-Dokumenten/PDFs schlug fehl (best effort, still). → Fix: resource_type aus URL ableiten, public_id inkl. verschachtelter Ordner extrahieren, `invalidate=true`.

b) **Derived/transformierte Versionen:** Cloudinary `destroy` löscht standardmäßig auch abgeleitete Ressourcen des Assets. Zusätzlich `invalidate=true` für CDN-Cache. Preview-URLs (`/upload/pg_1,...`) sind Derived des Originals → werden mitgelöscht.

c) **eventDocuments:** `deleteEventDocument` löschte **nur DB-Zeile**, kein Cloudinary-Purge → Waisen-Assets. → Fix: Purge von `fileUrl` + `previewUrl`.

d) **Backup/Versionierung:** Cloudinary behält gelöschte Assets in Backups je nach Plan (Versioning/Backup-Feature) für eine gewisse Zeit; vollständige Löschung (DSGVO Art. 17) kann nicht garantiert werden, solange Cloudinary-Backups/Versionen aktiv sind. → In der Console prüfen: Backup/Versioning deaktivieren oder Retention kurz setzen; ggf. Support-Ticket für hartes Löschen.

e) **Best-effort überall:** Alle Purge-Aufrufe sind `try/catch` mit Stillschweigen → fehlgeschlagene Löschungen werden nicht alarmiert (nur `purgedCloudinary`-Zähler im Cron). Kein Retry/Queue.

f) **Soft-Delete Events:** Cron löscht Events erst nach 7 Tagen und purgt dann Cover/Galeriebilder. Event-Dokumente werden via `onDelete: cascade` aus DB entfernt, aber ihre Cloudinary-Assets werden **nicht** purged (kein Aufruf). → Orphans.

---

## 6) Upload-Validierung

| Aspekt | Status | Beleg |
|--------|--------|-------|
| MIME-Whitelist (Client-Claim) | ✅ | `team/upload:56`, `admin/documents:50`, `upload.ts:16` |
| Magic-Byte-Sniffing | ✅ (nur Team) | `team/upload:74` `sniffMime`, Vergleich mit `file.type` |
| Größe | ✅ | 10 MB Team, 15 MB Admin Docs, 10 MB Bilder |
| Extension | ⚠️ | Keine explizite Extension-Prüfung; MIME-Sniffing deckt Content-Type, Dateiname nicht validiert |
| Malware-Scan | ❌ | Kein Viren-/Malware-Scan (kein Cloudinary-Moderation, kein ClamAV). Cloudinary bietet Add-on (z. B. WebPurify/Amazon Rekognition) – nicht konfiguriert. |
| EXIF/GPS-Entfernung | ⚠️ | `optimizeImage` (sharp) entfernt Metadaten bei optimierten Bildern (sharp strippt EXIF default). **Aber:** Team-Upload sendet Originalbilder unverarbeitet zu Cloudinary → EXIF/GPS bleibt im Original (`secure_url` ohne Transformation). Admin-Dokumente optimieren Bilder → EXIF weg. PDFs/raw bleiben ohnehin. |
| PDF/raw-Handling | ⚠️ | PDFs werden als `resource_type=image` hochgeladen, um Cloudinary-PDF-Delivery (Preview `pg_1`) zu nutzen; Fallback auf `raw`. `object-src 'none'` in CSP; PDF wird nie eingebettet. `admin/documents` prüft PDF-Delivery nicht vorab, sondern fängt Fehler ab. |
| Dateiname-Sanitization | ✅ | public_id = UUID; Originalname nicht verwendet |

---

## 7) Account-Region, AVV/DPF, Plan-Tier

**Nicht aus dem Code ableitbar – manuelle Verifikation erforderlich:**

- **Region/EU:** Cloud-Name `wa9x2ktj` (`.env.local`) gibt keine Region an. Cloudinary speichert standardmäßig in US-Region, sofern kein EU-Addon/Account. → In der Console prüfen: „Data center"/„Storage region". Für DSGVO Art. 44 ff. ist EU-Region oder SCC/DPF notwendig.
- **AVV (DPA):** Cloudinary bietet DPA; muss aktiv unterzeichnet werden. Free-Tier: DPA i. d. R. erst ab bezahltem Plan verfügbar. → Plan-Tier prüfen.
- **Plan-Tier:** `.env`/Docs sprechen von Free (25 Credits/Monat) (`docs/kosten.md`). **Free ohne AVV = kritisch für personenbezogene Daten (Ausweise, Gesundheitszeugnisse, Verträge, Steuer-IDs).**
- **DPF:** Cloudinary ist als US-Anbieter; DPF-Zertifizierung prüfen (Liste des US-Handelsministeriums).
- **Account-Härtung:** API-Key mit „Create assets"-Permission (siehe Fehlerbehandlung in `team/upload`); Root-Key in `test-cloudinary-permissions.ts` (rotieren). Separate Upload-Preset prüfen (unsigned).

**Bereits geleakte Credentials:** `scripts/test-cloudinary-permissions.ts` enthielt Key/Secret eines Cloudinary-Accounts (alt). Auch wenn `.env.local` andere Werte nutzt, gilt das Secret als kompromittiert → in Cloudinary rotieren und Git-Historie bereinigen.

---

## 8) Upload-Pfad (Browser → Cloudinary vs. Server-Proxy)

**Befund: Alle Uploads laufen über den Next.js-Server (Server-Proxy).** Kein direkter Browser→Cloudinary.

- `src/app/actions/upload.ts` (Server Action), `src/app/api/team/upload/route.ts`, `src/app/api/admin/documents/route.ts`, `src/lib/document-forms.ts` (Server).
- Vorteil: Secret bleibt serverseitig, zentrale Validierung.
- Nachteil: Serverlast/Bandbreite (Dateien werden zweimal übertragen: Client→Server→Cloudinary). Relevant für Vercel/Coolify-Limits (4.5 MB Vercel Body Limit → `serverActions.bodySizeLimit: '4mb'` in next.config; Team-Route prüft `content-length`).

---

## Zusammenfassung kritischer Findings (priorisiert)

1. **Hardcoded Cloudinary-Secret in Git** (`scripts/test-cloudinary-permissions.ts`) – Rotation + History-Rewrite. (Kritisch)
2. **Unsigned Upload Preset aktiv** (`CLOUDINARY_UPLOAD_PRESET`) ohne sichtbare Einschränkungen – Missbrauch möglich. (Hoch)
3. **Keine signed/authenticated Delivery** → alle Dokumente öffentlich per URL; Ownership-Check nur am Proxy, leicht umgehbar. (Hoch)
4. **IDOR:** `minijob-${staffId}` public_id erratbar; Transformationen auf öffentlichen IDs möglich. (Mittel-Hoch)
5. **EXIF/GPS** bleibt bei Team-Upload-Originalbildern erhalten. (Mittel)
6. **Malware-Scan fehlt.** (Mittel)
7. **Art. 17 nicht wirksam:** `deleteEventDocument` purgte nicht; `deleteCloudinaryImage` brach bei raw/nested; Event-Dokumente bei Event-Löschung nicht purged; Backups/Versioning in Cloudinary unbekannt. (Hoch) – teilweise gefixt.
8. **Free-Tier ohne AVV** für sensible Personaldaten. (Kritisch, rechtlich)
9. **URLs in DB/Logs** (Klartext, permanent). (Mittel)
10. **Kein Retry/Alerting** bei fehlgeschlagenem Purge. (Niedrig-Mittel)

## Empfohlene nächste Schritte

- Cloudinary-Account: Region/EU, Plan (mind. bezahlt für DPA), DPA unterzeichnen, DPF prüfen.
- Unsigned Preset deaktivieren oder strikt einschränken (Folder/Format/Größe); Migration auf signed-only.
- Rotieren des geleakten API-Secrets; Git-Historie bereinigen.
- Für vertrauliche Dokumente: authenticated/private delivery + signierte URLs mit kurzer TTL oder Server-Proxy für alle Dokumenttypen.
- Malware-Scan-Add-on oder serverseitige Prüfung (ClamAV) für Uploads.
- EXIF-Stripping für alle Bild-Uploads (sharp vor Upload), auch Team-Route.
- Event-Dokumente bei Event-Löschung purgen; Orphan-Cleanup-Job.
- Backups/Versioning in Cloudinary deaktivieren oder Retention kurz setzen; Löschbestätigung einholen.

## Durchgeführte Code-Fixes (dieses Audit)

- `src/lib/cloudinary.ts`: `deleteCloudinaryImage` unterstützt jetzt raw/video, verschachtelte Ordner, `invalidate=true`.
- `src/app/actions/eventDocuments.ts`: `deleteEventDocument` purgt Cloudinary-Assets (fileUrl + previewUrl).
- `src/app/actions/upload.ts`: Admin-Bildupload von unsigned Preset auf signierten Upload umgestellt.
- `scripts/test-cloudinary-permissions.ts`: hartkodierte Credentials durch Env-Variablen ersetzt.

Verbleibende Härtung (authenticated delivery, Malware-Scan, EXIF in Team-Route) erfordert größere Änderungen und ist als Follow-up geplant.