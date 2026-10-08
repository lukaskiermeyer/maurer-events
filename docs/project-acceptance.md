# Projektabnahme – 7. Oktober 2026

## Einschätzung

**Für einen ersten begleiteten Kundentest geeignet, nach Deployment des geprüften
Standes und kurzem Test der echten Providerverbindungen. Noch keine Freigabe für
öffentlichen Verkauf oder Livezahlungen.**

Die neue Prüfung verwendet den aktuellen Arbeitsstand einschließlich der bereits
vorhandenen Buchungsänderungen. Lokale Schreibtests liefen ausschließlich mit
einer neu erzeugten PostgreSQL-Datenbank und fiktiven Daten. Das vorhandene
Staging wurde zusätzlich lesend geprüft. Es wurden keine echten Zahlungen,
Erstattungen, E-Mails oder Änderungen an dessen Datenbank ausgelöst. Der neue Stand
wurde nicht auf Vercel oder Netcup deployed.

## Nachweise dieser Prüfung

| Bereich | Ergebnis und Grenze |
| --- | --- |
| Produktionsbuild | `npm run build` erfolgreich, einschließlich TypeScript; Next.js 16.3.8 / Node 22 |
| Lint | 0 Fehler, 0 Warnungen; alle 142 ursprünglichen Warnungen behoben, `--max-warnings 0` verhindert neue Warnungen |
| Abhängigkeiten | Aktuelles `npm audit --omit=dev`: 0 bekannte Schwachstellen |
| Buchung und Sicherheit | 48/48 Regressionen bestanden: unter anderem 50 parallele Anfragen auf 8 Plätze, volle Tische, doppelte Requests, Statuswechsel, Refund-/Dispute-Pfade, OTP, Warteliste und Ticketzustellung mit lokalen Provider-Doubles |
| Browser insgesamt | 20/20 Tests bestanden: öffentliche Seiten, Admin/Mobile, Kennzahlen, Bildabrufe, Galerieproportionen und Lightbox auf Desktop und Pixel-7-Emulation |
| Öffentliche Browserseiten | Startseite, Termine, Galerie, Karriere, Impressum, Datenschutz, 404, Zahlungsbestätigung und Login-Schutz; DE/EN, Hydrierung, Sicherheitsheader und ungültige API-Aufrufe |
| Admin und Mobile | Übersicht, Formulare, Galerie-Dialog, gefüllte Warteliste, Zeltplan/VIP bei 320/360/390/768/1280 Pixeln; zusätzlich Gästekarten und Einstellungen bei 360/390 Pixeln visuell geprüft |
| Rollen und Einlass | Admin-/Helferbrowser, Freigabe und Widerruf, geschützte Direktaktionen, fremdes Event, einmaliges Check-in und sofortige Sperre widerrufener Sitzung bestanden; temporäre lokale Sessions ersetzen keinen echten Mailcode |
| Buchungskomponenten | 20 Szenarien bestanden: DE/EN, 390/1440 Pixel, Personen-/Tischwechsel, schnelle Event-/Datumswechsel mit verspäteten Antworten, Erfolgs-/Pending-/Fehleransicht, erneute Statusprüfung und echte Next.js-Rückleitungsrouten; CAPTCHA/Zahlung im Harness ersetzt |
| Bildverarbeitung | Echtes 4.13-MB-PNG im Browser auf 0.85-MB-WebP verkleinert; 3000×1500 auf 1920×960; ungültige, zu große und beschädigte Dateien abgewiesen; kein realer Cloudinary-Upload |
| Scanner | 7 Szenarien bestanden, darunter beide Scanner auf Desktop/Mobile mit synthetischem Kamerabild, Wiederholung, Decoder-Ausfall und Aktionsfehler; kein neuer physischer Gerätescan |
| PDF-QR | Beide vorhandenen vollständigen Ticket-Fixtures (normal/langer Text) exakt decodiert; keine neue Ticketmail versendet |
| Migrationen | Komplette Kette 0000–0008 auf leerer PostgreSQL-DB, wiederholter Aufruf sowie Migrationsrunner im nachgebildeten Standalone-Dateibaum geprüft |
| Readiness | Fehlende Scanner-Tabelle ergibt ungecachtes HTTP 503; nach Wiederherstellung wieder 200 |
| Cleanup-Runner | Lokaler HTTP-Test prüft Bearer-Authentifizierung, Erfolgs-/Fehlerantworten, verweigerte Weiterleitungen und unsichere Ziel-URLs; realer Scheduler noch einzurichten |
| Staging-Preflight | 39 Prüfungen bestanden, 1 reine Statusinformation: Schema/Indizes/Ledger vorhanden, keine erkannten Überbuchungen oder Duplikate, Stripe-Testmodus und Webhook-Abonnements korrekt, Resend-Absenderdomain verifiziert, HTTP/Auth/Origin-Checks erfolgreich |

