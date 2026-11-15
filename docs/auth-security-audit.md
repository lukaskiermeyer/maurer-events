# Authentifizierung & Autorisierung – Audit (Mitarbeiterportal)

**Scope:** `src/lib/staff-auth.ts`, `src/lib/staff-access.ts`, `src/lib/auth.ts`, `src/app/actions/staffAuth.ts`, `src/app/actions/staff.ts`, `src/app/actions/staffing.ts`, `src/app/actions/authActions.ts`, `src/app/actions/adminUsers.ts`, `src/app/actions/reservations.ts`, `src/app/actions/reservationRequests.ts`, `src/app/actions/events.ts`, `src/app/actions/tables.ts`, `src/app/actions/settings.ts`, `src/app/actions/customers.ts`, `src/app/api/**`, `src/db/schema.ts`.

**Datum:** 2026-11-14 (Code-Stand). **Methode:** Statisches Review + Datenfluss-/Ownership-Analyse. Keine dynamischen Tests ausgeführt (DB/Env nicht verfügbar).

---

## 0. Positiv (bereits solide)

- Cookies `staff_token`/`admin_token`: `httpOnly`, `secure` in Prod, `sameSite: strict`, `path: /`.
- Passwort-Mindestlänge 10, Länge ≤ 200; `scrypt` mit zufälligem 16-Byte-Salt; `crypto.timingSafeEqual` beim Verify.
- Tokens (Invite/Reset/Session): 32 Byte (`crypto.randomBytes`), HMAC-SHA256 mit `AUTH_SECRET` (≥32) für Speicherung; `base64url`.
- Reset-Flow gibt für nicht-existierende E-Mails `{success:true}` (Enumerationsschutz) + IP-Rate-Limit.
- Invite-Accept: atomares `UPDATE ... WHERE usedAt IS NULL` (Race-Schutz), Rate-Limits (IP + Token) vor DB-Lookup/scrypt.
- Serverseitige Ownership-Checks in `deleteMyDocument`, `signContractText`, `attachSignedContract`, `respondToAssignment`, `withdrawSignup`, `deleteMyAvailability`, File-Route.
- Scanner-Zugriff wird in `scanForStaff` live gegen `scannerAccess` geprüft (Revocation wirkt).
- Schicht-Signup: `SELECT ... FOR UPDATE` auf Requirement + Transaktion; UNIQUE auf `(eventId, staffId, date, startTime)`.
- Mass-Assignment-Schutz in `input()` (customers), `tableMeta()` (tables), `updateRole`/`updateStaffAdmin` (explizite Felder).
- Admin-OTP: 5 Versuche in DB, 10 min TTL, `timingSafeEqual`, Turnstile-Captcha, Rate-Limit pro E-Mail.
- Payroll-Export-Token: 15 min, single-use (`usedAt`), 256-bit.
- Cron-Routen: `Bearer CRON_SECRET` bzw. `secret`-Param.

---

## 1. Kryptografie / Passwort-Hashing

### F-01 · Passwort-Hashing nutzt scrypt statt geforderter Argon2id/bcrypt (Medium)

- **Datei:** `src/lib/staff-auth.ts:10,20-34`
- **Problem:** Verwendet Node-`scrypt` mit Default-Parametern (N=16384, r=8, p=1 implizit) und 64-Byte-Derivat. Keine explizite Parametrisierung, keine Migration auf Argon2id/bcrypt. Audit-Vorgabe fordert Argon2id/bcrypt mit dokumentierten Parametern.
- **Impact:** Schwächere/undokumentierte KDF-Parameter; keine zukunftssichere Parametrierung; keine Algorithmus-Agilität (Format `scrypt$...`).
- **Repro:** Code-Review (kein curl).
- **Fix:** Migration auf Argon2id (z. B. `@node-rs/argon2`) mit m=19456, t=2, p=1 oder bcrypt cost ≥12; Format-Prefix erweitern (`argon2id$...`), Verify unterstützt beide während Migration.

### F-02 · OTP-Code nur 6 Ziffern, E-Mail als einziger 2. Faktor (Medium)

