# Festwirt-Bereich und Einlass-Team

Der Team-Login liegt unter `/admin/login`. Festwirt und Helfer melden sich mit
CAPTCHA, E-Mail und einmaligem Mailcode an. Die Freigabe entscheidet über den
Zugriff; die gleiche Login-Seite erteilt keine zusätzlichen Rechte.

## Scanner-Helfer freigeben

1. Als Festwirt die Veranstaltung öffnen und **Einlass-Team** wählen.
2. E-Mail des Helfers und das letzte gültige Datum eintragen, dann
   **Scanner-Zugang freigeben** wählen.
3. Dem Helfer den Link `/admin/login` weitergeben. Er fordert seinen eigenen
   Mailcode an und wird nach Anmeldung direkt zum Scanner geführt.

Es wird beim Anlegen keine separate Einladungs-Mail verschickt. Der Zugang gilt
nur für die ausgewählte Veranstaltung. Dieselbe Person kann bei mehreren Festen
einzeln freigegeben werden. Der globale Scanner akzeptiert dann nur Tickets aus
diesen Festen.

Helfer können Tickets prüfen und einmal entwerten. Nach erfolgreichem Scan sehen
sie Gastname, Personenzahl und Tisch, beim globalen Scanner auch den Festnamen.
Sie können keine Gästelisten, Umsätze, Exporte, Einstellungen, Wartelisten oder
anderen Verwaltungsfunktionen öffnen. **Widerrufen** sperrt die Freigabe auch für
bereits angemeldete Helfer; das Ablaufdatum beendet sie automatisch. Freigaben
sind auf höchstens 90 Tage begrenzt. Für spätere Feste erst näher am Termin
freigeben.

`ADMIN_EMAILS` bleibt die Liste mit vollem Verwaltungszugriff. Scanner-Helfer
werden dort nicht eingetragen. Eine E-Mail aus dieser Liste hat weiterhin volle
Adminrechte und lässt sich deshalb nicht auf eine Scanner-Freigabe beschränken.

## Mobile Bedienung

Die Veranstaltungsansicht startet bei **Gäste**. Auf kleinen Bildschirmen stehen
Buchungen als Karten mit Suche, Status und Tischzuweisung bereit. **Einlass
starten** öffnet direkt den Veranstaltungs-Scanner. Im Überblick öffnet **Tickets
scannen** den globalen Scanner. **Abmelden** beendet die aktuelle Sitzung.

Die Warteliste zeigt auf dem Handy alle Angaben und Aktionen untereinander.
Im Zeltplan öffnet **VIP ändern** den Aufpreisdialog auch ohne Rechtsklick.
Bei der Gästezuweisung zuerst den Gast auswählen und anschließend einen Tisch
antippen; Status und Tisch lassen sich auch direkt in der Gästekarte ändern.

Bildaktionen sind auf Touch-Geräten ständig sichtbar und mindestens 44 Pixel
groß. JPG, PNG und WebP bis 10 MB werden vor dem Hochladen automatisch verkleinert.
HEIC-Dateien vorher als JPG exportieren. Damit funktionieren typische Handyfotos
auch innerhalb der Uploadgrenzen des Vercel-Betriebs.

## Ticketgestaltung

Neue Tickets enthalten das vorhandene Wirt-Männchen als Vektorgrafik, Datum,
Uhrzeit, Ort, Gast, Personenzahl und Tisch sowie einen großen QR-Code. Ohne
Tischzuweisung steht dort **Freie Platzwahl**. Lange Angaben umbrechen; die
Tickethöhe wächst bei Bedarf.

Bereits ausgestellte Versandpayloads bleiben für zuverlässige Wiederholungen
unverändert. Das neue Layout gilt für neu erzeugte Tickets. Eine Designänderung
erfordert weder neue QR-Codes noch erneuten Versand vorhandener Tickets.
