# TODO – zentraler Index der offenen Arbeiten

Stand: 18.11.2026. Diese Datei bündelt alle offenen To-dos mit Verweis auf das
jeweilige Detaildokument; abgeschlossene Punkte wandern hier raus. Referenz- und
Auditdokumente ohne eigene Todo-Liste stehen in der Landkarte unten und bleiben
unverändert.

---

## 1. AGB, Storno, Widerruf (Blocker für öffentlichen Ticketverkauf)

- [ ] Betreiberentscheidungen zu Buchungs-/Stornobedingungen treffen
      (`booking-terms-decisions.md` – Arbeitsblatt)
- [ ] Rechtstexte prüfen und freigeben (`agb-pruefauftrag.md`); danach die
      Konstante `LEGAL_REVIEW_PENDING` abschalten
- [ ] `/agb` und `/widerruf` (derzeit 404, siehe `KNOWN_ISSUES.md`) mit den
      freigegebenen Texten bereitstellen; ggf. Pfad `/stornobedingungen` umbenennen
- [ ] Bis dahin keine Tickets öffentlich verkaufen

## 2. Datenschutz & Provider (AVVs, Register, Verifikation)

- [ ] AVVs nach Art. 28 beschaffen/prüfen: Neon/Databricks, Cloudinary
      (erfordert Plan-Upgrade), Resend, Stripe, Vercel bzw. netcup/Coolify,
      Turnstile/Cloudflare, Google Gemini (`checkliste.md`, `privacy-review.md`)
- [ ] Unterauftragsverarbeiter-Register mit tatsächlichen Verträgen, Regionen
      und Drittlandtransfers verifizieren (`unterauftragsverarbeiter-register.md`)
- [ ] Neon: Prod-Region verifizieren, DB-Rolle Least Privilege (`neon-audit.md`)
- [ ] Betreiber-Punkte: Verarbeitungsverzeichnis und Datenschutzerklärung
      aktualisieren, Löschfristen bestätigen, Betroffenenanfragen-Postfach
      einrichten (`privacy-review.md`, `verarbeitungsverzeichnis.md`,
      `dsgvo-loeschkonzept.md`)
- [ ] DSFA- und `RECHTLICHE PRÜFUNG`-Flags klären (Gesundheitszeugnis/IfSG,
      Ausweis-Kopie, Feldverschlüsselung Art. 9; Betriebsrat falls
      Mitarbeiterdaten) (`rechtliche-pruefung-datenkategorien.md`)

## 3. Cloudinary-Härtung

- [ ] Cloudinary-Secret rotieren + Git-History bereinigen (`checkliste.md`,
      `cloudinary-audit.md`)
- [ ] Unsigned Upload Preset deaktivieren oder absichern
- [ ] EXIF/GPS bei Team-Upload strippen (sharp ist nicht installiert)
- [ ] Event-Dokumente bei Event-Löschung purgen (Cascade-Frage)
- [ ] Authenticated Delivery / Signaturprüfung laut Audit klären
      (`cloudinary-audit.md`)

## 4. Lösch-/Retention-Umsetzung (Code)

- [ ] `cleanup_runs`-Tabelle + persistente Protokollierung der Cleanup-Läufe
      (`dsgvo-loeschkonzept.md`, P0; `checkliste.md`)
- [ ] Löschwirksamkeit in Backups (PITR/logische Backups) klären
- [ ] Error-Tracking-Redaction (`beforeSend`) umsetzen

## 5. Auth-Security (`auth-security-audit.md`)

- [ ] F-17 Race auf Slot-Kapazität (Medium/High)
- [ ] F-18 `createManualAssignment` ohne Transaktion/Lock (Medium)
- [ ] F-12 Mass-Assignment `updateEvent` via Spread (Medium)
- [ ] F-06 Admin-Entfernung widerruft bestehende Sessions nicht (High)
- [ ] F-07/F-08 Token-Invalidierung (alte Invite-Links, Reset-Tokens)
- [ ] F-04/F-05 IP-Rate-Limits ergänzen
- [ ] F-01 scrypt statt Argon2id/bcrypt; F-02/F-03 2FA/MFA
- [ ] Rest (Low) gemäß Priorisierungstabelle im Audit: F-09–F-14, F-19–F-24

