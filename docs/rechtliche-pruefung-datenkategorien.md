# Rechtliche Prüfung – Datenkategorien und Rechtsgrundlagen

Stand: 14. November 2026. Prüfbasis: `src/lib/privacy-notice.ts`,
`docs/retention-matrix.md`, `docs/konzept-2026-erweiterungen.md`,
`src/db/schema.ts`, `src/lib/required-documents.ts`, `src/app/actions/staff.ts`.

> Hinweis: Diese Prüfung ist **kein Rechtsrat**. Alle als
> `RECHTLICHE PRÜFUNG` markierten Punkte müssen durch den Betreiber bzw.
> anwaltlich geklärt werden, bevor die jeweilige Verarbeitung produktiv
> genutzt wird.

---

## a) Gesundheitszeugnis/IfSG-Belehrung, Schwerbehinderung, ELStAM/Religionsmerkmal → Art. 9?

### Dokumentierte Rechtsgrundlage

- `src/lib/privacy-notice.ts` (Mitarbeiter-Abschnitt): „Gesundheitsdaten
  verarbeiten wir nur soweit erforderlich auf Grundlage von Art. 9 Abs. 2
  lit. b DSGVO i. V. m. §§ 22, 26 BDSG.“
- `docs/retention-matrix.md`: Ausweis/Gesundheitszeugnis –
  „Art. 9 Abs. 2 lit. b, § 22 BDSG“.
- `docs/konzept-2026-erweiterungen.md` § 11.1: „Keine
  Gesundheitsdiagnosen speichern; Gesundheitszeugnis nur als Nachweis mit
  Ablaufdatum.“

### Bewertung

- **Gesundheitszeugnis (§ 43 IfSG):** Ist ein Gesundheitsdatum im Sinne
  von Art. 9 DSGVO, weil es die gesundheitliche Eignung für Tätigkeiten
  mit Lebensmitteln bescheinigt. Die dokumentierte Grundlage
  Art. 9 Abs. 2 lit. b (Beschäftigungs-/Sozialrecht/Sozialschutz) i. V. m.
  §§ 22, 26 BDSG ist grundsätzlich passend, setzt aber voraus, dass die
  Verarbeitung „erforderlich“ ist und keine überwiegenden Interessen der
  betroffenen Person entgegenstehen (§ 22 Abs. 2 BDSG). Die
  Erforderlichkeit ist nur gegeben, wenn das Zeugnis tatsächlich für die
  konkrete Tätigkeit (Küche/Ausschank mit Lebensmitteln) benötigt wird und
  nicht pauschal für alle Rollen erhoben wird.
- **Schwerbehinderung:** Wird im Code/Schema (`staff`) **nicht** erfasst.
  Falls künftig erfasst (z. B. für Schwerbehindertenquote, Kündigungsschutz,
  Nachteilsausgleich), fehlt eine dokumentierte Rechtsgrundlage.
  Mögliche Grundlagen: Art. 9 Abs. 2 lit. b oder lit. h DSGVO i. V. m.
  § 26 BDSG bzw. § 154 SGB IX. Die Verarbeitung von
  Schwerbehinderungsdaten ist besonders streng und bedarf einer klaren
  Zweckbindung.
- **ELStAM/Religionsmerkmal:** Die ELStAM enthalten das Religionsmerkmal
  (Kirchensteuerabzug). Religion ist eine besondere Kategorie (Art. 9
  DSGVO). Die Verarbeitung erfolgt für Lohnsteuerabzug (§ 39e EStG). Im
  System wird das Religionsmerkmal nicht explizit gespeichert, aber die
  Steuer-ID und Steuerklasse (`taxIdEnc`, `taxClass`) werden erfasst.
  Eine dokumentierte Rechtsgrundlage für das Religionsmerkmal fehlt
  vollständig.

### Lücken / zusätzliche Schutzmaßnahmen

