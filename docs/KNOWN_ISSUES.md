# Offene Punkte

Der aktuelle Abnahmestand steht in [production-acceptance.md](production-acceptance.md).

- Freigegebene AGB und Stornobedingungen fehlen; `/agb` und `/widerruf` liefern 404.
- Warteliste und Zahlungsabschluss mit Tischwahl sind noch offen. Echter OTP-Login mit
  CAPTCHA/Code-Mail sowie Gast-Wizard ohne Tischwahl mit Testzahlung und Rückkehr
  wurden vom Betreiber bestätigt und mit DB-/Providerdaten abgeglichen.
  Alte `Invalid URL /de`-Logs betreffen den korrigierten Proxy;
  auch der spätere CAPTCHA-Verbindungsfehler tritt nach erneutem Deploy nicht mehr auf.
- Der Betreiber bestätigt nach Deploy einen erfolgreichen physischen QR-Scan.
  Die zugehörige Buchung ist in der DB als `checked_in` mit Scanzeit gespeichert.
  Der zweite physische Scan wurde nicht gesondert bestätigt; Einmalentwertung
  ist durch Dienst- und Browserregressionen geprüft.
- Mobile Adminansichten und veranstaltungsbezogene Scanner-Freigaben sind lokal
  im Produktionsbuild geprüft und zum Redeploy vorbereitet. Migration 0008 ist
  auf Staging bereits angewendet. Die Helferanmeldung mit echter Code-Mail ist
  nach Deploy noch im normalen Browser abzunehmen.
- Der lokale Standalone-Smoke-Test verwendet konsistent `localhost`. Ein Listener
  auf `127.0.0.1` verursachte mit Next.js-URL-Normalisierung eine Locale-Redirectschleife.
- Docker, produktives Backup/PITR, Monitoring und Scheduler sind auf dem tatsächlichen
  Zielsystem noch nachzuweisen.
- ESLint prüft jetzt TypeScript und React. Bestehende `any`-Typen und direkte
  State-Updates in Effekten bleiben ausdrücklich Warnungen; Hook-Reihenfolge,
  Render-Purity und die übrigen Korrektheitsregeln werden als Fehler geprüft.

Die frühere Behauptung einer allgemeinen ESLint-9-/Next-Inkompatibilität ist mit
der aktualisierten Flat Config nicht mehr zutreffend.
