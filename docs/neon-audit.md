# Neon-Nutzungsaudit – Maurer Events

Stand: 14. November 2026. Quellen: Repository-Stand (Code, Migrationen, Dokumentation),
`.env.local` (nicht committed, nur für diese Prüfung gelesen), `docs/privacy-review.md`,
`docs/retention-matrix.md`, `docs/deployment.md`, `docs/coolify.md`. Kein Zugriff auf das
Neon-Dashboard, keine Live-Abfrage der Neon-API. Punkte, die im Repository nicht belegbar
sind, sind als **VERIFIZIEREN** mit konkreter Prüffrage markiert.

## 1) Region des Prod-Projekts (EU?) und AVV-Vertragspartner (Neon / Konzernzugehörigkeit)

**Befund (belegt im Code/Doku):**

- Verbindungs-Host (`.env.local`): `ep-quiet-recipe-as7mmk4o-pooler.c-4.eu-central-1.aws.neon.tech`
  → Region **eu-central-1 (AWS Frankfurt)**. Das ist eine EU-Region.
- Vercel-Region in `vercel.json`: `fra1` (Frankfurt) – konsistent mit Neon-Region.
- `docs/privacy-notice.ts`: „PostgreSQL-Datenbank des Dienstes Neon, der zur Databricks-Gruppe
  gehört“; Neons Datenschutzseite verweist auf Databricks. Konzernzugehörigkeit: **Neon, LLC
  als Teil der Databricks-Gruppe** (`docs/privacy-review.md`, Zeile 68–69).
- `docs/konzept-2026-erweiterungen.md` Zeile 890: „AVV mit Neon, Cloudinary, Resend, Hosting;
  EU-Region wo möglich, sonst SCC/DPF prüfen.“ → AVV ist als To-do gelistet, nicht als
  abgeschlossen.

**VERIFIZIEREN:**

- Ist das **Produktionsprojekt** (nicht nur Staging/`.env.local`) tatsächlich in `eu-central-1`
  angelegt, oder existiert ein separates Prod-Projekt in einer anderen Region?
  Prüffrage an Betreiber/Neon-Konsole: „Welche Region hat das Produktionsprojekt
  `maurer-events` (Project ID aus Dashboard)? Gibt es mehrere Projekte (Staging/Prod)
  in unterschiedlichen Regionen?“
- Existiert ein **unterschriebener Auftragsverarbeitungsvertrag (Art. 28 DSGVO)** mit
  Neon/Databricks für diesen Betreiber? Code/Doku belegen keinen Vertrag.
  Prüffrage: „Ist der DPA von Neon/Databricks für Account/Organisation abgeschlossen
  und liegen SCC/DPF-Garantien (Zertifizierung) vor? Welche Unterauftragnehmer (AWS) sind
  gelistet?“
- Supportzugriff aus Drittländern: Welche Neon-Support-/Ops-Rollen haben Zugriff auf
  Prod-Daten? Prüffrage an Neon: „Gibt es einen Zero-Access-/Customer-Managed-Key-Modus
  oder Support-Zugriff auf Daten?“

## 2) Branching: Dev-/Preview-/Test-Branches mit Produktionsdaten?

**Befund (belegt im Code/Doku):**

- Im Repository gibt es **keine Referenz** auf Neon-Branches, Preview-Branches oder
  Branch-URLs. `DATABASE_URL` ist ein einzelner Wert; keine Branch-IDs, keine
  `neonctl`-Aufrufe, kein Branching-Workflow in CI/Docs.
- `docs/coolify.md`/`deployment.md` beschreiben Staging und Produktion als **getrennte
  Datenbanken** („getrennte Staging- und Produktionsdatenbanken“), kein Branching.
- `docs/privacy-review.md`: „Kein Datenbank- oder Provider-Schreibzugriff für diese
  Prüfung.“ Keine Branch-Nutzung dokumentiert.

**VERIFIZIEREN:**

- Werden in der Neon-Konsole **Branches** (dev/preview/test) angelegt, und enthalten
  diese **Produktionsdaten** (Kopie des Prod-Branches)? Wenn ja: Zugriff (wer darf
  verbinden?), TTL (automatisches Löschen?), Bereinigung/Anonymisierung vor dem
  Branchen, Audit-Log der Branch-Erstellung?
  Prüffrage: „Liste aller Neon-Branches des Projekts mit Erstellungsdatum, Eltern-Branch,
  TTL, Zugriffsrollen. Enthalten Nicht-Prod-Branches Personenbezug aus Prod? Gibt es
  eine Anonymisierungspipeline vor dem Branchen?“
