# Sicherheitsprüfung Tischreservierungen

Die Prüfung erfolgt iterativ: Befund dokumentieren, beheben, Regression prüfen,
anschließend Buchungs-, Zahlungs- und Administrationspfade erneut untersuchen.
Bestehende Änderungen im Arbeitsverzeichnis bleiben erhalten.

**Aktualisierung:** Die anschließende reale Staging-Abnahme, zusätzliche Befunde,
44 Regressionen, aktives TypeScript-/React-Linting und angewendete Migrationen
0000–0007 sind in [production-acceptance.md](production-acceptance.md) dokumentiert.
Der Status am Ende dieses ursprünglichen Berichts beschreibt den früheren,
ausschließlich lokalen Prüfstand und wird durch den neuen Bericht ergänzt.

## Runde 1 – Befunde

| Nr. | Priorität | Befund | Behebung / Nachweis |
| --- | --- | --- | --- |
| 1 | kritisch | Manuelle Buchungen und Statuswechsel prüfen keine verfügbare Kapazität. | Gemeinsame transaktionale Kapazitätsprüfung. |
| 2 | hoch | E-Mail-Limit außerhalb der Transaktion; parallel umgehbar, abgelaufene Holds zählen weiter. | Event-Lock und aktive Belegung in derselben Transaktion. |
| 3 | kritisch | `checked_in` wird aus der Belegung entfernt; erneute Buchungen möglich. | Gemeinsames Belegungsprädikat für alle Pfade. |
| 4 | kritisch | Abgelaufene `pending`-Buchungen werden bei Zahlung ohne neue Kapazitätsprüfung bezahlt. | Kapazität bei jeder Zahlungsaktivierung erneut prüfen. |
| 5 | hoch | Unterschiedliche Reihenfolge der Locks verursacht Deadlocks. | Layout → Event → Reservierung → Tisch. |
| 6 | hoch | Idempotenz prüft weder identischen Inhalt noch konkurrierende Requests; UI erzeugt bei jedem Versuch einen neuen Schlüssel. | Persistenter Fingerprint, serialisierte Schlüssel und eingefrorene Stripe-Parameter. |
| 7 | kritisch | Stripe-/DB-Timeout kann eine zahlbare Session hinterlassen und gleichzeitig den Platz freigeben. | Ungewisse Ergebnisse behalten ihren Hold und sind mit gleichem Schlüssel wiederaufnehmbar. |
| 8 | hoch | Webhook-Ledger außerhalb der Transaktion; konkurrierende Wiederholungen scheitern. | Atomarer Ledger mit konfliktfreiem Insert. |
| 9 | hoch | Webhook vertraut Metadata ohne Prüfung von Session, Währung und vollständigem Zahlungsstatus. | Verbindliche Zuordnung und Prüfung vor jeder Änderung. |
| 10 | hoch | Unbezahlte asynchrone Zahlungen verlieren ihren Hold; manuell stornierte Buchungen werden reaktiviert. | Eigener Zahlungswarte-Status; Storno bleibt gesperrt, Zahlung geht in Prüfung. |
| 11 | hoch | Teilrückzahlung entwertet das gesamte Ticket. | Nur vollständige Rückzahlungen geben Plätze frei. |
| 12 | hoch | Tischzuweisung arbeitet mit veralteter Reservierung, zählt sich selbst und ignoriert geteilte Kapazität. | Locks, Ausschluss der eigenen Buchung und Summe der Gäste. |
| 13 | hoch | Tischlöschung/Layout-Neubau prüfen außerhalb der Transaktion und ignorieren Holds/eingecheckte Gäste. | Gemeinsamer Layout-Lock und Belegungsprüfung. |
| 14 | hoch | `createDefaultEventSettingsInternal` ist ohne Autorisierung als Server Action exportiert. | Interne Funktion aus dem Action-Modul entfernen. |
| 15 | hoch | Einstellungsänderungen übernehmen beliebige Felder und ungültige Preise/Zeiten/Limits. | Feld-Whitelist und Laufzeitvalidierung. |
| 16 | hoch | OTPs liegen im Klartext; Versuche nicht atomar begrenzt, Rate Limit nur pro Prozess, entfernte Admins bleiben angemeldet. | HMAC, DB-Limits, atomare Versuche und aktuelle Whitelistprüfung. |
| 17 | hoch | QR-Scan prüft Status vor statt beim Update; ID-Fallback erlaubt Einlass ohne ausgestelltes Ticket. | Ein atomarer, statusgebundener Scan mit ausschließlich ausgestelltem QR-Code. |
| 18 | mittel | Ticketversand hält DB-Locks; Resend-Fehlerobjekte werden als Erfolg gewertet. | Versand nach Commit, stabiler Versandschlüssel und Fehlerprüfung. |
| 19 | hoch | Datum/Uhrzeit/Paket/Tischwahl sind serverseitig unvollständig validiert; Buchungsfenster nutzt ersten Eventtag. | Strikte Eingaben und Fenster für ausgewählten Tag/Uhrzeit in Europe/Berlin. |
| 20 | mittel | Wizard ohne Tischwahl überspringt Datenvalidierung; veraltete Antworten und verbrauchte CAPTCHA-Tokens. | Stufenvalidierung, Abbruch veralteter Antworten und CAPTCHA-Reset. |
| 21 | hoch | Warteliste erlaubt Duplikate, Überschreiben fremder E-Mail-Einträge und ungültige Gästezahlen. | Normalisierte, konfliktfreie Eintragung ohne öffentliche Änderung bestehender Einträge. |
| 22 | kritisch | Lasttest lädt echte Zugangsdaten, erzeugt Stripe-Sessions und löscht alle `stripe_events`; Standalone-Tests melden Erfolg nach `console.assert`-Fehlern. | Ausschließlich isolierte lokale Regressionstests ohne externe Dienste; Assertions brechen fehlgeschlagene Tests ab. |

