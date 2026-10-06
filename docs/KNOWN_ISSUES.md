# Offene Punkte

Der aktuelle Abnahmestand steht in [production-acceptance.md](production-acceptance.md).

- Freigegebene AGB und Stornobedingungen fehlen; `/agb` und `/widerruf` liefern 404.
- Die echten OTP-/CAPTCHA- und authentifizierten Scanner-UI-Abläufe sind noch offen.
  CAPTCHA klappt laut Betreiber im normalen Browser, die OTP-Anforderung scheitert
  danach. Der aktuelle Deploy protokolliert ausschließlich feste `stage`-/`reason`-
  Diagnoselabels. Alte `Invalid URL /de`-Logs betreffen den bereits korrigierten Proxy.
- Der lokale Standalone-Smoke-Test verwendet konsistent `localhost`. Ein Listener
  auf `127.0.0.1` verursachte mit Next.js-URL-Normalisierung eine Locale-Redirectschleife.
- Docker, produktives Backup/PITR, Monitoring und Scheduler sind auf dem tatsächlichen
  Zielsystem noch nachzuweisen.
- ESLint prüft jetzt TypeScript und React. Bestehende `any`-Typen und direkte
  State-Updates in Effekten bleiben ausdrücklich Warnungen; Hook-Reihenfolge,
  Render-Purity und die übrigen Korrektheitsregeln werden als Fehler geprüft.

Die frühere Behauptung einer allgemeinen ESLint-9-/Next-Inkompatibilität ist mit
der aktualisierten Flat Config nicht mehr zutreffend.
