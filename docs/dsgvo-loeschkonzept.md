# DSGVO-Löschkonzept und Betroffenenrechte – maurer-events

Stand: 14. November 2026. Quellen: `docs/retention-matrix.md`, `docs/privacy-review.md`, `docs/konzept-2026-erweiterungen.md` (§ 11), `docs/neon-audit.md`, `src/lib/retention.ts`, `src/lib/retention-policy.ts`, `src/app/api/cron/cleanup/route.ts`, `src/app/actions/staff.ts`, `src/app/actions/customers.ts`, `src/app/actions/career.ts`, `src/app/actions/contact.ts`.

## 1. Löschkonzept (Tabelle)

| Datenkategorie | Frist | Auslöser | Aufbewahrungsgrundlage | technischer Löschort (Neon, Cloudinary, Backup, Mail, Log) | Umsetzung |
| --- | --- | --- | --- | --- | --- |
| Bewerbungen (E-Mail + Anhang) | 6 Monate nach Absage/Eingang (Beweissicherung; AGG-Schadensersatzverjährung 2 Monate) | Bewerbung nicht berücksichtigt oder 6 Monate seit Eingang; keine Einstellung | Art. 6 Abs. 1 lit. b DSGVO (Bewerbungsverfahren); Art. 17; AGG § 15 (Beweislast) | Mail: Empfänger-Postfach + Resend (keine DB); Log: Mail-/Zugriffslogs; Backup: Mailbox-Backup | nicht automatisiert; manuelle Postfach-Bereinigung + Dokumentation; keine API |
| Kontaktanfragen | 30 Tage nach Event bzw. 90 Tage nach Anfrage | Anfrage bearbeitet/abgeschlossen oder Event vorbei + Frist | Art. 6 Abs. 1 lit. b/f; Art. 5 Abs. 1 lit. c/e | Mail: Postfach + Resend; Log: Vercel/Resend-Logs | nicht automatisiert; Postfach-Retention fehlt |
| Reservierungen ohne Rechnungsbezug (pending/expired/cancelled/declined, Warteliste, Scanner-Zugänge) | 30 Tage nach Event bzw. 90 Tage nach Anfrage; Warteliste Event + 3 Monate; Scanner-Zugang bei Ablauf sperren und innerhalb 30 Tagen löschen | Status terminal oder Eventende + Frist; `validUntil` abgelaufen | Art. 6 Abs. 1 lit. b; Art. 5 Abs. 1 lit. c/e | Neon: reservations, waitlists, scanner_access, security_rate_limits, ticket_email_payload; Log: Audit/Access-Logs; Mail: Ticket-E-Mail (falls versendet) | teilweise: Reconcile ändert Status, aber keine Löschung; Cron löscht security_rate_limits; waitlists/scanner_access/password_resets nicht bereinigt |
| Reservierungen mit Rechnungsbezug (paid/confirmed/refunded/disputed) | 6 Jahre Buchungsbelege / 10 Jahre Bücher und Aufzeichnungen nach Geschäftsjahresende | Geschäftsjahresende + Frist; keine offenen Ansprüche | § 257 HGB, § 147 AO; Art. 6 Abs. 1 lit. c | Neon: reservations, customers, vouchers, ticket_email_payload, pdfUrl; Cloudinary: Ticket-PDF falls gespeichert; Mail: Ticket-E-Mail; Backup: Neon PITR/logische Backups | fehlt automatisiert; keine Anonymisierung nach Frist; nur manuelle/Soft-Delete |
| Kundenstamm | solange Geschäftsbeziehung + gesetzliche Fristen (6/10 Jahre nach letzter Buchung) | letzte Buchung + Frist oder manuelle Löschung | Art. 6 Abs. 1 lit. b/c; §§ 257 HGB, 147 AO | Neon: customers (Soft-Delete `deletedAt`); Backup | teilweise: Soft-Delete; keine automatische Löschung/Anonymisierung |
| Lohn-/Steuer-/SV-Daten und Verträge (Staff-PII) | 10 Jahre nach Austritt/Geschäftsjahresende | `exitDate` + 3650 Tage (Code) bzw. Geschäftsjahresende + 10 Jahre | §§ 257 HGB, 147 AO; Art. 6 Abs. 1 lit. c; Art. 9 | Neon: staff, contracts, staff_documents; Cloudinary: Dokumente/unterschriebene Verträge; Backup | vorhanden: `runRetentionCleanup` anonymisiert nach 3650 Tagen; Cloudinary-Purge best effort; idempotent per E-Mail-Marker; Cron |
| Ausweis-/Gesundheitsnachweise (Staff) | Austritt + 365 Tage | `exitDate` + 365 Tage | Art. 9 Abs. 2 lit. b; § 22 BDSG | Neon: staff_documents; Cloudinary: Datei | vorhanden: ID-Doc-Purge + Cloudinary-Purge best effort |
| Sessions, Invites, Auth, Passwort-Reset, Rate-Limits | sofort bei Ablauf/Inaktivsetzung; Sessions bei Inaktivsetzung sofort | `validUntil`/`expiresAt` abgelaufen; Status inactive | Art. 6 Abs. 1 lit. f; § 26 BDSG; Art. 32 TOM | Neon: staff_sessions, staff_invites, admin_sessions, admin_auth, staff_password_resets, security_rate_limits; Log | teilweise: Cron löscht adminAuth/adminSessions/securityRateLimits; `runRetention` löscht expired staffInvites/staffSessions; password_resets nicht bereinigt |
| Audit-Logs | allgemein 1 Jahr; staff/payroll/contract 10 Jahre | createdAt + Frist; differenziert nach Action-Prefix | Art. 5 Abs. 1 lit. e; §§ 257/147 für Personal-Audits | Neon: audit_log; Log | vorhanden: Löschung nach Action-Prefix; keine Löschprotokollierung/Archivierung der Löschung selbst |
| Payroll-Export-Metadaten und Kundenimporte | 1 Jahr nach Erstellung/Nutzung | createdAt/usedAt + 365 Tage | Art. 5 Abs. 1 lit. c/e | Neon: payroll_exports, customer_imports | vorhanden: `runRetentionCleanup` |
| Soft-gelöschte Events und Galeriebilder | 7 Tage nach Soft-Delete, nur wenn keine Reservierungen | `deletedAt` + 7 Tage und keine Reservierungen | Art. 5 Abs. 1 lit. c/e | Neon: events, galleries; Cloudinary: Cover + Galeriebilder | vorhanden: Cron hard delete + Cloudinary purge |
| Cloudinary-Medien (allgemein) | mit referenzierendem Datensatz/Event oder bei Löschjob | Löschung des referenzierenden Datensatzes | Art. 5 Abs. 1 lit. c; AVV Cloudinary | Cloudinary: Asset + CDN-Cache; Backup: Cloudinary-Backups/Versionen (falls aktiv) | teilweise: destroy mit `invalidate=true`; Backups/Versionen nicht explizit; Legacy Vercel Blobs nicht löschbar |
| Vercel/Neon-Logs und providerseitige Logs | Provider-Retention (Vercel/Neon) i. d. R. kurz; Anwendungsaudit 1 Jahr | Provider-Zyklus; Cron für audit_log | Art. 5 Abs. 1 lit. e; Art. 32 | Log: Vercel Runtime Logs, Neon Logs; Backup | nicht steuerbar im Code; Runbook/Provider-Einstellung erforderlich |
| Neon PITR/Backups | PITR-Fenster (z. B. 7/30 Tage) + Backup-Retention | Restore/Backup-Zyklus; keine granulare Löschung | Art. 17 (Restrisiko), Art. 32 | Backup: Neon PITR/Snapshots/logische Backups | nicht umsetzbar granular; Verfahren „Restore → erneut löschen“ + Dokumentation erforderlich |
| Mail-Postfach (eingehende Bewerbungen/Kontakt, versandte Tickets) | nach Kategorie-Frist (6 Monate Bewerber; 30/90 Tage Kontakt; finanzrelevante Belege 6/10 Jahre) | manuelle/organisatorische Bereinigung des Postfachs | Art. 5 Abs. 1 lit. c/e; §§ 257/147 für finanzrelevante Mails | Mail: Postfach (`servus@...`) + Resend-Dashboard/Retention; Neon: ticket_email_payload | nicht automatisiert; kein Resend-Delete-API-Nachweis; Runbook erforderlich |