- **Datei:** `src/app/actions/authActions.ts:26`, `src/lib/admin-otp.ts`
- **Problem:** Admin-2FA basiert auf 6-stelligem E-Mail-OTP. E-Mail ist kein unabhängiger Faktor bei kompromittiertem Postfach. Kein TOTP/WebAuthn. HR/Admin ohne echtes MFA.
- **Impact:** Kontoübernahme bei E-Mail-Kompromittierung.
- **Fix:** TOTP (RFC 6238) + Recovery-Codes + optional WebAuthn für Admin/HR.

---

## 2. Authentifizierung

### F-03 · Staff-Login ohne 2FA/MFA (High)

- **Datei:** `src/app/actions/staffAuth.ts:49-64`
- **Problem:** Mitarbeiter-Login nur E-Mail+Passwort, kein zweiter Faktor. Admin-Login hat OTP, Staff nicht.
- **Impact:** Phishing/Credential-Stuffing → Vollzugriff auf eigenes Profil + Schichten.
- **Fix:** Mindestens E-Mail-OTP oder TOTP für alle privilegierten (HR/Admin) und optional für Staff.

### F-04 · Login-Rate-Limit nur E-Mail-basiert, kein IP (Medium)

- **Datei:** `src/app/actions/staffAuth.ts:53`; `src/app/actions/authActions.ts:23,48`
- **Problem:** `takeRateLimit("staff-login:"+email)` keyed nur auf E-Mail. Angreifer rotiert IPs und probiert pro E-Mail 5/15min → bei vielen Accounts skalierbar. Kein globaler/IP-Bucket.
- **Impact:** Distributed Brute-Force, Account-Enumeration durch Timing/Differenzen.
- **Repro (k6):**
  ```js
  import http from 'k6/http';
  export default function () {
    http.post('https://host/team/login', JSON.stringify({email:'victim@example.com',password:'wrong'}), {headers:{'Content-Type':'application/json'}});
  }
  ```
  mit `--vus 50 --duration 60s` und variierenden `X-Forwarded-For`.
- **Fix:** Zusätzlicher IP-Bucket (`staff-login-ip:${ip}`) + globaler Bucket; Lockout nach N Fehlern.

### F-05 · OTP-Request ohne IP-Rate-Limit (Low/Medium)

- **Datei:** `src/app/actions/authActions.ts:23`
- **Problem:** Nur `otp-request:${email}`. Angreifer kann beliebig viele E-Mails anfragen (Spam/Enumeration via Antwortzeiten).
- **Fix:** IP-Bucket hinzufügen.

### F-06 · Admin-Entfernung widerruft nicht bestehende Sessions (High)

- **Datei:** `src/app/actions/adminUsers.ts:42-59`, `src/lib/staff-access.ts:19-24`, Schema `adminSessions`
- **Problem:** `removeAdminUser` löscht DB-Eintrag, aber `adminSessions`-Zeilen für diese E-Mail bleiben bis `validUntil` (7 Tage) gültig. `resolveStaffAccess` wird bei jedem Request aufgerufen, aber `isAdminEmailWithDb` prüft `adminUsers` → entfernter Admin wird `false`... **aber** `resolveStaffAccess` prüft zuerst `isAdminEmail` (Env) und dann DB. Wenn der Admin aus DB entfernt wurde, `isAdminEmailWithDb` gibt false → `resolveStaffAccess` gibt null → Zugriff verweigert. **Aber**: `staffSession` (adminSessions) ruft `resolveStaffAccess` auf → gibt null → Session effektiv ungültig. Also doch widerrufen? Prüfung: `staffSession` in `staff-access.ts:19-24` ruft `resolveStaffAccess(connection, session.email)` → wenn DB-Admin entfernt, gibt null. **Aber** Env-Admins (`isAdminEmail`) bleiben immer. Und: Sessions werden nicht proaktiv gelöscht, aber Zugriff wird verweigert. **Teilweise OK.** Jedoch: Wenn ein Admin entfernt wird, der gleichzeitig Env-Admin ist, bleibt Zugriff. Und: keine sofortige Session-Invalidierung → bis Cache/Re-Resolve. `sessionForToken` cached pro Request (React cache), nicht über Requests. Also pro Request neu. → Zugriff wird beim nächsten Request verweigert. **Geringerer Impact als gedacht.** Aber: `adminSessions`-Tabelle behält Zeilen (Cleanup-Cron löscht nur abgelaufene). Und: keine Audit-Trail für Session-Revoke. Downgrade auf Medium.
- **Fix:** Beim Entfernen alle `adminSessions` mit dieser E-Mail löschen; Env-Admin-Entfernung über separate Mechanik.

