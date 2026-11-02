# Prüfauftrag Rechtstexte – Maurer Events

> **Zweck:** Dieses Dokument begleitet die Entwürfe von AGB, Stornobedingungen und
> Widerrufsseite. Es beschreibt, was das System tatsächlich tut, damit die Prüfung
> nicht auf Vermutungen beruht, und listet die offenen Fragen.
>
> **Status:** Entwurf. Keine anwaltliche Prüfung erfolgt. Kein Verkauf auf dieser
> Grundlage.

---

## 1. Was geprüft werden soll

| Dokument | Datei | Öffentliche URL |
| --- | --- | --- |
| Allgemeine Geschäftsbedingungen | `src/lib/legal/terms.ts` → `agb` | `/agb` |
| Stornobedingungen | `src/lib/legal/terms.ts` → `stornobedingungen` | `/stornobedingungen` |
| Widerrufsrecht | `src/lib/legal/terms.ts` → `widerruf` | `/widerruf` |
| Datenschutzerklärung | `src/lib/privacy-notice.ts` | `/datenschutz` |
| Impressum | `src/app/[locale]/impressum/page.tsx` | `/impressum` |

Alle Texte liegen zentral in `src/lib/legal/terms.ts`. Änderungen dort wirken
sofort auf die Website.

Solange die Prüfung läuft, zeigen die Seiten einen Hinweis „wird derzeit
rechtlich geprüft" und sind auf `noindex` gesetzt. Der Hinweis wird nach Freigabe
über die Konstante `LEGAL_REVIEW_PENDING` abgeschaltet.

---

## 2. Was tatsächlich verkauft wird

Damit die Prüfung am realen Produkt ansetzt:

1. Der Gast wählt auf der Website eine **Veranstaltung**, einen **Tag**, ein
   **Zeitfenster** und ein **Verzehrpaket** (Preis pro Person).
2. Optional wählt er einen **Tisch** auf einem Zeltplan. VIP-Tische haben einen
   Aufpreis.
3. Bei den meisten Veranstaltungen muss die **gesamte Tischkapazität** gebucht
   werden (Systemeinstellung, pro Veranstaltung abschaltbar).
4. Es wird eine **Service- und Buchungsgebühr** aufgeschlagen (Standard 1,5 % +
   0,25 €, pro Veranstaltung konfigurierbar).
5. Der Gast zahlt **vorab über Stripe** (Karte, PayPal, Klarna, SEPA-Lastschrift).
6. Nach Zahlung erhält er ein **PDF-Ticket mit QR-Code** per E-Mail.
7. Der QR-Code wird am Einlass **einmalig entwertet**.
8. Die Zahlung wird als **Verzehrguthaben** für die Veranstaltung gewertet.
   Im Checkout steht wörtlich: „(Davon X € als Gutschein)".

**Wichtig für die Prüfung:** Es gibt derzeit **keine Buchung ohne Paket**. Der
Paketpreis ist immer Bestandteil des Vertrags. Ein reiner Tisch ohne
Verzehrkomponente ist technisch nicht buchbar.

**Ebenfalls wichtig:** Das Guthaben ist an die Veranstaltung gebunden. Eine
Barauszahlung nicht verbrauchten Guthabens ist im Entwurf ausgeschlossen.

---

## 3. Annahmen im Entwurf, die bestätigt oder korrigiert werden müssen

Diese Werte sind gesetzt, aber nicht vom Betreiber entschieden:

| Annahme | Wert im Entwurf | Steht in |
| --- | --- | --- |
| Kostenfreie Stornofrist | 7 Tage vor dem Zeitfenster | Stornobedingungen § 2 |
| Teilerstattung danach | 50 % bis 48 Stunden vorher | Stornobedingungen § 2 |
| Erstattung unter 48 h | ausgeschlossen | Stornobedingungen § 2 |
| Rückzahlungsfrist | 14 Tage nach Bestätigung | Stornobedingungen § 3 |
| Erstattung der Buchungsgebühr | bei fristgerechter Stornierung ja, danach nein | Stornobedingungen § 2 |
| Umbuchung | einmalig kostenfrei bis Ende der Stornofrist | Stornobedingungen § 4 |
| Witterung | Festzelt, therefore kein Stornogrund | Stornobedingungen § 6 |

Bitte prüfen, ob diese Werte AGB-rechtlich haltbar sind, und ob sie
kaufmännisch zum Betrieb passen.

---

## 4. Offene Fragen

### A. Widerrufsrecht – höchste Priorität

1. Greift die Ausnahme des **§ 312g Abs. 2 Nr. 9 BGB** auf diese Buchung zu?
   Die Buchung ist an Veranstaltung, Tag und Zeitfenster gebunden.
