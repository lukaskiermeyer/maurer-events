# Retention-Matrix Personalakten

Stand: 6. November 2026. Fristen laufen ab `exitDate`. Ohne `exitDate` wird **nicht** anonymisiert,
damit laufende Mitarbeitende nicht verloren gehen.

| Kategorie | Frist | Aktion | Rechtsgrundlage |
| --- | --- | --- | --- |
| Sessions / Invites | Ablauf bzw. Inaktivsetzen (sofortige Sperrung) | Delete + Audit | Art. 6 Abs. 1 lit. f DSGVO, § 26 Abs. 1 BDSG |
| Ausweis / Gesundheitszeugnis | Exit + 365 Tage | Zeilen + Cloudinary-Datei löschen | Art. 9 Abs. 2 lit. b, § 22 BDSG (Nachweis nur bis Fristablauf erforderlich) |
| Lohn/Steuer/Verträge + Pflicht-Dokumente | Exit + 10 Jahre (3650 Tage) | Anonymisierung: Name/E-Mail/Phone/Adresse/Geburtsdatum/Steuer-ID/SV/IBAN/BIC/Gehalt/Privacy-Nachweis löschen; Dokumente/Verträge/Verfügbarkeiten/Assignments entfernen; Cloudinary-Purge | §§ 257 HGB, 147 AO |
| Payroll-Export-Metadaten / Kundenimports | Erstellung + 1 Jahr | Delete | Art. 5 Abs. 1 lit. c/e DSGVO |
| AuditLog allgemein | Erstellung + 1 Jahr | Delete | Art. 5 Abs. 1 lit. e DSGVO |
| AuditLog Personal/Lohn/Vertrag (`staff.*`, `payroll.*`, `contract*`) | Erstellung + 10 Jahre | Delete | §§ 257 HGB, 147 AO |
| Bereits anonymisierte Sätze (`anonymized-…@deleted.invalid`) | — | überspringen (idempotent) | — |

## Ablauf im Code

- `src/lib/retention-policy.ts`: Konstanten `STAFF_ID_DOC_RETENTION_DAYS`, `STAFF_ANONYMIZE_AFTER_DAYS`, `STAFF_AUDIT_RETENTION_DAYS`.
- `src/lib/retention.ts`: `runRetentionCleanup()` führt 1) ID-/Gesundheits-Purge, 2) 10-Jahres-Anonymisierung (DB), 3) Invites/Sessions/Payroll/Imports, 4) differenzierte Audit-Fristen aus und gibt die Cloudinary-URLs (`purgedIdDocUrls`, `purgedAnonymizeUrls`) zurück.
- `src/app/api/cron/cleanup/route.ts`: `GET /api/cron/cleanup` (CRON_SECRET) löscht die zurückgegebenen Cloudinary-URLs best-effort via `deleteCloudinaryImage()` und meldet `purgedCloudinary`.
- `src/app/actions/staff.ts`: `updateStaffAdmin` validiert `exitDate >= entryDate`; bei Status `inactive` werden Sitzungen sofort gelöscht.
- `StaffDetailAdmin.tsx`: Austrittsdatum editierbar. Ohne Austrittsdatum bleibt der Payroll-Export aktiv (Filter `exitDate IS NULL`).

## Tests

`scripts/onboarding-security-test.ts` prüft: ID-Doc-Purge nach 365 Tagen (Verbleib der übrigen Docs), 10-Jahres-Anonymisierung (PII = null / anonymized, Docs/Verträge weg, Payroll-Exportierung ohne anonymisierte Sätze), Bypass bei fehlendem `exitDate`, Audit-Fristen-Trennung (allgemein 1 Jahr, Personal 10 Jahre).