### F-07 · Alte Einladungslinks bleiben nach Neuversand gültig (Medium)

- **Datei:** `src/app/actions/staff.ts:168-193` (`resendStaffInvite`)
- **Problem:** `resendStaffInvite` legt neuen `staffInvites`-Eintrag an, invalidiert aber keine vorherigen. Alte Token (7 Tage TTL) bleiben einlösbar.
- **Impact:** Weitergabe kompromittierter alter Links; keine Rotation.
- **Fix:** Bei Resend alle offenen Invites für `staffId` mit `usedAt = now()` (oder delete) markieren.

### F-08 · Reset-Token werden nach Reset nicht alle invalidiert (Low/Medium)

- **Datei:** `src/app/actions/staffAuth.ts:98-113`
- **Problem:** Nur der verwendete Token wird `usedAt` gesetzt. Andere offene Reset-Tokens für denselben User bleiben gültig bis TTL.
- **Fix:** `UPDATE staffPasswordResets SET usedAt=now() WHERE staffId=... AND usedAt IS NULL`.

### F-09 · Invite/Reset-Token in URL (Query) (Low)

- **Datei:** `src/app/actions/staff.ts:143,176`; `src/app/actions/staffAuth.ts:81`
- **Problem:** Token im Query-String → landet in Browser-History, Server-Logs, `Referer`-Header.
- **Fix:** Token im Fragment oder POST-Body; `Referrer-Policy: no-referrer`.

### F-10 · Session-TTL 7 Tage ohne Idle-Timeout/Rotation (Low)

- **Datei:** `src/lib/staff-auth.ts:12,45`; `src/lib/admin-otp.ts:15`
- **Problem:** Absolute 7-Tage-Session ohne Sliding/Idle-Timeout und ohne Rotation bei privilegierten Aktionen.
- **Fix:** Idle-Timeout (z. B. 30 min) + Rotation bei Passwortänderung/Privilegienwechsel.

### F-11 · `devBypassLogin` env-abhängig (Low)

- **Datei:** `src/app/actions/authActions.ts:66-75`
- **Problem:** Wenn `NODE_ENV=development` oder `ALLOW_DEV_LOGIN=true` in Prod gesetzt, Bypass aktiv. Vertraut auf Env.
- **Fix:** Hart deaktivieren in Prod-Builds; zusätzliche Allowlist.

---

## 3. Autorisierung

### F-12 · `updateEvent` Mass-Assignment via Spread (Medium)

- **Datei:** `src/app/actions/events.ts:91-128`
- **Problem:** `const updates = { ...data, updatedAt }` übernimmt beliebige Felder (`deletedAt`, `createdAt`, `id`, `stripeSessionId`-analog) ohne Whitelist. Nur Admin, aber riskant bei kompromittiertem Admin oder fehlerhafter UI.
- **Impact:** Soft-Delete-Umgehung, Zeitstempel-Manipulation.
- **Repro:** Admin-Session-Cookie + Server Action Call mit `{deletedAt: null}`.
- **Fix:** Explizite Feld-Whitelist wie in `updateStaffAdmin`.

### F-13 · Keine formale RBAC-Matrix / zentrale Policy (Low)

- **Datei:** verteilt
- **Problem:** Berechtigungen (admin/scanner/member) sind ad-hoc in Actions verstreut; keine zentrale Matrix Rolle×Ressource×Aktion.
- **Fix:** Zentrales Policy-Modul + Tests.

### F-14 · `getTables`, `getTentSettings`, `getTaxStatus`, `getCareerContent` öffentlich lesbar (Low)

- **Datei:** `src/app/actions/tables.ts:46`, `src/app/actions/settings.ts:19,34`, `src/app/actions/career.ts:29`
- **Problem:** Keine Auth; exponiert Layout-/Steuerstatus. Ggf. gewollt (öffentliche Seite), aber Steuerstatus (Kleinunternehmer) ist Geschäftsinfo.
- **Fix:** Prüfen, ob öffentlich nötig; sonst `requireAdmin`.