- > ⚠️ RECHTLICHE PRÜFUNG: Ist die Erhebung des Gesundheitszeugnisses
  > (§ 43 IfSG) auf die Rollen beschränkt, die tatsächlich mit
  > Lebensmitteln arbeiten (Küche, Ausschank)? Eine pauschale Erhebung
  > für alle Rollen verletzt Art. 5 Abs. 1 lit. c (Datenminimierung) und
  > § 22 BDSG. Die Rolle „gesundheitszeugnis erforderlich“ ist im Schema
  > (`staffRoles.requiredDocuments`) vorhanden, aber nicht zwingend
  > durchgesetzt.
- > ⚠️ RECHTLICHE PRÜFUNG: Die Gesundheitszeugnis-Datei liegt bei
  > Cloudinary (Ordner `maurer-events/staff`). Eine Verschlüsselung at rest
  > durch die Anwendung ist für Dateien **nicht** dokumentiert (nur für
  > TaxID/SV/IBAN via AES-256-GCM). Prüfen, ob Cloudinary-seitige
  > Verschlüsselung/AVV ausreicht oder ob eine app-seitige Verschlüsselung
  > der Datei erforderlich ist.
- > ⚠️ RECHTLICHE PRÜFUNG: Zugriffsmatrix für Gesundheitsdaten: Nur
  > berechtigte Rollen (Wirt/Admin) dürfen die Datei einsehen; Audit-Log
  > für Downloads ist dokumentiert, aber nicht für alle Zugriffe belegt.
- > ⚠️ RECHTLICHE PRÜFUNG: Für Schwerbehinderung und ELStAM/Religion
  > fehlt eine dokumentierte Rechtsgrundlage. Falls diese Daten nicht
  > erhoben werden, muss dies im Verzeichnis der Verarbeitungstätigkeiten
  > und in der Datenschutzerklärung ausdrücklich als „nicht erhoben“
  > dokumentiert werden.
- > ⚠️ RECHTLICHE PRÜFUNG: Zusätzliche TOMs: Datenminimierung (nur
  > Status + Ablaufdatum speichern, nicht den Dateiinhalt auswerten),
  > Löschfrist (Exit + 365 Tage) ist dokumentiert, aber nicht automatisch
  > für alle Dokumente durchgesetzt (nur über Cron-Job).

---

## b) Ausweis-Kopie: erforderlich? Schwärzung/Alternativen (§ 20 PAuswG)

### Dokumentierte Praxis

- `docs/konzept-2026-erweiterungen.md` § 7.4: „Ausweis: Verify-and-delete –
  Admin prüft, bestätigt (`idVerifiedAt`), Scan wird nach 30 Tagen
  automatisch gelöscht. Nur wenn der Wirt die Kopie zwingend aufbewahren
  muss, wird sie verschlüsselt gespeichert.“
- `docs/retention-matrix.md`: Ausweis/Gesundheitszeugnis – Exit + 365 Tage.
- `src/db/schema.ts`: `staffDocuments.kind = 'id_card'`, Status
  `pending | verified | rejected`, `verifiedBy`, `verifiedAt`.

### Bewertung

- § 20 PAuswG verbietet das Kopieren/Verwenden des Personalausweises
  außerhalb gesetzlich bestimmter Fälle. Eine Kopie ist nur zulässig, wenn
  eine Rechtsnorm dies ausdrücklich vorschreibt oder eine wirksame
  Einwilligung vorliegt. Für Minijobs/geringfügige Beschäftigung ist eine
  Ausweiskopie **nicht** gesetzlich vorgeschrieben (die Identitätsprüfung
  kann durch Sichtprüfung erfolgen).
- Die dokumentierte Praxis (Verify-and-delete) ist der datenschutzfreundliche
  Weg, aber die Rechtsgrundlage für die 30-Tage-Aufbewahrung und die
  Ausnahme („wenn der Wirt die Kopie zwingend aufbewahren muss“) sind
  nicht dokumentiert.

