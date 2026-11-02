# Kosten und Preisgestaltung – Maurer Events

> Interne Kalkulation. **Nicht** an den Kunden weitergeben.
> Stand: 31.10.2026. Alle Beträge in Euro, Preise Dritter netto zzgl. USt.,
> sofern nicht anders vermerkt. Wechselkurse gerundet.

---

## 1. Annahmen

| Annahme | Wert |
|---|---|
| Betriebsmodell | 1 App-Instanz, 1 PostgreSQL, 1 Domain |
| Server | Netcup VPS, 2 vCPU / 4 GB RAM |
| Orchestrierung | Coolify (self-hosted, kostenlos) |
| Erwartetes Volumen | wenige hundert bis wenige tausend Reservierungen pro Saison |
| Accounts | **alle auf den Namen des Kunden** |
| USt. | Kleinunternehmerregelung § 19 UStG geprüft |

> **Wichtig:** Alle Konten (Netcup, Stripe, Resend, Cloudflare, Cloudinary)
> gehören dem Kunden. Damit sind es seine Betriebskosten, er ist
> DSGVO-Verantwortlicher, und du hast keinen administrativen Aufwand für fremde
> Zahlungsdaten.

---

## 2. Laufende Kosten pro Monat

### 2.1 Minimum (empfohlen zum Start)

| Posten | €/Monat | Anmerkung |
|---|---|---|
| Netcup VPS 1000/2000 G11 | 10–15 | 2 vCPU / 4 GB reicht für 1 Instanz |
| Domain (.de) | ~0,80 | 10 €/Jahr |
| Backups (Netcup Storage Box 100 GB) | 3,50 | Pflicht – Docker-Volume ist keine Sicherung |
| Cloudflare (DNS/CDN/WAF) | 0 | Free reicht |
| Cloudflare Turnstile | 0 | |
| Cloudinary | 0 | Free = 25 Credits/Monat |
| Resend | 0 | Free = 3.000 Mails/Monat, reicht für einen Festwirt |
| Gemini API | 1–3 | nur Admin-Übersetzung |
| Monitoring (Uptime Kuma, self-hosted) | 0 | auf demselben Server |
| TLS | 0 | Let's Encrypt über Coolify |
| **Summe** | **≈ 15–23 €** | |

### 2.2 Typisch (mit Reserve)

| Posten | €/Monat | Anmerkung |
|---|---|---|
| Netcup VPS (4 vCPU / 8 GB) | 20–25 | Reserve für Builds und Saisonspitzen |
| Domain (.com) | ~1,20 | 14 €/Jahr |
| Backups | 5 | größerer Storage |
| Resend Pro | ~19 | $20, erst ab > 3.000 Mails/Monat nötig |
| Cloudinary | 0 | Free, solange < 25 Credits |
| Gemini API | 3 | |
| Monitoring / Uptime | 0–10 | optional Better Stack Free |
| **Summe** | **≈ 30–45 €** | |

### 2.3 Maximum (nur bei starkem Galerie- oder Mailvolumen)

| Posten | €/Monat |
|---|---|
| Größerer VPS | 35–50 |
| Cloudinary Plus ($99) | ~91 |
| Resend Pro | ~19 |
| Backups | 8 |
| Domain + Kleinkram | 3 |
| **Summe** | **≈ 155–170 €** |

Der Sprung entsteht fast ausschließlich durch **Cloudinary Plus**.
Vorher prüfen, ob nicht eine einfachere Lösung reicht (z. B. Bilder direkt in
Object Storage, `sharp`-Optimierung beim Upload).

---

## 3. Transaktionskosten (Stripe)

Kein Monatsbeitrag. Pro erfolgreicher Zahlung, deutsche Standardtarife:

| Kartentyp | Gebühr |
|---|---|
| EEA-Karten | 1,5 % + 0,25 € |
| UK-Karten | 2,5 % + 0,25 € |
| Internationale Karten | 3,25 % + 0,25 € |
| SEPA-Lastschrift | 1,0 % + 0,35 € (max. 2 €) |
| Amex | abweichend, meist 2,9 % + 0,30 € |