Die historischen Nachweise zu tatsächlichem OTP-Empfang, Stripe-Testzahlung,
Ticketmail, physischem Scan und Rückerstattung stehen in
[production-acceptance.md](production-acceptance.md). Sie sind kein erneuter
End-to-End-Nachweis des heute geänderten Deployments.

## Behobene Befunde

- Die 142 Lint-Warnungen sind vollständig behoben: gemeinsame, aus dem Schema
  abgeleitete Datentypen, eingegrenzte Fehlerbehandlung, ungenutzten Code entfernt,
  vollständige Hook-Abhängigkeiten und optimierte Bilder mit Alternativtexten.
  Explizites `any` und synchrone State-Resets in Effekten sind jetzt Lint-Fehler.
- Event- und Datumswechsel setzen abhängige Buchungsdaten im Auswahlhandler zurück.
  Verspätete Antworten überschreiben keine neue Auswahl; die erstmalige Auswahl
  des bereits geladenen Veranstaltungstags bleibt bedienbar.
- Die Startfigur verwies auf eine fehlende Datei. Der Pfad ist korrigiert;
  Galerie-Bilder behalten nach der Optimierung ihr natürliches Seitenverhältnis.
- Reservierungslisten wählen nur die benötigten Adminfelder aus. Checkout- und
  E-Mail-Payloads, Request-Hashes und Wiederholungsschlüssel bleiben serverseitig;
  Action-Antwort und servergerenderte Eventansicht sind darauf geprüft.
- Der Datenbankzugriff war an Neons WebSocket-Protokoll gebunden. Reguläres
  PostgreSQL mit deaktivierten Prepared Statements funktioniert jetzt sowohl
  mit Neon-Pooling auf Vercel als auch mit privatem PostgreSQL auf Netcup.
- Docker installierte ohne die vorhandene `.npmrc`. Sie wird jetzt bereits
  in der Dependency-Stufe übernommen, damit Peer-Dependency-Einstellungen gelten.
- Die Oberfläche erlaubte 10-MB-Bilder, Next.js lehnte Server Actions bereits
  ab 1 MB ab. Alle Adminuploads verkleinern Fotos nun vor der Übertragung;
  das 4-MB-Actionlimit lässt Spielraum unter Vercels 4.5-MB-Grenze.
- Bildaktionen waren nur bei Hover sichtbar, einige nur als „×“ beschriftet.
  Touchflächen und Beschriftungen wurden verbessert; die Aktionen sind auf
  Touch-Geräten sichtbar und am Desktop per Tastatur erreichbar.
- Warteliste, Galerie-Dialog, Formulare und Zuweisung wurden für kleine Displays
  angepasst; VIP-Einstellungen sind über einen sichtbaren Button erreichbar.
- Die vollständige Galerie hatte keine Hauptüberschrift und war bei leerem
  Bestand ganz leer. Sie hat jetzt eine H1 und einen Leerzustand.
- Die Umsatzanzeige verlor eingecheckte Buchungen; „Bestätigte Gäste“ zählte
  Buchungen statt Personen. Beide Kennzahlen berücksichtigen jetzt bestätigte,
  bezahlte und eingecheckte Gäste; stornierte Buchungen zählen nicht mit.
