# Offene Punkte

Der aktuelle Abnahmestand steht in [production-acceptance.md](production-acceptance.md).

- Freigegebene AGB und Stornobedingungen fehlen; `/agb` und `/widerruf` liefern 404.
- Warteliste und authentifizierte Scanner-UI sind noch offen. Echter OTP-Login mit
  CAPTCHA/Code-Mail sowie Gast-Wizard ohne Tischwahl mit Testzahlung und Rückkehr
  wurden vom Betreiber bestätigt und mit DB-/Providerdaten abgeglichen.
  Alte `Invalid URL /de`-Logs betreffen den korrigierten Proxy;
  auch der spätere CAPTCHA-Verbindungsfehler tritt nach erneutem Deploy nicht mehr auf.
- Scanner-Erkennung scheiterte trotz Kamerabild am CSP-blockierten Decoder-CDN.
  Lokale Decoder-Auslieferung und WASM-Freigabe sind mit dem versendeten Ticket
  in sieben Browser-Szenarien geprüft. Deploy und echter Geräte-Scan stehen noch aus.
- Der lokale Standalone-Smoke-Test verwendet konsistent `localhost`. Ein Listener
  auf `127.0.0.1` verursachte mit Next.js-URL-Normalisierung eine Locale-Redirectschleife.
- Docker, produktives Backup/PITR, Monitoring und Scheduler sind auf dem tatsächlichen
  Zielsystem noch nachzuweisen.
- ESLint prüft jetzt TypeScript und React. Bestehende `any`-Typen und direkte
  State-Updates in Effekten bleiben ausdrücklich Warnungen; Hook-Reihenfolge,
  Render-Purity und die übrigen Korrektheitsregeln werden als Fehler geprüft.

Die frühere Behauptung einer allgemeinen ESLint-9-/Next-Inkompatibilität ist mit
der aktualisierten Flat Config nicht mehr zutreffend.
