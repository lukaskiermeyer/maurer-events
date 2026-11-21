# KUNDE-ANLEITUNG — Admin-Zugang einrichten (servus@maurer-events.com)

## So meldest du dich an
Dein Admin-Zugang braucht zwei Dinge: **dein Passwort** und einen **6-stelligen Code**
aus der Authenticator-App auf deinem Handy (zweite Stufe, „2FA").

## Authenticator-App installieren (einmalig)
1. Installiere **Google Authenticator** (Android: Play Store, iPhone: App Store).
2. Du bekommst einen Einrichtungs-Link per E-Mail und eine PIN telefonisch.
3. Link öffnen → PIN eingeben → Passwort festlegen (mind. 12 Zeichen).
4. Es erscheint ein **QR-Code**: In der App auf „+“ tippen → „QR-Code scannen“ → abscannen.
   (Geht das nicht, tippe den angezeigten Schlüssel unter dem QR-Code manuell ein.)
5. Gib den 6-stelligen Code aus der App zur Bestätigung ein.
6. **Wichtig:** Dir werden 10 Recovery-Codes angezeigt. Abschreiben oder ausdrucken und
   sicher verwahren – sie werden nur einmal angezeigt und ersetzen im Notfall den App-Code.

## Tägliches Anmelden
1. `/admin/login` öffnen.
2. E-Mail + Passwort eingeben.
3. 6-stelligen Code aus der App eingeben (alle 30 Sekunden neu) → „Anmelden“.
4. Optional: „Dieses Gerät 30 Tage merken“ – überspringt auf diesem Gerät nur den Code,
   nie das Passwort.

## Passwort vergessen
Sag dem Entwickler Bescheid: Du bekommst eine Reset-Mail. Nach dem neuen Passwort wird
beim Login **weiterhin dein App-Code verlangt** – der Reset schaltet die zweite Stufe
also nicht aus. Deine Authenticator-Einrichtung bleibt dabei unverändert erhalten.

## Neues Handy / Handy verloren
- **Recovery-Codes vorhanden:** Beim Login „Recovery-Code verwenden“ wählen, einen Code
  eingeben (wird verbraucht) – dann Zugang sichern und dem Entwickler Bescheid geben.
- **Keine Codes mehr:** Der Entwickler setzt deine 2FA zurück (TOTP-Reset). Du erhältst
  einen Link zum Neueinrichten und scannst den QR-Code mit dem neuen Handy neu.

## Sicherheit
- Gib Passwort, PIN und Recovery-Codes niemals weiter – auch nicht „im Auftrag des Supports“.
- Der Zugang wird automatisch gesperrt, wenn jemand mehrfach falsch rät. Einfach 15 Minuten warten.