## 6. Infrastruktur & Betrieb auf netcup/Coolify

- [ ] Echter Linux-/Coolify-Lauf (lokal im Standalone geprüft, `coolify.md`)
- [ ] Backup/PITR + Restore-Test dokumentieren
- [ ] Incident-Response-Runbook + 72h-Meldepfad
- [ ] Korrektheits- und Lasttest (p95 < 500 ms, Fehler < 1 %)
- [ ] Monitoring/Mess-Setup vor Festbeginn (`massnahmenplan.md`)
- [ ] Vercel-Hobby-Frage vor Übergabe klären oder Staging auf Netcup betreiben
      (`KNOWN_ISSUES.md`)

## 7. Manuelle Abnahmen (`umsetzungsplan-2026.md`, Abschlussabschnitt)

- [ ] Echter A3-Druck Tischplan (100 % Skalierung, Farben, ≥ 100 Tische lesbar)
- [ ] Echter A4-Druck Reservierungszettel (Schnittkanten)
- [ ] Echter Cloudinary-Upload, PDF-Vorschau, Kartenklick im Browser
- [ ] Echter SnapTicket-Export, großer Import, Browser-Durchlauf
- [ ] Personal: Einladung → Onboarding → Vertrag → Admin-Freigabe mit echtem
      Resend-Versand und Dokument-Upload
- [ ] Testimport beim Steuerberater + kompletter `test:acceptance`-Lauf
- [ ] Helferanmeldung mit echter Code-Mail im normalen Browser abnehmen
      (`KNOWN_ISSUES.md`)

## 8. Prozess & TOMs (Auftragsverarbeiter)

- [ ] TOMs-Dokument vervollständigen (`toms.md`)
- [ ] Mess-Setup durchführen + dokumentieren
- [ ] Audit-Log manipulationssicher machen
- [ ] Dependency-/Container-Scanning + Patch-Prozess dokumentieren
- [ ] Restore-Test tatsächlich durchführen
- [ ] `.env.local` entfernen

## 9. Sonstiges

- [ ] Vereins-Radar dokumentieren: `POST /api/admin/vereins-radar/ingest`
      (Auth `MAURER_API_KEY` via Bearer/x-api-key, max. 100 Items),
      Admin-Seite `/admin/vereins-radar`, Tabelle `vereins_radar` – bisher
      keinerlei Doku vorhanden
- [ ] Feature-Reststand laut `KNOWN_ISSUES.md`: Warteliste und Zahlungsabschluss
      mit Tischwahl – Relevanz bewerten, solange Online-Reservierung für neue
      Events ausgesetzt ist
- [ ] Optional: Ferris-Wheel-Scripts aufräumen (`scripts/svg-to-ferris-wheel.mjs`,
      `scripts/onelayer-ferris-wheel.mjs` + package.json-Einträge sind toter Code)

---

## Dokumentenlandkarte

**Referenz (aktuell, unverändert lassen):**

- README, `testing.md`, `deployment.md`, `coolify.md`, `admin-guide.md`
- `konzept-2026-erweiterungen.md` (Produktentscheidungen, § 0),
  `umsetzungsplan-2026.md` (Fahrplan)
- `fest-chances-ingest.md` (maßgebliche Ingest-API-Doku), `festfinder-todo.md`
  (Festfinder-Phasen)
- DSGVO-Welle 14.11.: `privacy-review.md`, `dsgvo-loeschkonzept.md`,
  `retention-matrix.md`, `unterauftragsverarbeiter-register.md`,
  `rechtliche-pruefung-datenkategorien.md`, `toms.md`,
  `verarbeitungsverzeichnis.md`, `log-redaction-rules.md`,
  `gesamtzusammenfassung.md`
- Audits: `auth-security-audit.md`, `neon-audit.md`, `cloudinary-audit.md`,
  `massnahmenplan.md`, `checkliste.md`, `production-acceptance.md`,
  `project-acceptance.md`
- Business: `business/technical-brief.md`, `business/kosten.md`

**Aktive Todo-Listen:** diese Datei, `festfinder-todo.md`, `checkliste.md`,
`KNOWN_ISSUES.md`

**Gelöscht (über Git-History wiederherstellbar):**
`reservation-security-audit.md` – alle 35 Befunde behoben; Zusammenfassung in
`production-acceptance.md`.