- Preview-Deployments auf Vercel (Hobby/Pro) nutzen welche `DATABASE_URL`? Falls ein
  Preview-Branch mit Prod-Daten angebunden ist → Datenleck-Risiko.
  Prüffrage: „Welche DATABASE_URL ist in Vercel-Preview-Umgebung gesetzt? Ist sie
  getrennt von Prod?“

## 3) PITR/History-Retention: Wie lange bleiben gelöschte Daten in Backups? Verfahren „Restore → erneut löschen“ für Art. 17?

**Befund (belegt im Code/Doku):**

- Keine Erwähnung von PITR, Backup-Aufbewahrung oder Restore-Verfahren im Repository
  oder in den Docs. `docs/deployment.md` Zeile 133: „Sicherungsintervall, PITR-Aufbewahrung,
  Wiederherstellungszeit, Alarmempfänger und Zuständigkeiten vor Livebetrieb festlegen.“
  → ausdrücklich **offen**.
- `docs/coolify.md` Zeile 136–138: bei Netcup „Tägliche verschlüsselte Backups … passende
  Aufbewahrung und Wiederherstellungsproben“. Keine konkreten Fristen.
- Anwendungsseitig: Soft-Delete (`events.deletedAt`), Hard-Delete nach 7 Tagen für
  Events ohne Reservierungen (`cron/cleanup`). Staff-Anonymisierung nach 10 Jahren.
  Aber: gelöschte Zeilen leben in Neon-PITR weiter (außerhalb App-Kontrolle).

**VERIFIZIEREN:**

- Neon-PITR-Aufbewahrungsdauer des gewählten Tarifs (Free: 7 Tage / Launch/Scale: bis
  30 Tage) und ob History/Point-in-Time-Restore aktiv ist.
  Prüffrage: „Welcher Neon-Tarif läuft für Prod? Ist PITR aktiv und wie lange? Gibt es
  zusätzlich Snapshots/Backups?“
- Existiert ein dokumentiertes Verfahren „Restore → erneut löschen“ für Art.-17-Anfragen
  (Betroffenenlöschung), das Neon-Backups/PITR berücksichtigt? Code belegt keines.
  Prüffrage: „Ist im Löschkonzept festgelegt, dass nach einem Restore aus Backup/PITR
  die zuvor gelöschten personenbezogenen Daten erneut gelöscht/anonymisiert werden?
  Wer ist verantwortlich, wie wird nachgewiesen?“
- Gibt es einen Prozess, um Neon-Backups vorzeitig zu löschen/anonymisieren (z. B.
  bei Art.-17-Anfrage innerhalb der Aufbewahrungsfrist)? Neon erlaubt das typischerweise
  nicht granular → Restrisiko dokumentieren.

## 4) Connections: sslmode, pooled vs. direct endpoint, Pool-Größe, Limits, Autosuspend/Cold-Start

**Befund (belegt im Code):**

- `src/db/index.ts`: `postgres(databaseUrl, { max: 5, prepare: false, connect_timeout: 30,
  idle_timeout: 20, max_lifetime: 60*30 })`. Pool-Größe **5** pro App-Instanz.
- `prepare: false` wegen Transaction-Pooler (Neon). Tabellen/Enums explizit `public.`
  qualifiziert (Migration 0007), weil Neon-Pooler leeren `search_path` liefern kann.
- `scripts/db-migrate.mjs`: `max: 1, prepare: false, connect_timeout: 10` – Migrationen
  laufen über **direkte** Verbindung (Doku: „Keine Transaction-Pooler-URL für
  Migrationslauf“).
- `.env.local`: URL nutzt **Pooler-Endpunkt** (`…-pooler.c-4.eu-central-1…`) mit
  `sslmode=require&channel_binding=require`. `.env.example` fordert `sslmode=require`
  für externen Neon, TLS-Checks nicht deaktivieren.
- `connect_timeout: 30` mit Kommentar „Neon (Free) braucht beim Aufwachen aus dem
  Leerlauf oft >5s“ → **Autosuspend/Cold-Start** des Free-Tiers ist aktiv und wird im
  Code adressiert.
- `vercel.json`: Function `maxDuration` 300s (cleanup) / 60s (webhook) – relevant für
  lange DB-Operationen bei Cold-Start.
- Autosuspend: Neon Free Tier suspendiert nach Inaktivität; Cold-Start-Latenz wird im
  Code toleriert (30s Timeout). Für Produktion potenziell UX-Problem.