## 2. Umsetzungsprüfung

### 2.1 Automatisierte Löschjobs

- Vorhanden: `GET /api/cron/cleanup` (`src/app/api/cron/cleanup/route.ts`) mit `CRON_SECRET`; `scripts/run-cleanup.mjs` als Aufrufer; `runRetentionCleanup()` (`src/lib/retention.ts`).
- Nicht im Repo deklariert: kein `crons`-Block in `vercel.json`. Scheduler (Vercel Cron, Coolify, GitHub Actions) muss extern eingerichtet und überwacht werden.
- Abgedeckt: ID-/Gesundheitsdokumente, 10-Jahres-Anonymisierung Staff, expired Invites/Sessions, Payroll-Exports, Customer-Imports, Audit-Logs, Soft-Delete-Events + Cloudinary.
- Nicht abgedeckt: `scanner_access` abgelaufen, `staff_password_resets` abgelaufen, `waitlists` nach Event, Kundenanonymisierung, Reservierungsanonymisierung nach Finanzaufbewahrung, Bewerber-/Kontakt-Mails, Legacy-Vercel-Blobs.

### 2.2 Idempotenz

- Staff-Anonymisierung ist idempotent über E-Mail-Marker `anonymized-<id>@deleted.invalid` und Überspringen bereits anonymisierter Sätze.
- Datumsbasierte Deletes sind bei Wiederholung harmlos.
- Lücke: Cloudinary-Purge ist best effort und nicht wiederholbar, weil URLs nach dem DB-Delete nicht mehr verfügbar sind. Fehlgeschlagene URLs gehen verloren (`purgedCloudinary` zählt nur Erfolge).
- Lücke: Cleanup ist nicht transaktional über Phasen hinweg; Teilausfälle können inkonsistente Zwischenstände hinterlassen.