### Lücken

- > ⚠️ RECHTLICHE PRÜFUNG: Ist die Erhebung einer Ausweis-Kopie überhaupt
  > erforderlich? Alternativen: Sichtprüfung durch Admin, Verifikation
  > ohne Speicherung, oder Verwendung eines Ausweis-Prüfgeräts. Wenn nur
  > die Identität geprüft werden soll, ist keine Kopie nötig.
- > ⚠️ RECHTLICHE PRÜFUNG: Falls eine Kopie aufbewahrt wird (z. B. auf
  > Wunsch des Wirtes), muss § 20 PAuswG geprüft werden: Ist eine
  > Einwilligung erforderlich? Muss die Kopie geschwärzt werden
  > (Seriennummer, Zugangsnummer, maschinenlesbare Zone)? Welche Felder
  > dürfen gespeichert werden?
- > ⚠️ RECHTLICHE PRÜFUNG: Die Rechtsgrundlage für die Aufbewahrung (Art. 6
  > Abs. 1 lit. c? § 26 BDSG? Einwilligung?) ist nicht dokumentiert.
  > Insbesondere fehlt die Prüfung, ob eine Einwilligung (Art. 7 DSGVO)
  > wirksam eingeholt werden kann (Freiwilligkeit bei
  > Beschäftigungsverhältnis).
- > ⚠️ RECHTLICHE PRÜFUNG: Die Löschfrist von 30 Tagen nach Verifikation
  > ist technisch dokumentiert, aber nicht in der Datenschutzerklärung
  > erwähnt. Außerdem: Was passiert, wenn der Wirt die Kopie „zwingend
  > aufbewahren muss“? Welche gesetzliche Grundlage rechtfertigt dies?

---

## c) Datenminimierung: welche Felder/Uploads sind für den Zweck entbehrlich?

### Dokumentierte Felder

- `staff`: `firstName`, `lastName`, `email`, `phone`, `birthDate`, `street`,
  `zip`, `city`, `roleId`, `status`, `employmentType`, `hourlyRateCents`,
  `monthlySalaryCents`, `taxIdEnc`, `taxClass`, `childAllowances`,
  `socialSecurityEnc`, `healthInsurance`, `ibanEnc`, `bic`, `entryDate`,
  `exitDate`, `privacyVersion`, `privacyAcceptedAt`.
- `staffDocuments`: `id_card`, `health_certificate`, `tax_card`,
  `minijob_form`, `other`.
- `customers`: `displayName`, `company`, `email`, `phone`, `street`, `zip`,
  `city`, `notes`, `marketingConsent`.
- `staffAvailability`, `staffAssignments`, `eventStaffRequirements` (Zeiten,
  Status).

### Bewertung

- Art. 5 Abs. 1 lit. c DSGVO verlangt, dass Daten auf das für den Zweck
  Erforderliche beschränkt werden. Für die Lohnabrechnung sind Steuer-ID,
  Steuerklasse, SV-Nummer, IBAN, BIC erforderlich. Für die Durchführung des
  Beschäftigungsverhältnisses sind Name, E-Mail, Rolle, Status,
  Eintrittsdatum, Vergütung erforderlich.
- Potenziell entbehrliche Felder: `phone` (nur wenn für Schichtkommunikation
  nötig), `birthDate` (für Minijob-Altersprüfung, sonst entbehrlich),
  `street/zip/city` (für Lohnabrechnung/DATEV, aber nicht für
  Schichtplanung), `healthInsurance` (nur bei bestimmten
  Beschäftigungsarten), `notes` (Freitext, Risiko), `childAllowances` (nur
  wenn lohnrelevant).
- Uploads: `other` (freier Dokumenttyp) und `Arbeitszeugnis` sind nicht
  zwingend erforderlich; `Führerschein` nur bei bestimmten Rollen.

### Lücken