**VERIFIZIEREN:**

- Ist in Prod wirklich der **Pooler-Endpunkt** (`-pooler`) in `DATABASE_URL` gesetzt
  (nicht der direkte)? Und die Migrations-`DATABASE_URL` der **direkte** Endpunkt?
  Prüffrage: „Vercel/Coolify-Env-Variablen prüfen: Pooler-URL für Runtime, direkte
  URL nur für Migrationen.“
- Neon-Verbindungslimits des Tarifs vs. App-Instanzen × `max: 5`. Bei mehreren
  Instanzen kann das Limit erreicht werden. Prüffrage: „Neon compute size und max
  connections des Tarifs; Anzahl App-Instanzen in Prod.“
- `channel_binding=require` ist in `.env.local` gesetzt, aber `.env.example` erwähnt
  es nicht. Konsistenz prüfen: Unterstützt der Treiber `channel_binding=require`
  stabil? (Bereits im Betrieb belegt durch Staging.)
- Autosuspend in Prod deaktivieren (Paid Compute) für stabile Latenz? Prüffrage:
  „Ist Autosuspend in Prod aktiv? Sollte für echten Verkauf deaktiviert werden?“

## 5) DB-Rollen: least privilege (App vs. Migration), Credentials in Env/CI, Rotation

**Befund (belegt im Code/Doku):**

- Ein einziger `DATABASE_URL` mit User `neondb_owner` (`.env.local`) – d. h. die App
  läuft mit **Owner-Rechten**. Keine Trennung App-Rolle vs. Migration-Rolle im Code.
- Migrationen nutzen denselben User mit `max: 1` und Advisory Lock – kein separater
  Migrations-User.
- Credentials liegen in Env (Vercel/Coolify), `.env.local` (gitignored, aber im
  Arbeitsverzeichnis vorhanden – bei dieser Prüfung gelesen). `.env.example` als
  Template. Keine Secrets im Repo (gitignore prüfen).
- Rotation: keine Dokumentation. `AUTH_SECRET`, `CRON_SECRET`, `STAFF_DATA_KEY` jeweils
  separate Secrets (gut). DB-Passwort-Rotation nicht beschrieben.

**VERIFIZIEREN / Befund (Verbesserungsbedarf):**

- Least privilege nicht umgesetzt: App sollte mit einer Rolle laufen, die nur
  DML auf die benötigten Tabellen hat (kein DDL, kein `neondb_owner`). Migrationen
  mit separatem Admin-User.
  Prüffrage: „Existiert eine dedizierte App-Rolle mit eingeschränkten Grants? Werden
  Migrationen mit Owner-User ausgeführt?“
- Credential-Rotation-Prozess für DB-Passwort und Secrets dokumentieren. Prüffrage:
  „Wie oft wird das DB-Passwort rotiert? Gibt es einen Runbook-Schritt?“
- CI/CD: Wo wird `DATABASE_URL` für Migrationen gespeichert (GitHub Secrets, Coolify
  Env)? Wer hat Zugriff? Prüffrage: „Zugriffsmatrix auf Secrets; Audit-Log von
  Secret-Zugriffen.“
- `.env.local` im Arbeitsverzeichnis enthält echte Credentials – sicherstellen, dass
  diese Datei nicht committed wird (`.gitignore` prüfen) und nach dieser Prüfung
  nicht weiter verteilt wird.

## 6) Liegen Daten in Neon, die dort nicht gehören (Dokumente als base64, Ausweisnummern im Klartext)?

**Befund (belegt im Code):**

- **Keine base64-Dokumente** in der DB: Suche nach `base64` in `src/` ergab nur
  `src/lib/robotoBase64.ts` (Schriftdatei für PDF-Rendering, nicht personenbezogen).
- Ausweisnummern: keine Spalte `id_number`/`passport` im Schema. Ausweiskopien liegen
  als Dateien bei **Cloudinary** (`staff_documents.fileUrl`, Ordner `maurer-events/staff`),
  in Neon nur URL + Metadaten. `src/privacy-notice.ts`: „Dateien liegen bei Cloudinary“.
- `ticket_email_payload` (jsonb) enthält Versandpayload (Gastdaten) – gehört in Neon
  (Versandstatus/Retry), akzeptabel.