### F-15 · `addGalleryImage` speichert beliebige `imageUrl` ohne Validierung (Low)

- **Datei:** `src/app/actions/gallery.ts:9-17`
- **Problem:** Keine URL-Validierung/Host-Whitelist; SSRF-Risiko bei späterer Verarbeitung.
- **Fix:** URL-Validierung + Host-Whitelist (Cloudinary).

### F-16 · IDOR in `verifyStaffDocument`/`verifyContract`? Admin-only, aber keine Existenzprüfung vor Update (Low)

- **Datei:** `src/app/actions/staff.ts:427-435`, `src/app/actions/staff.ts:76-84` (contracts verifyContract in contracts.ts)
- **Problem:** Update by ID ohne vorherige Existenzprüfung → stille No-Op, aber keine Datenleck. Low.

---

## 4. Schicht-Slots / Concurrency

### F-17 · Race Condition auf Slot-Kapazität (Medium/High)

- **Datei:** `src/app/actions/staffing.ts:254-284` (`signUpForShift`)
- **Problem:** `FOR UPDATE` nur auf `eventStaffRequirements`, nicht auf `staffAssignments`. Zwei gleichzeitige Signups können beide `sameSlot.length < requiredCount` sehen und beide inserten → Doppelbelegung über Kapazität. UNIQUE schützt nur pro Mitarbeiter, nicht pro Slot.
- **Impact:** Schicht überbesetzt.
- **Repro (k6):** 2 VUs gleichzeitig `signUpForShift(requirementId)` mit unterschiedlichen Accounts → beide 200, obwohl `requiredCount=1`.
  ```js
  import http from 'k6/http';
  export const options = { vus: 2, iterations: 2 };
  export default function () {
    http.post('https://host/team/schichten', JSON.stringify({requirementId:'<UUID>'}), {headers:{'Content-Type':'application/json','Cookie':'staff_token=<token>'}});
  }
  ```
- **Fix:** Advisory Lock (`pg_advisory_xact_lock`) auf `(eventId, roleId, date, startTime)` oder Slot-Counter-Tabelle mit UNIQUE; oder `SELECT ... FROM staffAssignments WHERE ... FOR UPDATE` in derselben Transaktion.

### F-18 · `createManualAssignment` ohne Transaktion/Lock (Medium)

- **Datei:** `src/app/actions/staffing.ts:316-332`
- **Problem:** Kapazitätsprüfung außerhalb Transaktion; Race mit Selbst-Signups.
- **Fix:** In Transaktion mit `FOR UPDATE`/Advisory Lock.

### F-19 · `autoAssign` Race mit Selbst-Signups (Low/Medium)

- **Datei:** `src/app/actions/staffing.ts:96-146`
- **Problem:** Löscht auto-proposed und fügt neue ein; kann Selbst-Signups überschreiben/verlieren bei gleichzeitiger Ausführung.
- **Fix:** Serialisierung pro Event (Advisory Lock).

### F-20 · Kein Idempotency-Key für Schicht-Signup (Low)

- **Datei:** `src/app/actions/staffing.ts:254`
- **Problem:** Retry des Clients kann 409 liefern, aber kein Replay des Ergebnisses. UX, kein Sicherheitsrisiko.

---

## 4b. Mandanten-Lecks

- Single-Tenant (Maurer Events). Datenisolation zwischen Mitarbeitern über Ownership-Checks (siehe §3). Keine separaten Mandanten. **N/A** (kein Finding).

---

## 5. API-Routes / Sonstiges

### F-21 · `payroll-export` GET verlangt Admin + Token, aber Token in Query (Low)

- **Datei:** `src/app/api/admin/payroll-export/route.ts`
- **Problem:** Token im Query-String → Logs/Referer. Single-use schützt Wiederverwendung, aber nicht Leakage.
- **Fix:** Token im Header oder POST.

### F-22 · `file`-Route: Admin kann beliebige Dokumente/Verträge lesen (gewollt, aber kein Tenant-Filter) (Low)