- > ⚠️ RECHTLICHE PRÜFUNG: Welche Felder sind für welche Rolle/Zweck
  > tatsächlich erforderlich? Vorschlag: Felder als „Pflicht“ oder
  > „optional“ kennzeichnen und pro Rolle (`staffRoles`) definieren, welche
  > Dokumente/Felder benötigt werden. Derzeit sind alle Felder für alle
  > Mitarbeiter gleich.
- > ⚠️ RECHTLICHE PRÜFUNG: `notes` (Freitext) in `customers` und
  > `staff` kann personenbezogene Daten enthalten, die nicht dem Zweck
  > entsprechen. Prüfen, ob ein Freitextfeld erforderlich ist oder durch
  > strukturierte Felder ersetzt werden sollte.
- > ⚠️ RECHTLICHE PRÜFUNG: Uploads: `other` und `Arbeitszeugnis` sind
  > nicht zwingend für die Durchführung des Beschäftigungsverhältnisses.
  > Prüfen, ob diese Uploads entfallen können oder eine Rechtsgrundlage
  > (Art. 6 Abs. 1 lit. f?) haben.
- > ⚠️ RECHTLICHE PRÜFUNG: `birthDate` wird für Altersprüfung
  > (Mindestalter 18 bei Küche) benötigt, aber nicht für alle Rollen.
  > Prüfen, ob die Altersprüfung durch eine Ja/Nein-Information („über
  > 18“) ersetzt werden kann.
- > ⚠️ RECHTLICHE PRÜFUNG: `marketingConsent` bei Kunden: Einwilligung
  > muss nach Art. 7 DSGVO nachweisbar sein (Zeitstempel, Version). Im
  > Schema vorhanden, aber Prüfung der Wirksamkeit (Freiwilligkeit,
  > Widerruf) fehlt.

---

## d) Schichtsystem: Verhalten/Leistung erfassen (Zeiten, No-Show, Bewertungen)? Mitbestimmung § 87 BetrVG und Art. 22

### Dokumentierte Daten

- `staffAvailability`: `available | unavailable | preferred`, Zeitfenster.
- `staffAssignments`: `status` (`proposed | accepted | declined | confirmed`),
  `source` (`auto | manual`).
- `shiftOffers`: Selbst-Eintragungen (`source='self'`).
- `staffing.ts`: Bedarfsrechnung, Zuweisung (Greedy, Score: Präferenz +
  Fairness + Kontinuität), Warnungen (> 10 h/Tag, Ruhezeit, Minderjährige).
- `staff.ts`: Offboarding, Löschung.

### Bewertung

- **Verhalten/Leistung:** Das System erfasst Zeiten, Zuweisungsstatus,
  Selbst-Eintragungen und Verfügbarkeit. Es erfasst **keine**
  Leistungsbewertungen, keine No-Show-Protokollierung und keine
  Produktivitätsmetriken. Allerdings entsteht aus den Daten (Zuweisungen,
  Absagen, Selbst-Eintragungen) ein implizites Verhaltensprofil.
- **§ 87 BetrVG:** Bei Betrieben mit Betriebsrat sind Arbeitszeit,
  Pausen, Schichtpläne und die Einführung technischer Einrichtungen zur
  Überwachung mitbestimmungspflichtig. Die automatisierte Zuweisung von
  Schichten (Greedy-Algorithmus mit Scoring) kann als technische
  Einrichtung zur Überwachung gelten, wenn sie Leistungs- oder
  Verhaltensdaten erfasst.
- **Art. 22 DSGVO:** Automatisierte Entscheidungen, die rechtliche
  Wirkung entfalten oder ähnlich erheblich beeinträchtigen, bedürfen
  besonderer Rechtfertigung. Die automatische Schichtzuweisung könnte als
  Profiling gelten, wenn sie Beschäftigte systematisch bewertet. Da die
  Zuweisung aber nur ein Vorschlag ist und der Admin manuell überschreiben
  kann, ist die Rechtslage unklar.