## Runde 2 – erneute Prüfung

| Nr. | Priorität | Befund | Behebung / Nachweis |
| --- | --- | --- | --- |
| 23 | kritisch | Ein abgelaufener Hold kann bereits bezahlt sein, obwohl Webhook/Session-ID fehlen. | Holds bleiben belegt bis Stripe-Abgleich; Wiederherstellung mit ursprünglichem Schlüssel; bei unklarem Ergebnis keine Freigabe. |
| 24 | hoch | Eventänderungen können gebuchte Tage entfernen oder Kapazität unter die bestehende Belegung senken. | Event-Lock, Feldvalidierung und Prüfung jeder belegten Tageskapazität. |
| 25 | mittel | Neu erzeugte PDF-Bytes unterscheiden sich bei wiederholtem Versand und kollidieren mit Provider-Idempotenz. | Vollständige E-Mail inklusive PDF vor Versand atomar einfrieren. |
| 26 | mittel | Bezahlt/Bestätigt ist nach Versandfehler nicht automatisch wiederaufnehmbar. | Gespeicherter Versandstatus und Cron-Wiederholung; Zahlung bleibt unabhängig vom Versand bestätigt. |
| 27 | hoch | Verschieben eines Tisches lässt ein bereits versendetes Ticket mit falscher Tischangabe gültig. | QR-Code rotieren, alten Code entwerten, neuen Versand auslösen. |
| 28 | mittel | Automatisches Umnummerieren nach Tischlöschung ändert Namen auf gültigen Tickets. | Bestehende Tischnamen erhalten. Layout und Dimensionen gemeinsam committen. |
| 29 | mittel | Nicht abklärbare alte Holds können die begrenzte Cleanup-Liste dauerhaft blockieren. | Nach letztem Prüfzeitpunkt sortieren und problematische Einträge rotieren. |
| 30 | mittel | Idempotenz sperrt nach bestätigtem Ablauf auch einen absichtlich neuen Buchungsversuch. | Neuer Schlüssel nur bei abgeschlossenem Storno/Ablauf/Refund zulässig; Zahlungen in Arbeit bleiben gesperrt. |
| 31 | mittel | Größenprüfung erfolgt erst nach vollständigem Einlesen beliebig großer Requests. | Begrenztes Streaming vor JSON-/Signaturprüfung. |
| 32 | hoch | Wartelisten-Eindeutigkeit ist nur im Anwendungscode gesichert. | Normalisierter eindeutiger DB-Index pro Event/E-Mail. |
| 33 | hoch | Teilgruppen eines Events mit exklusiven Tischen können von einem anderen Event als frei interpretiert werden. | Exklusivität bestehender Buchungen auch eventübergreifend prüfen; öffentliche Verfügbarkeit folgt derselben Regel. |
| 34 | hoch | Verspätetes `completed` nach gescheiterter asynchroner Zahlung aktiviert den Hold erneut; verlorene Settlement-Webhooks werden nicht abgeglichen. | Zahlungsfehler werden terminal storniert; Cron gleicht auch wartende Zahlungen samt aktuellem PaymentIntent ab. |
| 35 | mittel | Durch React Server Components übergebene `Date`-Objekte funktionieren im geänderten Wizard nicht als String. | Eventtag explizit aus `Date`/ISO-Wert normalisieren; Verfügbarkeit auch für Einzeltermine ohne separate Datumsauswahl laden. |