### 2.3 Protokollierung

- `staff.erasure`, `staff.partial_erasure`, `staff.hard_delete_dev` werden in `audit_log` protokolliert.
- Cron-Route gibt Zähler zurück, schreibt aber keinen Audit-Eintrag und keine Run-ID.
- Cloudinary-Fehler werden still geschluckt (`catch { /* best effort */ }`).
- Kein Fristen-/Überfälligkeits-Monitoring für Betroffenenanfragen (existiert derzeit nicht).

### 2.4 Wirksamkeit in Cloudinary, Neon-PITR und Mail-Postfach

- Cloudinary: `deleteCloudinaryImage()` nutzt `destroy` mit `invalidate=true` und erkennt `image/raw/video`. Wirksam für das Primärasset und CDN-Cache. Nicht abgedeckt: Cloudinary-Backups/Versionen (falls aktiv), abgeleitete Transformationen außerhalb der invalidierten URL, Legacy Vercel Blob URLs (Funktion gibt `false` zurück).
- Neon: `DELETE` entfernt Zeilen aus der primären Datenbank. In PITR/Snapshots leben sie für das konfigurierte Fenster (Free typisch 7 Tage, Launch/Scale bis 30 Tage) weiter. Granulares Löschen von PITR ist nicht möglich. Erforderlich: dokumentiertes Verfahren „Restore → erneut löschen/anonymisieren“ sowie Prüfung des Tarifs.
- Mail: Resend-versandte E-Mails und das Empfänger-Postfach sind nicht über die Anwendung löschbar. `ticket_email_payload` liegt zusätzlich in Neon. Bewerbungen/Kontakt existieren nur als E-Mail. Erforderlich: Postfach-Retention und manuelle Bereinigung mit Nachweis.

## 3. Betroffenenrechte Art. 15–21

| Recht | Status | Vorhanden | Fehlend |
| --- | --- | --- | --- |
| Art. 15 Auskunft | teilweise | Admin-Ansichten (`getCustomer`, `getStaffDetail`), Self-View (`getMyProfile`) | kein Selbstservice-Export für Gäste/Kunden/Bewerber; keine vollständige Kategorienauskunft |
| Art. 16 Berichtigung | teilweise | `updateMyProfile`, `updateCustomer`, `updateStaffAdmin` | kein Selbstservice für Gäste/Kunden; keine eingeschränkten/auditierbaren Korrekturpfade |
| Art. 17 Löschung | teilweise | `anonymizeStaffForErasure`, `eraseDeletableStaffData`, `deleteCustomer` (Soft-Delete) | kein Selbstservice; keine Löschung mit Aufbewahrungssperrvermerk; keine Cascade zu Mail/Cloudinary vollständig |
| Art. 18 Einschränkung | fehlt | – | keine Markierung/Prozess für Verarbeitungseinschränkung |
| Art. 19 Mitteilung an Empfänger | fehlt | – | keine Benachrichtigung von Cloudinary/Resend/Stripe bei Berichtigung/Löschung |
| Art. 20 Übertragbarkeit | fehlt | – | kein strukturiertes JSON/CSV-Export für Betroffene |
| Art. 21 Widerspruch | teilweise | `marketingConsent`-Feld bei Kunden | kein Widerspruchsprozess/Endpoint; keine Suppression-Liste; keine Dokumentation der Abwägung |

### 3.1 Art. 20 – Exportformat (konkret)

Empfohlen: `application/json` (UTF-8) als primäres Format plus `text/csv` (UTF-8 mit BOM) für tabellarische Daten.