- Der Preflight sendete eine bei Neon-Pooling problematische `search_path`-
  Startup-Option. Die Einstellung erfolgt nun innerhalb seiner lesenden Transaktion.

## Hosting vorbereitet

`vercel.json`, Node-22-Festlegung, Docker-Standalone, Migrations- und Cleanup-Runner
sind vorhanden. Coolify kann dieselbe Anwendung auf Port 3000 hinter seinem
HTTPS-Proxy betreiben. Die Anleitung enthält die konkreten Build-/Runtime-Variablen,
Datenbankvarianten, Zeitplan, Migration und Umzugs-/Rückfallverfahren:
[coolify.md](coolify.md).

**Kosten:** Vercel Hobby ist für persönliche, nicht kommerzielle Nutzung vorgesehen.
Eine Kundenwebsite daher nicht als dauerhaft kostenlosen Hobby-Betrieb zusagen.
Tarif/Nutzungsberechtigung klären oder eine getrennte Staging-App auf dem vorhandenen
Netcup-Server verwenden. Es wurden keine Hostingverträge oder kostenpflichtigen
Ressourcen eingerichtet.

Docker/Coolify sind im Windows-Prüfumfeld nicht installiert. Der lokale
Standalone-Nachweis ersetzt keinen Linux-Image-Build, keinen Coolify-Redeploy und
keine tatsächlich ausgeführte Scheduled Task auf Netcup.

## Vor der ersten Kundenübergabe

1. Den aktuellen Stand deployen; feste Testdomain, Stripe-Testmodus und eigene
   Testdatenbank verwenden. Den Kunden ausdrücklich über Testzahlungen informieren.
2. Auf dieser Domain einmal Admin-Login mit CAPTCHA/Mailcode, Handyfoto-Upload,
   vollständige Tischbuchung mit Stripe-Testzahlung, Ticketempfang und Check-in
   durchführen. Wartelisten-/Kontaktmail an ein vereinbartes Testpostfach prüfen.
3. Einen Testzugang mit passender Admin-Allowlist bereitstellen und eine kurze
   Anleitung geben. Für Änderungsvorschläge Seite, Gerät, erwartetes Verhalten
   und tatsächliches Ergebnis erfassen.

## Vor echtem Verkauf offen

- Freigegebene Vertrags-/Stornobedingungen; `/agb` und `/widerruf` fehlen weiterhin.
- Datenschutz finalisieren: reale Provider, Regionen, Auftragsverarbeitung und
  Löschfristen; beim Wechsel nach Netcup die Angaben zu Vercel/Neon anpassen.
- Produktionsdatenbank, verifizierter Produktionsabsender, Livekeys und eigener
  Livewebhook; echte Zahlungsverfahren gesondert abnehmen.
- Tatsächlicher regelmäßiger Cleanup, Fehleralarme, externe Backups/PITR und
  nachgewiesene Wiederherstellung auf der Zielinfrastruktur.

Weitere Grenzen: keine neue physische iPhone-/Safari-/Android-Kameraprüfung,
keine Lastabnahme des Netcup-Servers, kein Ausfalltest des gesamten Hostings,
kein neu ausgeführter Gemini-Übersetzungs- oder Cloudinary-Providerabschluss.

## Wiederholung und Artefakte

Siehe [testing.md](testing.md). `npm run test:acceptance` erstellt eine eigene
lokale Testdatenbank und startet einen Server auf einem freien Loopback-Port;
beides wird beim Abschluss bereinigt. Der PostgreSQL-Testcluster selbst wird
separat gestartet/gestoppt.

Aktuelle, Git-ignorierte Nachweise: `test-results/project-acceptance/report.json`,
`browser-report.json` und Unterordner mit Screenshots, `test-results/warnings-lint-final.json`,
`project-preflight.json`, `admin-role-browser/report.json`, `booking-browser/report.json`,
`image-upload/report.json`, `scanner-browser/report.json` und `ticket-decoder-report.json`.
Diese Artefakte und insbesondere alte Provider-/Sessiondateien nicht ungeprüft
an Kunden weitergeben.