- `checkout_params` (jsonb) in `reservations` – Buchungseingaben, gehört in Neon.
- `settings.value` (text, JSON) – Konfiguration, kein Personenbezug.
- `fest_opportunities` – öffentliche Festdaten + Kontaktdaten von Organisatoren
  (geschäftlich, nicht personenbezogen im DSGVO-Sinne i. d. R.).
- `customerImports.report` (jsonb) – Import-Report, kann PII enthalten; Retention 1 Jahr
  (`retention.ts`).

**VERIFIZIEREN:**

- Prüfen, ob in `staff_documents.note` oder anderen Freitextfeldern versehentlich
  Ausweisnummern/IBANs im Klartext stehen (Datenqualitätsprüfung).
  Prüffrage: „SQL-Audit: `SELECT … FROM staff WHERE tax_id_enc IS NULL` etc.; Suche nach
  Mustern von Ausweis-/SV-Nummern in Freitextfeldern.“
- Prüfen, ob `ticket_email_payload`/`checkout_params` mehr Daten enthalten als nötig
  (Datensparsamkeit, Art. 5 Abs. 1 lit. c).

## 7) Verschlüsselung at rest / Feldverschlüsselung für Art.-9-Felder

**Befund (belegt im Code):**

- Feldverschlüsselung: `src/lib/secure-fields.ts` – AES-256-GCM mit Key aus
  `STAFF_DATA_KEY` (SHA-256-Hash des Env-Werts). Verschlüsselt: `taxIdEnc`,
  `socialSecurityEnc`, `ibanEnc` (Schema `staff`). `maskField` für Anzeige.
  `docs/privacy-notice.ts`: „Steuer-ID, Sozialversicherungsnummer und IBAN werden mit
  AES-256-GCM verschlüsselt gespeichert.“
- Passwörter: scrypt (laut Doku), OTP-Codes als HMAC-Prüfwert.
- **Nicht verschlüsselt** (Klartext in Neon): `birthDate`, `healthInsurance`,
  `taxClass`, `childAllowances`, `hourlyRateCents`, `monthlySalaryCents`, `street`,
  `zip`, `city`, `phone`, `email`, `firstName`, `lastName`, `bic`, `entryDate`,
  `exitDate`, Gesundheitszeugnis-Dateien (Cloudinary). Gesundheitsdaten (Art. 9)
  werden als Dateien bei Cloudinary gespeichert (nicht verschlüsselt auf Feldbasis).
- Verschlüsselung at rest auf Neon-Ebene: nicht im Code/Doku belegbar (Neon bietet
  standardmäßig Verschlüsselung at rest, aber Verifizierung fehlt).

**VERIFIZIEREN:**

- Neon at-rest-Verschlüsselung: Algorithmus, Key-Management (Neon-managed vs.
  customer-managed), Region. Prüffrage: „Neon-Doku/Account: Encryption at rest aktiv?
  Welcher KMS? Gibt es CMEK?“
- Sollten weitere Art.-9-Felder (Geburtsdatum, Gesundheitszeugnis, Krankenkasse)
  feldverschlüsselt werden? Aktuell nur 3 Felder. Prüffrage an Datenschutzbeauftragten:
  „Ist Klartext-Speicherung von Geburtsdatum/Krankenkasse in Neon akzeptabel, oder
  Feldverschlüsselung erforderlich?“
- Key-Rotation für `STAFF_DATA_KEY`: Wie wird bei Rotation neu verschlüsselt?
  Aktuell kein Re-Encryption-Job. Prüffrage: „Gibt es ein Verfahren zur
  Schlüsselrotation mit Re-Encryption?“

## 8) Existieren Löschjobs technisch (cron/worker), idempotent und protokolliert?

**Befund (belegt im Code):**

- **Ja, technisch vorhanden:**
  - `src/app/api/cron/cleanup/route.ts`: `GET /api/cron/cleanup` (CRON_SECRET),
    maxDuration 300s.
  - `src/lib/retention.ts`: `runRetentionCleanup()` – 4 Schritte (ID-/Gesundheits-Purge
    nach 365 Tagen, 10-Jahres-Anonymisierung, Invites/Sessions/Payroll/Imports,
    differenzierte Audit-Fristen).
  - `scripts/run-cleanup.mjs` + `npm run cron:cleanup` für Coolify Scheduled Task
    (`*/5 * * * *`).
  - Vercel: externer Scheduler oder Vercel-Cron (Doku). Kein Hobby-Cron im Repo.