JSON-Mindeststruktur:

```json
{
  "exportId": "uuid",
  "generatedAt": "2026-11-14T00:00:00.000Z",
  "controller": "Maurer Events, Florian Maurer",
  "subject": { "email": "gast@example.com", "name": "..." },
  "categories": {
    "profile": { },
    "reservations": [ { "id": "uuid", "event": "...", "date": "...", "status": "..." } ],
    "tickets": [ { "reservationId": "uuid", "sentAt": "...", "scannedAt": "..." } ],
    "waitlistEntries": [ ],
    "customerRecord": { },
    "staffRecord": { },
    "marketingConsent": false,
    "auditMetadata": [ { "action": "...", "createdAt": "..." } ]
  },
  "notes": "Bewerbungen werden ausschließlich per E-Mail verarbeitet und sind nicht in der Anwendungsdatenbank gespeichert."
}
```

CSV: eine Datei pro Kategorie oder ein Workbook mit Sheets; Felder mit Komma/Anführungszeichen korrekt quoten; Datumsformat ISO-8601; keine internen IDs als einzige Referenz, aber IDs für Nachvollziehbarkeit.

## 4. Identitätsprüfung und Fristen-Tracking (Art. 12)

- Art. 12 Abs. 3: Antwort innerhalb eines Monats; bei komplexen Anfragen Verlängerung um zwei Monate mit Begründung.
- Derzeit kein Request-Store, keine Identitätsprüfung, kein Fristen-Tracking.
- Empfohlene Identitätsprüfung:
  - Gäste/Kunden ohne Konto: signierter, einmaliger, 24 h gültiger Link an die im System hinterlegte E-Mail; bei Erasure zusätzlich Bestätigungsschritt und Abgleich von Buchungsreferenz/Eventdatum.
  - Staff: bestehende Session plus Re-Authentifizierung (OTP/Passwort).
  - Admin: bestehendes Admin-OTP.
  - Keine pauschale Ausweiskopie; Verhältnismäßigkeit dokumentieren.
- Fristen-Tracking: `receivedAt`, `verifiedAt`, `deadlineAt = receivedAt + 30 Tage`, `completedAt`, `extensionReason`, `status`; täglicher Cron zur Überfälligkeitserkennung und Alarmierung.

## 5. Fehlende Implementierungen – Task-Liste mit API-Signaturen

### P0 – Betrieb/Compliance

1. Cron-Deklaration und Monitoring
   - `vercel.json`: `"crons": [{ "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }]`
   - `GET /api/cron/cleanup` (bestehend) ergänzen um `runId`, `failedCloudinaryUrls[]`, Audit-Eintrag `system.retention_cleanup`.

2. Cleanup-Abdeckung erweitern (`src/lib/retention.ts`)
   - `export async function deleteExpiredScannerAccess(connection, now): Promise<number>`
   - `export async function deleteExpiredPasswordResets(connection, now): Promise<number>`
   - `export async function deleteExpiredWaitlists(connection, now): Promise<number>`
   - `export async function anonymizeExpiredCustomers(connection, now): Promise<number>`
   - `export async function anonymizeExpiredReservations(connection, now): Promise<{ anonymized: number; purgedUrls: string[] }>`
   - `runRetentionCleanup(connection, now, { dryRun?: boolean })`

3. Cleanup transaktional + protokolliert
   - Jede Phase in `db.transaction(...)`.
   - `POST /api/admin/privacy/cleanup/run` (Admin) für manuellen, auditierbaren Lauf.

### P1 – DSR-Infrastruktur

4. Request-Store (Migration)
   - Tabelle `privacy_requests` und `privacy_request_tokens`.

5. Öffentliche DSR-Endpoints
   - `POST /api/privacy/requests`
     - Body: `{ requestType: 'access'|'rectification'|'erasure'|'restriction'|'portability'|'objection'; subject: { email: string; name?: string; bookingReference?: string; eventId?: string }; details?: string; locale?: 'de'|'en' }`
     - Response: `{ requestId: string; status: 'identity_pending'; verificationExpiresAt: string }`
   - `GET /api/privacy/verify?token=...` → 302 auf Statusseite
   - `GET /api/privacy/requests/:id/status?token=...` → `{ status, deadlineAt, completedAt? }`