**Beispiel:** 80 € Anzahlung, 1.000 Buchungen/Saison, 90 % EEA
→ 1.000 × (1,20 € + 0,25 €) = **1.450 €/Saison**.
Das ist ein echter Kostenblock für den Wirt und gehört in seine Kalkulation,
nicht in deine.

**Regel:** Transaktionskosten niemals aus deiner Marge zahlen und niemals
pauschal in deine Monatspauschale einrechnen.

---

## 4. Einmalkosten

| Posten | € einmalig | Trägt |
|---|---|---|
| Domain-Registrierung | 10–15 | Kunde |
| SSL | 0 | – |
| AGB + Widerrufsbelehrung (Anwalt/Generator) | 300–1.500 | Kunde |
| Datenschutzerklärung / AVV-Vorlagen | 0–400 | Kunde |
| Impressum | 0 | Kunde |
| Logo / Fotos | vorhanden | – |
| **Summe** | **310–1.915 €** | Kunde |

Rechtstexte sind **blockierend**: Ohne AGB und Widerruf darf er keine
kostenpflichtigen Reservierungen verkaufen. Das ist kein „nice to have".

---

## 5. Deine internen Kosten

| Posten | €/Monat | Anmerkung |
|---|---|---|
| Infrastruktur für diesen Kunden | 0 | läuft auf seinen Accounts |
| Staging-Server | 0–15 | kann auf einem gemeinsamen Testserver liegen |
| Tooling (Editor, Copilot etc.) | 0–30 | unabhängig von der Kundenzahl |
| Buchhaltung / Steuerberater | 30–80 | ohnehin laufend |
| **Direkt zurechenbar** | **≈ 0 €** | |

**Deine tatsächlichen Kosten sind Zeit, nicht Hosting.** Das ist der wichtigste
Satz in dieser Datei. Wer 40 € Infrastruktur mit 5.000 € Projektpreis
verrechnet, hat die Rechnung nicht verstanden.

---

## 6. Gegenüberstellung: Aufwand vs. Preis

Aufwand nach Briefing: **220–380 Stunden** für den Nachbau,
zzgl. 20–50 Stunden Restaufwand bis Produktionsreife.
Verglichen mit Modell A über 24 Monate (5.900 € + 24 × 179 € = **10.196 €**):

| Aufwand | Honorar | Effektiver Stundensatz |
|---|---|---|
| 220 h | 10.196 € | 46 €/h |
| 300 h | 10.196 € | 34 €/h |
| 380 h | 10.196 € | 27 €/h |

Selbst ein „Freundschaftspreis" von ~8.000–10.000 € über zwei Jahre liegt
**deutlich unter** dem Marktstundensatz von 65–95 €. Das ist in Ordnung – aber
es muss eine **bewusste Entscheidung** sein und einen Gegenwert haben
(Referenz, Produkt-Reuse, Lizenz). Sonst finanzierst du seine Website.

---

## 7. Preis-Szenarien

### Modell A – „Fair & klar" (Empfehlung)

| Position | Betrag |
|---|---|
| Einmalig (3 Raten: Start / Go-Live / nach erstem Fest) | 5.900 € |
| Monatlich Care & Betrieb | 179 € |
| Inklusivleistung | 2 h Änderungen/Monat, Updates, Monitoring, Backups, Reaktion < 2 Werktage |
| Extra-Stunde | 89 € |
| Gesamt 12 Monate | 8.048 € |
| Gesamt 24 Monate | 10.196 € |

### Modell B – „Budget / SaaS"

| Position | Betrag |
|---|---|
| Einmalig | 1.900 € |
| Monatlich, Mindestlaufzeit 24 Monate | 249 € |
| Danach monatlich | 149 € |
| Lizenz | bleibt bei dir, Nutzungsrecht beim Kunden |
| Gesamt 24 Monate | 7.876 € |

### Modell C – „Schlank"

| Position | Betrag |
|---|---|
| Einmalig | 3.500 € |
| Monatlich | 199 € |
| Inklusivleistung | 1 h/Monat |
| Gesamt 12 Monate | 5.888 € |

### Optionaler Erfolgsanteil

Statt höherer Fixkosten: **+0,50–1,00 € pro bezahlter Reservierung**.
Bei 2.000 Reservierungen = 1.000–2.000 €/Jahr. Branchenüblich, für den Kunden
psychologisch leichter, aber mit Nachweisaufwand verbunden (Reporting,
Abstimmung, Streitpotenzial bei Stornos).