2. **Kernproblem:** Der Preis wird gegenüber dem Gast als **Gutschein** bzw.
   Verzehrguthaben bezeichnet. Nimmt dieser Gutscheinanteil der Buchung die
   Terminbezogenheit, sodass die Ausnahme **nicht** greift? Falls ja: Muss die
   Formulierung im Checkout geändert werden („Guthaben" statt „Gutschein")?
3. Falls ein Widerrufsrecht besteht: Wird die **Muster-Widerrufsbelehrung nach
   Art. 246a EGBGB** benötigt, einschließlich Muster-Widerrufsformular? Wir
   können sie technisch innerhalb eines Tages ergänzen.
4. Gilt die Ausnahme auch für die **Service- und Buchungsgebühr** als
   eigenständigen Dienstleistungsanteil, oder ist sie dort anders zu bewerten?
5. Ändert sich die Bewertung, wenn ein Gast **ohne Tischwahl** bucht
   (freie Platzwahl, aber weiterhin terminiert)?
6. Ist die Einschränkung auf Verbraucher in Abschnitt 4 der Widerrufsseite
   ausreichend formuliert?

### B. Vertragsschluss und Button

7. Der Entwurf sagt: Vertrag kommt mit der **Bestätigung** zustande, spätestens
   mit der Buchungsbestätigung. Ist das mit der Tatsache vereinbar, dass die
   Zahlung **vor** der Bestätigung eingezogen wird? Oder sollte der Vertrag
   bereits mit erfolgreicher Zahlung zustande kommen?
8. Ist der Button-Text **„Jetzt zahlungspflichtig buchen"** ausreichend im Sinne
   von § 312j Abs. 3 BGB?
9. Muss die **Service- und Buchungsgebühr** zwingend im unmittelbaren
   Button-Umfeld stehen (PAngV), oder genügt die Anzeige in der
   Bestellübersicht darüber?
10. Bei **SEPA-Lastschrift** mit verzögerter Gutschrift: Wann ist der Vertrag
    geschlossen, und wie ist die Formulierung „erst mit tatsächlicher
    Zahlungsbestätigung" zu bewerten?
11. Reicht der Satz „Der Vertragsschluss steht unter dem Vorbehalt der
    Verfügbarkeit" für den Fall einer **Doppelbuchung** durch zwei Gäste
    gleichzeitig aus?

### C. Verzehrguthaben

12. Ist der **Verfall des Guthabens mit Ende der Veranstaltung** zulässig, oder
    greifen die gutscheinrechtlichen Grundsätze (Verjährung nach § 195 BGB,
    dreijährige Gültigkeit)?
13. Muss ein **Restguthaben ausgezahlt** werden, wenn der Gast weniger verzehrt
    als vorausgezahlt?
14. Ist die Checkout-Formulierung „(Davon X € als Gutschein)" irreführend und
    sollte geändert werden?
15. **Umsatzsteuer:** Entsteht die Umsatzsteuer mit der Anzahlung oder erst mit
    Einlösung des Guthabens? Das muss mit der Buchhaltung abgestimmt werden –
    die Antwort hat Auswirkungen auf Rechnungsstellung und Stripe-Abrechnung.

### D. Storno und Nichterscheinen

16. Sind **50 % Erstattung zwischen 7 Tagen und 48 Stunden** vor dem Termin
    wirksam, oder ist das als unangemessene Benachteiligung zu bewerten?
17. Reicht der Satz zum **Gegenbeweis eines geringeren Schadens** bei
    Nichterscheinen (§ 309 Nr. 5 BGB), oder braucht es eine konkrete
    Berechnungsgrundlage?
18. Nach welcher **Wartezeit** darf der Tisch bei verspäteter Ankunft anderweitig
    vergeben werden? Im Entwurf steht „Ende des gebuchten Zeitfensters".
19. Ist die Aussage **„Festzelt, daher witterungsunabhängig"** haltbar, wenn das
    Zelt bei Sturm oder behördlicher Anordnung geschlossen werden muss?

### E. Haftung

20. Ist die Haftungsbegrenzung in Abschnitt 15 angemessen, oder ist sie zu weit
    bzw. zu eng gefasst?
21. Ist der **Haftungsausschluss für Garderobe** zulässig?
22. Wie ist die Haftung für **Sachschäden durch Gäste** zu regeln?

### F. Formalien

23. Ist die **Anbieterkennzeichnung** vollständig? Insbesondere: Ist die
    Rechtsform korrekt bezeichnet (Einzelunternehmen, e. K., GbR)? Bei einer GbR
    müssten alle Gesellschafter genannt werden. Eine **USt-IdNr.** fehlt im
    Impressum.