## Status

35 dokumentierte Befunde sind im Arbeitsverzeichnis behoben. Die letzte Prüfung
von Buchungs-, Status-, Zahlungs-, OTP-, Wartelisten- und Ticketpfaden ergab keine
weiteren konkreten Befunde im untersuchten Umfang.

Nachweise:

- 43 bestandene Regressionstests mit PostgreSQL 17, inklusive echter konkurrierender
  Transaktionen, isoliertem Schema/Migrationslauf und simulierten Zahlungsdiensten.
- 50 parallele Einzelplatzanfragen auf 8 Plätze: genau 8 erfolgreiche Holds.
- 20 parallele Wiederholungen derselben Anfrage: genau eine Buchung/Stripe-Session.
- OTP einmalig konsumiert; nach 5 falschen Versuchen kein Login, auch parallel.
- Zahlungsstatus, Reservierung und Webhook-Ledger atomar; Rollback ohne Ledger.
- Produktionsbuild einschließlich TypeScript-Prüfung erfolgreich.
- Die bestehende ESLint-Konfiguration ignoriert `.ts`/`.tsx`; ihr Ergebnis wird
  deshalb nicht als zusätzliche Prüfung ausgewiesen.

Grenzen und Inbetriebnahme:

- Migrationen 0004–0006 sind vorbereitet und lokal getestet, nicht auf die
  bestehende Projektdatenbank angewendet. Vorhandene Gästedaten bleiben erhalten.
- `AUTH_SECRET`, Turnstile-Hostname/Aktionen, Stripe-Zahlungsarten/Webhooks und
  Cron-Aufruf müssen gemäß [testing.md](testing.md) konfiguriert werden.
- Unklare Legacy-Zahlungen bleiben gesperrt und benötigen einen bewussten
  Stripe-Abgleich. `payment_review` ist kein gültiges Ticket und blockiert keinen
  neuen Platz; vor einer Neuzuweisung/Erstattung ist der Zahlungseingang zu prüfen.
- Gastcheckout verwendet keinen Kundenaccount. Eine eingegebene E-Mail ist kein
  Identitätsnachweis; das E-Mail-Limit ist eine Mengenbegrenzung, keine garantierte
  Begrenzung pro Person. Öffentliche Eingaben können bestehende Wartelistendaten
  nicht ändern und Reservierungsdaten nicht auslesen.
- Stripe, Resend und Turnstile wurden simuliert; reale Providerkonfiguration,
  Reverse Proxy/WAF und vollständige Browserabläufe waren nicht Teil der Tests.
- Das Ergebnis ist eine endliche Prüfung konkreter Pfade und Fehlerszenarien,
  keine Garantie, dass künftig keine Schwachstelle auftreten kann.