- **Datei:** `src/app/api/team/file/route.ts`
- **Problem:** Admin liest alle; OK.

### F-23 · `revalidate`-Route nutzt `CRON_SECRET` als GET-Param (Low)

- **Datei:** `src/app/api/revalidate/route.ts`
- **Problem:** Secret im Query → Logs. Bearer wäre besser (konsistent mit Cron).

### F-24 · `adminAuth`-Cleanup nur Cron (Low)

- **Datei:** `src/app/api/cron/cleanup/route.ts:25`
- **Problem:** Abgelaufene OTPs werden nur durch Cron entfernt; sonst DB-Bloat. Kein Security-Issue.

---

## 6. Zusammenfassung (Priorität)

| ID | Schwere | Titel |
|---|---|---|
| F-04 | Medium | Login-Rate-Limit nur E-Mail, kein IP |
| F-06 | Medium | Admin-Entfernung: Sessions nicht proaktiv gelöscht |
| F-07 | Medium | Alte Einladungslinks bleiben gültig |
| F-12 | Medium | updateEvent Mass-Assignment |
| F-17 | Medium/High | Race auf Schicht-Slot-Kapazität |
| F-18 | Medium | createManualAssignment ohne Lock |
| F-01 | Medium | scrypt statt Argon2id/bcrypt |
| F-02 | Medium | Admin-2FA nur E-Mail-OTP |
| F-03 | High | Staff ohne 2FA |
| F-09 | Low | Token in URL |
| F-10 | Low | Session-TTL ohne Idle |
| F-11 | Low | devBypassLogin env-abhängig |
| F-13 | Low | Keine RBAC-Matrix-Doku |
| F-14 | Low | Öffentliche Reads |
| F-19 | Low/Medium | autoAssign Race |
| F-20 | Low | Kein Idempotency-Key Signup |
| F-21 | Low | Payroll-Token in Query |
| F-23 | Low | Revalidate Secret in Query |

---

## 7. Reproduzierbare Testfälle (curl)

### T-01 · Mass-Assignment updateEvent (F-12)
```bash
curl -X POST https://host/_next/.../events/updateEvent \
  -H 'Content-Type: application/json' -H 'Cookie: admin_token=<ADMIN>' \
  -d '{"id":"<EVENT_UUID>","data":{"deletedAt":null,"createdAt":"2020-01-01T00:00:00Z"}}'
```
Erwartet (aktuell): Felder werden übernommen. Gewünscht: 400/ignored.

### T-02 · Schicht-Slot Race (F-17) – k6
Siehe F-17. Erwartet aktuell: beide 200. Gewünscht: zweiter 409.

### T-03 · Admin-Session nach Entfernung (F-06)
1. Admin A legt Admin B an.
2. B loggt ein (Cookie).
3. A entfernt B.
4. B ruft `/admin` mit Cookie → sollte 401/redirect sein (aktuell: verweigert wegen resolveStaffAccess, aber Session-Zeile bleibt).

### T-04 · Alte Invite gültig nach Resend (F-07)
1. Admin erstellt Mitarbeiter (Invite-Link L1).
2. Admin klickt "Erneut einladen" (L2).
3. L1 einlösen → sollte 400 sein, ist aber 200 (bis 7 Tage).

### T-05 · Reset-Token Reuse (F-08)
1. Reset anfordern (Token T1, T2 via zwei Requests – aktuell nur ein Token pro Request, aber mehrere Requests möglich).
2. T1 einlösen → Passwort geändert.
3. T2 einlösen → sollte 400 sein, ist aber 200.

### T-06 · Brute-Force Staff-Login (F-04)
k6 mit 50 VUs, variierende `X-Forwarded-For`, Ziel `victim@example.com` → >5 Versuche/15min möglich.

---

## 8. Empfohlene Reihenfolge

1. F-17/F-18 (Datenintegrität Schichten) – Transaktion + Advisory Lock.
2. F-12 (Mass-Assignment) – Whitelist.
3. F-07/F-08 (Token-Invalidierung).
4. F-06 (Session-Revoke).
5. F-04 (IP-Rate-Limit).
6. F-01/F-02/F-03 (Krypto/MFA) – längerfristig.