6. Admin-DSR-Endpoints
   - `GET /api/admin/privacy/requests?status=&overdue=&limit=`
   - `POST /api/admin/privacy/requests/:id/verify` Body: `{ method: 'email'|'id_document'|'otp'; note?: string }`
   - `POST /api/admin/privacy/requests/:id/complete` Body: `{ decision: 'fulfilled'|'partially_fulfilled'|'rejected'; reason?: string; responseFormat: 'json'|'csv'; holdCategories?: string[] }`
   - `POST /api/admin/privacy/requests/:id/restrict` Body: `{ categories: string[]; reason: string }`
   - `POST /api/admin/privacy/requests/:id/notify-recipients` Body: `{ recipients: ('cloudinary'|'resend'|'stripe')[] }`

7. Export (Art. 15/20)
   - `GET /api/privacy/export?token=...&format=json|csv`
   - `export async function collectSubjectData(subject): Promise<DataSubjectExport>`
   - `GET /api/team/privacy/export` (Staff-Session)
   - `GET /api/admin/customers/:id/export` und `GET /api/admin/staff/:id/export`

8. Löschung (Art. 17)
   - `POST /api/privacy/erasure` Body: `{ token: string; scope: 'all'|'marketing'|'contact'; confirm: true }`
   - `export async function eraseSubjectData(subject, options): Promise<{ deleted: string[]; retained: { category: string; reason: string; until: string | null }[]; purgedUrls: string[] }>`
   - `POST /api/team/privacy/erasure` Body: `{ confirm: true }`
   - `POST /api/admin/customers/:id/erasure` Body: `{ reason: string; confirm: true }`
   - bestehend: `anonymizeStaffForErasure(staffId)`, `eraseDeletableStaffData(staffId)`

9. Berichtigung (Art. 16)
   - `PATCH /api/privacy/profile` Body: `{ token: string; fields: Partial<{ name: string; phone: string | null; address: string | null }> }`
   - bestehend: `updateMyProfile`, `updateCustomer`, `updateStaffAdmin`

10. Widerspruch (Art. 21)
    - `POST /api/privacy/objection` Body: `{ token: string; type: 'direct_marketing'|'legitimate_interest'; reason?: string }`
    - Tabelle `marketing_suppressions(email, createdAt)` und Prüfung in allen Marketing-Pfaden.

### P2 – Identität, Fristen, Wirksamkeit

11. Identitätsprüfung
    - `export async function issuePrivacyVerificationToken(requestId: string, email: string): Promise<{ token: string; expiresAt: Date }>`
    - `export async function verifyPrivacyToken(token: string): Promise<{ requestId: string; email: string; expiresAt: Date }>`

12. Fristen-Tracking
    - `GET /api/cron/privacy-deadlines` (oder Erweiterung von `/api/cron/cleanup`)
    - Response: `{ overdue: number; dueSoon: number; alerted: string[] }`
    - Admin-Query `GET /api/admin/privacy/requests?overdue=true`

13. Cloudinary-Wirksamkeit
    - Prüfen, ob Cloudinary-Backups/Versionen aktiv sind; falls ja: deaktivieren oder Löschlauf für Versionen ergänzen.
    - `scripts/purge-legacy-vercel-blobs.ts` für nicht löschbare Vercel-Blob-URLs.

14. Neon-PITR-Runbook
    - Dokumentieren: Tarif, PITR-Fenster, Restore→erneut-löschen/anonymisieren, Verantwortlichkeit, Nachweis.

15. Mail-Postfach-Runbook
    - Retention für `servus@...` und Resend-Dashboard; Bereinigung nach Kategorie-Frist; Nachweis.

16. Logging-Hygiene
    - PII aus `console.error`/Logs entfernen oder redigieren; Turnstile-SHA-256-Kennungen prüfen (derzeit nicht anonymisiert, 15-Minuten-Fenster).

## 6. Offene Punkte / Annahmen

- Bewerberdaten werden ausschließlich per E-Mail verarbeitet; es gibt keine Bewerber-Tabelle. DSR für Bewerber erfolgt über Postfach-Suche.
- Rechtsverbindliche Fristen (insbesondere 6 vs. 10 Jahre, Geschäftsjahresende) müssen mit Steuerberater/Verantwortlichem final abgestimmt werden. Der Code nutzt `exitDate + 3650 Tage`; rechtlich korrekter Anker ist das Ende des Geschäftsjahres.
- Neon-Tarif/PITR-Fenster, Cloudinary-Backup-Einstellungen, Vercel-Log-Retention und Resend-Retention sind nicht im Repository belegt und müssen im Betrieb verifiziert werden.
- Keine automatische Löschung nach Veranstaltungsende vorhanden; Scanner-Ablauf sperrt, löscht aber keine Freigabe.
- Diese Matrix ersetzt keine Rechtsberatung und keine abgeschlossene Datenschutzfreigabe.