- **Idempotenz:**
  - `runRetentionCleanup` erkennt bereits anonymisierte Sätze über E-Mail-Marker
    (`anonymized-…@deleted.invalid`) und überspringt sie.
  - Delete-Operationen sind idempotent (DELETE WHERE …).
  - **Nicht idempotent/robust:** Cloudinary-Purge ist best-effort, Fehler werden
    geschluckt (`catch { /* best effort */ }`); keine Wiederholung bei Fehlschlag.
    `purgedCloudinary`-Zähler wird zurückgegeben, aber nicht persistiert.
  - Ticket-Retry und Event-Cleanup sind nicht idempotent bezüglich Partial-Failures
    (z. B. DB-Delete erfolgreich, Cloudinary-Purge fehlgeschlagen → verwaiste Datei).
- **Protokollierung:**
  - Cron-Route gibt JSON mit Zählern zurück (`updatedReservationsCount`,
    `purgedCloudinary`, `retention`). Keine Persistenz des Laufs (kein AuditLog-Eintrag
    für „cleanup.run“).
  - Fehler: `console.error` + HTTP 500. Keine strukturierte Protokollierung, keine
    Alarmierung im Code (Doku verlangt Monitoring).
  - Retention-Matrix: AuditLog-Einträge für `staff.*`, `payroll.*`, `contract*` werden
    nach 10 Jahren gelöscht – d. h. die Audit-Spur der Löschung selbst hat eine Frist.
- **Weitere Löschmechanismen:**
  - `reconcileExpiredReservations` (Stripe-Holds).
  - Admin-Auth/Sessions/Rate-Limits werden bei jedem Cron-Lauf gelöscht (abgelaufen).
  - Soft-deleted Events nach 7 Tagen (nur wenn keine Reservierungen).
  - Staff-Sessions sofort bei Status `inactive`.

**VERIFIZIEREN / Verbesserungsbedarf:**

- Gibt es einen persistenten Lauf-Log (Tabelle `cleanup_runs` o. ä.) mit Start/Ende,
  Status, Zählern? Aktuell nein → empfohlen für Nachweisbarkeit (Art. 5 Abs. 2
  Rechenschaftspflicht).
- Cloudinary-Purge bei Fehlschlag wiederholen (Retry-Queue / DLQ) statt best-effort.
- Monitoring/Alarmierung für ausbleibende Cron-Läufe (Doku erwähnt es, Code nicht).
- Idempotenz des gesamten Cron-Laufs bei Partial-Failure (z. B. Transaktionen um
  DB-Deletes + Cloudinary-Purge).
- Prüffrage: „Läuft der Cron in Prod tatsächlich alle 5 Minuten? Werden Fehler
  alarmiert? Gibt es Runbook?“

## Zusammenfassung der Risiken (Priorität)

1. **AVV mit Neon/Databricks nicht belegt** → vor Livebetrieb abschließen und dokumentieren.
2. **Neon-Branching mit Prod-Daten** → nicht belegbar; prüfen, ob Preview-Branches
   personenbezogene Daten enthalten.
3. **PITR/Backup-Retention** → Fristen und Restore→Löschen-Verfahren fehlen; für
   Art. 17 relevant.
4. **DB-Rolle `neondb_owner` für App** → Least privilege nicht umgesetzt.
5. **Autosuspend (Free Tier)** → Cold-Start-Latenz; für Produktion prüfen.
6. **Löschjobs nicht persistiert protokolliert** → Rechenschaftspflicht (Art. 5
   Abs. 2) nicht vollständig nachweisbar; Cloudinary-Purge best-effort.
7. **Art.-9-Felder teils Klartext** (Geburtsdatum, Krankenkasse, Gesundheitszeugnis
   als Datei) → Datenschutzbeauftragten fragen, ob Feldverschlüsselung nötig.
8. **Key-Rotation für `STAFF_DATA_KEY`** nicht implementiert.

## Empfohlene nächste Schritte

1. Neon-Dashboard prüfen: Region, Tarif, PITR, Branches, Compute-Limits, Autosuspend.
2. AVV mit Neon/Databricks abschließen und in `docs/privacy-review.md` vermerken.
3. Dedicated App-Rolle + separaten Migrations-User anlegen; `DATABASE_URL` umstellen.
4. `cleanup_runs`-Tabelle + persistente Protokollierung + Alarmierung.
5. Löschkonzept erweitern um „Restore → erneut löschen“ für Art. 17.
6. Datenschutzbeauftragten zu Art.-9-Feldverschlüsselung befragen.
7. `.env.local` aus Arbeitsverzeichnis entfernen nach Abschluss dieser Prüfung (enthält
   echte Credentials).