### Lücken

- > ⚠️ RECHTLICHE PRÜFUNG: Erfasst das System Verhaltens- oder
  > Leistungsdaten? Wenn Zeiten, No-Show, Absagen oder Bewertungen erfasst
  > werden, muss dies als Verarbeitung personenbezogener Daten (ggf.
  > Art. 88 DSGVO, § 26 BDSG) dokumentiert werden. Derzeit ist keine
  > No-Show-Erfassung implementiert, aber die Zuweisungsdaten können als
  > Verhaltensprofil genutzt werden.
- > ⚠️ RECHTLICHE PRÜFUNG: § 87 BetrVG: Bei Vorhandensein eines
  > Betriebsrates muss die Einführung des Schichtsystems (insbesondere
  > automatisierte Zuweisung) mitbestimmt werden. Prüfen, ob ein
  > Betriebsrat existiert und ob eine Betriebsvereinbarung erforderlich ist.
- > ⚠️ RECHTLICHE PRÜFUNG: Art. 22 DSGVO: Die automatisierte
  > Schichtzuweisung (Greedy + Scoring) muss auf ihre Eignung als
  > „automatisierte Entscheidung“ geprüft werden. Wenn sie
  > Beschäftigte erheblich beeinträchtigt (z. B. durch systematische
  > Benachteiligung bei der Schichtvergabe), ist eine DSFA und/oder
  > menschliche Überprüfung erforderlich.
- > ⚠️ RECHTLICHE PRÜFUNG: Die Warnungen (z. B. > 10 h/Tag, Ruhezeit)
  > sind Arbeitszeitgesetz-relevant (ArbZG). Prüfen, ob diese Warnungen
  > dokumentiert und bei Verstößen protokolliert werden müssen.
- > ⚠️ RECHTLICHE PRÜFUNG: Keine Leistungsbewertung dokumentiert, aber
  > der Fairness-Score („wenige bisherige Einsätze“) könnte als
  > Leistungsbewertung interpretiert werden. Prüfen, ob dies transparent
  > gemacht werden muss (Art. 13/14, Art. 22 Abs. 3).

---

## e) DSFA-Pflicht Art. 35 (Art. 9 + systematische Bewertung Beschäftigter)

### Bewertung

- Art. 35 Abs. 1 DSGVO verpflichtet zur DSFA bei Verarbeitungen, die
  voraussichtlich ein hohes Risiko für die Rechte und Freiheiten
  natürlicher Personen zur Folge haben. Art. 35 Abs. 3 lit. a und b
  sowie die WP29/EDPB-Leitlinien nennen als Beispiele: systematische
  umfassende Bewertung von Beschäftigten (Profiling) und Verarbeitung
  besonderer Kategorien (Art. 9).
- Die Kombination aus Art. 9-Daten (Gesundheitszeugnis) und systematischer
  Bewertung (Schichtzuweisung, Verfügbarkeit, Lohn, Verträge) spricht
  **stark für eine DSFA-Pflicht**. Zudem handelt es sich um eine
  umfassende Personalverwaltung mit automatisierter Zuweisung.

### Vorgeschlagene Struktur einer DSFA

1. **Beschreibung der Verarbeitung**
   - Datenkategorien (Stammdaten, Lohn, Gesundheit, Dokumente,
     Schichten, Verträge, Audit-Logs).
   - Zwecke (Beschäftigungsverhältnis, Lohnabrechnung, Schichtplanung,
     Vertragsmanagement).
   - Rechtsgrundlagen (Art. 6, Art. 9, § 26 BDSG, §§ 147 AO, 257 HGB).
2. **Erforderlichkeit und Verhältnismäßigkeit**
   - Datenminimierung, Zweckbindung, Speicherbegrenzung.
   - Prüfung, ob weniger eingreifende Mittel (z. B. Sichtprüfung statt
     Ausweiskopie) ausreichen.
