# Datenschutz: Textabgleich und offene Betreiberangaben

Stand: 7. Oktober 2026. `src/lib/privacy-notice.ts` beschreibt die aktuelle
Anwendung auf Deutsch und Englisch. Die Staging-Startseite wurde zusätzlich
lesend geprüft: Vercel-Hosting, Cloudinary- und Unsplash-Bildreferenzen.
Die Aktualisierung ist keine abgeschlossene Datenschutzfreigabe.

Technisch geprüft: Produktionsbuild/TypeScript, ESLint der geänderten Dateien,
deutsche und englische Route auf 360/390/1280 Pixeln, Abschnittslinks, Inhalte und
lokalisierte Metadaten. Kein Datenbank- oder Provider-Schreibzugriff für diese
Prüfung. Der Text muss mit dem nächsten Deployment veröffentlicht werden.

## Berücksichtigte Datenflüsse

| Vorgang | Verarbeitung |
| --- | --- |
| Hosting | Vercel, Requests und Runtime-Logs |
| Kontakt | Name/Firma, E-Mail, Veranstaltungsart, Nachricht; Resend an Kontaktpostfach |
| Bewerbung | E-Mail-Links; vom Bewerber übersandte Unterlagen |
| Buchung | Neon, Stammdaten, Termin, Paket, Tisch, Preis, Status, Wiederholungskennung |
| Browser | `NEXT_LOCALE` Session-Cookie; `admin_token` höchstens 7 Tage; Checkout-Sitzungsspeicher einschließlich Name/E-Mail und Buchungseingaben |
| Zahlung | Stripe Checkout, E-Mail/Buchungs-ID/Leistung/Preis; Zahlungsstatus per Webhook; weitere Anbieter je Zahlungsart |
| Ticket | QR-Zugangscode und PDF mit Gast-/Buchungsdaten; Versandpayload in DB und bei Resend |
| Einlass | Kamera-Erkennung lokal, nur QR an Server, Check-in-Zeit; Helfer sehen minimale Einlassdaten |
| Login | E-Mail, HMAC-Codeprüfwert, Fehlversuche, Ablauf, Session; Helferfreigabe pro Event mit Ersteller |
| Spam-Schutz | Turnstile; SHA-256-Anfragekennungen in 15-Minuten-Fenstern, nicht anonym |
| Medien | Uploads an Cloudinary; vorhandene Unsplash-Referenzen. Vercel Blob im Bild-Config erlaubt, als aktueller Upload-Dienst nicht belegt |
| Übersetzung | Optional Gemini, bearbeitete Veranstaltungs-/Galerietexte; keine automatische Übersetzung von Gästedatensätzen |
| Social / Fonts | Instagram/TikTok als Links; Schriftdateien lokal, Google-Fonts-Abruf beim Build |

## Noch zu bestätigen und zu konkretisieren

Der Betreiber hat Regionen, Speicherfristen und Auftragsverarbeitungsverträge
noch nicht bestätigt. Im Text werden daher kein ausschließlich europäischer
Standort, keine abgeschlossenen AVVs und keine erfundenen Provider-Löschfristen
zugesichert.

1. Florian Maurer, Anschrift und Datenschutzpostfach mit tatsächlichem
   Vertragspartner/Impressum abstimmen; Bearbeitung von Betroffenenanfragen
   und funktionsfähiges Postfach sicherstellen.
2. Tatsächliche Vertragseinheiten, AVVs nach Art. 28 DSGVO, Unterauftragnehmer und
   Rollen für Vercel, Neon/Databricks, Resend, Cloudinary, Cloudflare und optional
   Google prüfen. Stripe nach Datenschutzcenter/Vertrag abgleichen; Unsplash als
   Bildquelle berücksichtigen. Der Code belegt keine Verträge.
3. Daten-/Backupregionen, Supportzugriffe und Drittlandgarantien feststellen.
   Konkrete DPF-Zertifizierung oder SCC, Transferprüfung und ergänzende Maßnahmen
   prüfen. Der öffentliche Text nennt Instrumente, bestätigt deren Vereinbarung
   für diesen Betreiber aber nicht. Die tatsächlichen Angaben ergänzen.
4. Löschkonzept mit Fristen für Logs, Resend-Inhalte/Anhänge, Kontakt/Bewerbungen,
   Warteliste, QR/Check-in, ungenutzte Buchungen, Scanner-Freigaben, Auth-Daten und
   Backups festlegen und betreiben. Finanzbelege getrennt halten. Keine allgemeine
   automatische Löschung nach Veranstaltungsende vorhanden; Scanner-Ablauf sperrt,
   löscht aber keine Freigabe. Auth-Bereinigung hängt vom gestarteten Cleanup ab.
5. Berechtigtes Interesse und Erforderlichkeit von Turnstile/Gerätespeicher
   dokumentieren, konkrete Widget-Zugriffe prüfen. Browser-Kamerafreigabe oder
   CAPTCHA sind keine DSGVO-Einwilligung.
6. Rechtsgrundlage für erkennbare Personen pro Foto prüfen und Einwilligung oder
   Interessenabwägung dokumentieren; Entfernung ermöglichen. Externe Unsplash-
   Bilder möglichst durch eigene, zulässig verwendete lokale Dateien ersetzen.
7. Gemini-API-Vertrag, Datenverwendung, Speicher-/Trainingsbedingungen prüfen.
   Keine Gäste-, Bewerbungs-, Kontakt- oder Login-Daten in Übersetzungstexte geben.

## Offizielle Quellen

Am 7. Oktober 2026 lesend geprüft:

- [Vercel](https://vercel.com/legal/privacy-notice).
- [Neon](https://neon.com/privacy-policy), derzeit Weiterleitung zu
  [Databricks](https://www.databricks.com/legal/privacynotice), unter anderem Neon, LLC.
- [Resend](https://resend.com/legal/privacy-policy), Plus Five Five, Inc.
- [Cloudinary](https://cloudinary.com/privacy), [Cloudflare](https://www.cloudflare.com/privacypolicy/),
  [Stripe](https://stripe.com/de/privacy), [Unsplash](https://unsplash.com/privacy).
- [§ 147 AO](https://www.gesetze-im-internet.de/ao_1977/__147.html): grundsätzlich
  10 Jahre Bücher, 8 Jahre Buchungsbelege, 6 Jahre sonstige aufgeführte Unterlagen.
- [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html): Erforderlichkeit
  für Gerätespeicherzugriffe; amtliche URL verwendet weiterhin `ttdsg`.
- [BayLDA](https://www.lda.bayern.de/de/beschwerde.html).

Der Text ersetzt keine AGB/Stornobedingungen oder die übrigen offenen Punkte in
`production-acceptance.md`.