**Nicht empfehlenswert als einziges Modell** – dann trägst du das
Auslastungsrisiko des Kunden mit.

---

## 8. Was du auf keinen Fall machen solltest

| Anti-Muster | Warum |
|---|---|
| Einmalig < 3.000 € **und** monatlich < 149 € | Du zahlst drauf, dauerhaft |
| Kostenloses „erst mal machen, dann sehen wir" | Kein Endpunkt, kein Druck, kein Respekt für die Arbeit |
| Pauschale ohne Stundenlimit | „Kannst du noch schnell…" frisst jede Marge |
| Stripe-Gebühren aus eigener Tasche | Skaliert mit seinem Umsatz gegen dich |
| Beteiligung am Festzelt statt Honorar | Freundschaftsrisiko, Bewertungsproblem, kein Cash |
| Rechte vollständig abgeben bei Rabatt | Du verlierst dein einziges wiederverwendbares Asset |
| Rechnung ohne schriftlichen Scope | Beweislast liegt bei dir |

---

## 9. Gegenwert statt Rabatt

Wenn das Budget nicht reicht, Rabatt **gegen Leistung** geben:

| Gegenleistung | Wert für dich |
|---|---|
| Case Study mit Zahlen (Buchungen, Umsatz) | Verkaufsargument, das sonst 1.000 €+ kostet |
| Logo + Testimonial + Namensnennung | Social Proof |
| 2 qualifizierte Referrals aus Wirt-/Vereinsumfeld | direkter Neukundenkanal |
| Recht, die Plattform weiteren Kunden anzubieten | **das eigentliche Produkt** |
| Fotoshooting im Zelt für dein Portfolio | Content |
| Bewirtung bei eigenen Events | kleiner Sachwert, max. 10–15 % |

Der wichtigste Punkt ist die **Lizenz**: Dieses System ist kein Einzelstück,
sondern eine Vorlage für „Reservierung und Ticketing für Festwirte und Vereine".
Sein Rabatt ist deine Produktentwicklung. Das ist die einzige Rechtfertigung,
unter Marktwert zu gehen.

---

## 10. Kostentreiber und Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Galerievolumen sprengt Cloudinary Free | +91 €/Monat | Upload-Limits, Kompression, Alternative prüfen |
| Mailvolumen > 3.000/Monat | +19 €/Monat | nur transaktionale Mails, kein Newsletter |
| Saisonspitze überlastet 4 GB VPS | Ausfall während des wichtigsten Wochenendes | Lasttest, Reserve, Monitoring, ggf. Upgrade |
| Backups fehlen oder ungetestet | Datenverlust = existenzbedrohend für ihn | tägliche externe Backups + Wiederherstellungsprobe |
| Rechtstexte fehlen bei Livegang | Abmahnrisiko | vor Verkaufsstart zwingend klären |
| Unbegrenzte Änderungswünsche | unbezahlte Arbeit | Stundenlimit + 89 €/h schriftlich |
| Scope Creep („noch ein Feature") | Projekt wird nie fertig | Change-Request-Prozess, schriftlich |
| Zahlungsausfall des Kunden | du bist Gläubiger | Raten an Meilensteine binden, Betrieb bei Zahlungsverzug pausieren |

---

## 11. Kurzfazit

- **Infrastruktur kostet 15–45 €/Monat**, nicht mehr. Das ist nicht dein Problem,
  sondern seine Betriebsausgabe.
- **Der Wert liegt bei 15.000–50.000 €** Nachbaukosten zu Marktpreisen.
- **Empfohlenes Angebot:** 5.900 € einmalig + 179 €/Monat, 2 h inklusive.
- **Untergrenze:** 3.500 € + 199 €/Monat. Darunter nur mit schriftlichem
  Gegenwert (Referenz + Lizenz) und klarem Stundenlimit.
- **Immer schriftlich:** Scope, Stunden, Reaktionszeit, Extra-Satz, Laufzeit,
  Kündigung, Lizenz.
- **Vor Livegang zwingend:** AGB, Widerruf, Datenschutz, Backups, Monitoring,
  echte Live-Abnahme.