3. **Risikobewertung**
   - Risiken für Betroffene (Offenlegung von Gesundheitsdaten,
     Diskriminierung durch Schichtzuweisung, Datenlecks).
   - Eintrittswahrscheinlichkeit und Schwere.
4. **Maßnahmen (TOMs)**
   - Verschlüsselung (AES-256-GCM für sensible Felder, TLS).
   - RBAC, Audit-Log, Löschkonzept (Retention-Matrix).
   - Pseudonymisierung/Anonymisierung bei Löschung.
   - Zugriffsbeschränkung (Festleiter sieht nur Roster).
5. **Konsultation**
   - Datenschutzbeauftragter (falls bestellt).
   - Betriebsrat (falls vorhanden).
   - Betroffene (Mitarbeiterinformation).
6. **Ergebnis und Dokumentation**
   - Restrisiko, Freigabe, Datum, Verantwortlicher.
   - Regelmäßige Überprüfung (z. B. jährlich oder bei Änderungen).

### Lücken

- > ⚠️ RECHTLICHE PRÜFUNG: Es ist **keine DSFA vorhanden**. Die
  > Kombination aus Art. 9-Daten und systematischer Bewertung
  > (Schichtzuweisung) spricht für eine DSFA-Pflicht nach Art. 35
  > DSGVO. Eine DSFA muss vor Inbetriebnahme durchgeführt und
  > dokumentiert werden.
- > ⚠️ RECHTLICHE PRÜFUNG: Falls ein Datenschutzbeauftragter bestellt
  > ist, muss dieser in die DSFA einbezogen werden (Art. 35 Abs. 2). Die
  > Bestellung eines DSB ist bei dieser Datenverarbeitung wahrscheinlich
  > erforderlich (Art. 37 DSGVO).
- > ⚠️ RECHTLICHE PRÜFUNG: Die DSFA muss bei wesentlichen Änderungen
  > (neue Datenkategorien, neue Algorithmen) aktualisiert werden.
  > Derzeit ist kein Prozess für die Aktualisierung dokumentiert.

---

## f) Informationspflichten Art. 13/14 für Bewerber, Mitarbeiter, Gäste

### Dokumentierte Praxis

- `src/lib/privacy-notice.ts`: Abschnitte für Kontakt/Bewerbungen,
  Reservierungen, Mitarbeiter, Bilder etc. mit Rechtsgrundlagen.
- `src/db/schema.ts`: `staff.privacyVersion`, `staff.privacyAcceptedAt`.
- `docs/konzept-2026-erweiterungen.md` § 11.7: „Die Reservierungsanfrage
  speichert lediglich `privacyVersion` + `privacyAcceptedAt`.“
- Onboarding-Flow: Vertrag lesen → akzeptieren → unterschreiben (Consent-
  Version gespeichert).

### Bewertung

- **Gäste (Reservierung):** Art. 13 DSGVO bei Erhebung bei der
  betroffenen Person. Die Datenschutzerklärung ist vorhanden, aber die
  Verlinkung zum Erhebungszeitpunkt (Checkout/Warteliste) muss geprüft
  werden. Ein Checkbox-Hinweis mit Link ist dokumentiert
  („Datenschutz-Checkbox mit Link“), aber die konkrete Umsetzung ist
  nicht belegt.
- **Bewerber (Karriereseite per E-Mail):** Art. 13/14 DSGVO. Die
  Datenschutzerklärung erwähnt Bewerbungen (Abschnitt 4), aber es fehlt
  eine gezielte Information bei der Bewerbung (z. B. Hinweis auf
  Speicherdauer 6 Monate, Rechte). Die Bewerbung erfolgt per E-Mail, nicht
  über ein Formular, daher ist die Information schwieriger zu gewährleisten.