24. Reicht der **Verweis auf die Datenschutzerklärung** aus den AGB?
25. Die **EU-Plattform zur Online-Streitbeilegung** wurde zum **20. Juli 2025**
    eingestellt. Der Entwurf enthält daher keinen Link mehr. Ist die gewählte
    Formulierung zur Verbraucherschlichtung korrekt?
26. Ist die **Änderungsklausel** in Abschnitt 18 ausreichend?
27. Ist die **Gerichtsstandsklausel** gegenüber Verbrauchern wirksam?
28. Die Website ist **zweisprachig**, die Rechtstexte sind **nur deutsch**.
    Reicht das, oder ist eine englische Fassung erforderlich? Falls ja: Welche
    Fassung ist im Zweifel maßgeblich, und wie ist das zu formulieren, ohne
    gegen das Transparenzgebot zu verstoßen?

### G. Ergänzend

29. Wird eine **Widerrufsbelehrung im Checkout** als eigener, abhakbarer Punkt
    benötigt, oder genügt der Linktext?
30. Braucht es eine **Einwilligung in die Hausordnung** als eigenen
    Zustimmungspunkt?
31. Ist für den **Ticket-Weiterverkauf** eine Regelung erforderlich?
32. Welche Angaben fehlen Ihnen für eine belastbare Prüfung?

---

## 5. Technischer Ist-Zustand, der die Texte stützt

| Thema | Umsetzung |
| --- | --- |
| Zahlung | Stripe Checkout, Zahlung vor Bestätigung |
| Statusmodell | `pending`, `paid`, `confirmed`, `checked_in`, `cancelled`, `expired`, `refunded`, `disputed` |
| Ticket | PDF mit QR-Code, serverseitig einmalig entwertbar |
| Erstattung | technisch möglich; Auslösung derzeit manuell im Stripe-Dashboard |
| Teilerstattung | wird im Buchungsstatus **nicht** abgebildet |
| Stornofrist | Systemeinstellung `cancellationDays`, Standard 7 Tage |
| Buchungsfenster | Öffnung 90 Tage vorher, Schluss 2 Stunden vorher |
| Max. Buchungen pro E-Mail | 2 |
| Widerspruch gegen Zahlung | Status `disputed` wird gesetzt, Ticket wird ungültig |

**Hinweis zur Teilerstattung:** Eine teilweise Rückzahlung ändert den
Buchungsstatus nicht. Das ist für die Prüfung relevant, weil die AGB eine
Teilerstattung vorsehen, das System sie aber derzeit nicht abbildet.

---

## 6. Was nach der Prüfung passiert

1. Texte in `src/lib/legal/terms.ts` einarbeiten
2. `LEGAL_REVIEW_PENDING = false` setzen (Hinweis verschwindet, `noindex` fällt weg)
3. Angaben im Impressum und in der Datenschutzerklärung abgleichen
4. Bei Bedarf: Widerrufsbelehrung als eigene Seite ergänzen
5. Storno-Text in die Bestätigungsmail übernehmen (letzter offener Punkt im Code)

---

## 7. Was der Anwalt von uns bekommt

### Direkte Links

> **Voraussetzung:** Die Seiten sind im Code fertig, aber noch **nicht deployt**.
> Auf Staging und Produktion liefern `/agb` und `/widerruf` derzeit 404. Erst nach
> einem Deployment sind die Links von außen erreichbar.

| Dokument | Staging | Produktion |
| --- | --- | --- |
| AGB | `https://maurer-events.madebylui.net/agb` | `https://maurer-events.com/agb` |
| Stornobedingungen | `https://maurer-events.madebylui.net/stornobedingungen` | `https://maurer-events.com/stornobedingungen` |
| Widerrufsrecht | `https://maurer-events.madebylui.net/widerruf` | `https://maurer-events.com/widerruf` |
| Datenschutz | `https://maurer-events.madebylui.net/datenschutz` | `https://maurer-events.com/datenschutz` |
| Impressum | `https://maurer-events.madebylui.net/impressum` | `https://maurer-events.com/impressum` |

Die Seiten sind derzeit auf `noindex` gesetzt. Das verhindert nur die Aufnahme in
Suchmaschinen, **nicht** den direkten Aufruf über den Link.

Englische Fassung derselben Seiten: `https://…/en/agb` usw. Der Inhalt bleibt
dort deutsch (siehe Frage 28).

### Weitere Unterlagen

- Dieses Dokument
- Auf Nachfrage: Auszug aus dem Buchungsablauf, Muster-Buchungsbestätigung,
  Muster-Ticket als PDF
- Ansprechpartner für Rückfragen zum technischen Ablauf