- **Mitarbeiter (Onboarding):** Art. 13 DSGVO. Die Datenschutzerklärung
  ist umfassend, und die Einwilligung wird beim Onboarding gespeichert
  (`privacyVersion`, `privacyAcceptedAt`). Allerdings fehlt eine
  gezielte, zum Erhebungszeitpunkt bereitgestellte Information, die
  spezifisch auf die Mitarbeiterdaten eingeht (z. B. in einem separaten
  Dokument oder Modal).

### Lücken

- > ⚠️ RECHTLICHE PRÜFUNG: Sind die Informationen nach Art. 13/14
  > **zum Erhebungszeitpunkt** verlinkt? Prüfen in folgenden Flows:
  > - Reservierungs-Checkout (Datenschutz-Checkbox mit Link).
  > - Wartelisten-Formular.
  > - Kontaktformular.
  > - Karriere-Bewerbung (per E-Mail – wie wird informiert?).
  > - Mitarbeiter-Onboarding (separater Hinweis oder nur allgemeine
  >   Datenschutzerklärung?).
- > ⚠️ RECHTLICHE PRÜFUNG: Für Bewerber fehlt eine gezielte
  > Information über Speicherdauer (6 Monate) und Rechte. Die allgemeine
  > Datenschutzerklärung reicht möglicherweise nicht aus, da die
  > Erhebung nicht über ein Formular erfolgt.
- > ⚠️ RECHTLICHE PRÜFUNG: Für Mitarbeiter fehlt eine spezifische
  > Mitarbeiter-Datenschutzinformation (Art. 13). Die allgemeine
  > Datenschutzerklärung ist für Beschäftigte möglicherweise nicht
  > ausreichend detailliert (z. B. keine Information über
  > Schichtzuweisung, Scoring, Audit-Logs).
- > ⚠️ RECHTLICHE PRÜFUNG: Art. 14 (Erhebung bei Dritten): Falls
  > Mitarbeiterdaten von Dritten erhoben werden (z. B. SnapTicket-Import
  > für Kunden, oder Steuerberater-Daten), fehlt eine Information an die
  > Betroffenen. Der CSV-Import (`customer_imports`) verarbeitet Daten,
  > die nicht direkt vom Betroffenen stammen.
- > ⚠️ RECHTLICHE PRÜFUNG: Die Datenschutzerklärung muss bei Änderungen
  > aktualisiert und die neue Version den Betroffenen mitgeteilt werden.
  > Der Mechanismus (`privacyVersion` + `privacyAcceptedAt`) ist für
  > Mitarbeiter vorhanden, aber nicht für Gäste/Kunden.

---

## Zusammenfassung der Lücken

| # | Datenkategorie | Hauptrisiko | Priorität |
|---|----------------|-------------|-----------|
| a | Gesundheitszeugnis/IfSG, Schwerbehinderung, ELStAM/Religion | Fehlende Rechtsgrundlage für Schwerbehinderung/Religion; TOMs für Dateien | Hoch |
| b | Ausweis-Kopie | § 20 PAuswG; Erforderlichkeit; Schwärzung; Einwilligung | Hoch |
| c | Datenminimierung | Zu viele Felder/Uploads für alle Rollen; Freitextfelder | Mittel |
| d | Schichtsystem | Mitbestimmung § 87 BetrVG; Art. 22 Profiling; Verhaltensprofile | Mittel-Hoch |
| e | DSFA | Keine DSFA vorhanden; Kombination Art. 9 + systematische Bewertung | Hoch |
| f | Informationspflichten Art. 13/14 | Fehlende Verlinkung zum Erhebungszeitpunkt; keine Mitarbeiter-Datenschutzinfo | Mittel |

> ⚠️ RECHTLICHE PRÜFUNG: Alle oben genannten Punkte sind als Prüfbedarf
> zu verstehen und müssen vor produktivem Einsatz der jeweiligen
> Verarbeitung durch den Betreiber bzw. anwaltlich geklärt werden. Diese
> Dokumentation ersetzt keine Rechtsberatung.