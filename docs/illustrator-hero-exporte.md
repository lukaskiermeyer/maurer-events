# Hero-SVGs aus Illustrator exportieren (Boden & Eingang)

Stand: 2026-11-06. Die Hero-Szene baut sich aus `public/Himmel.svg`,
`Zelt.svg`, `PubSchild.svg` und `Eingang.svg` (Riesenrad und Boden.svg
werden nicht mehr verwendet, s. unten).
Dieses Dokument beschreibt die beiden Exporte, die noch ausstehen, und worauf
Illustrator bzw. der Export-Dialog achten muss, damit die Website sie direkt
versteht.

---

## 1. Riesenrad: entfernt (2026-11-06)

Das Riesenrad ist komplett aus dem Hero entfernt (`HeroScene.tsx`,
`.hero-wheel`-CSS, `HeroFerrisWheel.tsx`, `ferrisWheelVariant.ts`,
`public/Riesenrad*.svg` gelöscht) – die Drehanimation war trotz
Umgruppierungs-Fix (s. früherer Stand unten) im Hero nicht sauber
darstellbar. Die Scripts `svg-to-ferris-wheel.mjs` /
`onelayer-ferris-wheel.mjs` liegen noch im Repo, werden aber nicht
mehr benötigt.

---
## 1b. Riesenrad (historisch): Export mit benannten Gruppen

### Warum

`Riesenrad.svg` ist aktuell ein flacher Silhouetten-Export (Rad, Gondeln und
Gestell in einer Ebene). Die Website kann deshalb nur das ganze Bild drehen:
Die Standbeine rotieren mit und die Kabinen kippen schräg, statt lotrecht zu
hängen. Zielzustand:

- die **Rad-Scheibe** (Felge + Speichen) dreht um die Nabe,
- jede **Gondel** läuft auf der Kreisbahn mit, bleibt aber **lotrecht**
  (Gegendrehung um ihren Aufhängepunkt),
- das **Gestell** steht still.

Die Umsetzung macht `npm run generate:ferris-wheel`
(`scripts/svg-to-ferris-wheel.mjs`): Das Script liest den Export, berechnet
Nabe, Felgenradius und Aufhängepunkte und schreibt `public/Riesenrad-anim.svg`
mit CSS-Animationen im SVG (funktioniert auch inside `<img>`, inklusive
`prefers-reduced-motion`). Danach nutzt `HeroFerrisWheel` automatisch die
animierte Fassung (`src/components/ferrisWheelVariant.ts` steht auf `"anim"`).

### Ebenen-/Gruppenstruktur in der AI-Datei

Benannte Gruppen anlegen (exakt diese Namen, kleingeschrieben):

| Gruppe      | Inhalt                                                              |
| ----------- | ------------------------------------------------------------------- |
| `gestell`   | Standbeine, Füße, Nabenbock – alles, was **stillstehen** muss        |
| `rad`       | Felgenringe, Speichen, innere Ringe – alles, was **rotiert**         |
| `nabe`      | optional: Nabendeckel (rotiert mit, ist aber unsichtbar egal)        |
| `gondel-01` … `gondel-NN` | je **eine** Kabine inkl. Bügel/Aufhängung, fortlaufend nummeriert |

### Regeln beim Zeichnen/Ordnen

1. **Artboard unverändert:** 259.4 × 321.8 pt. Die CSS-Box `.hero-wheel`
   (`src/app/globals.css`) ist auf dieses Verhältnis und diese Position
   kalibriert; ein anderes Artboard würde das Rad im Layout verschieben.
2. **Nabe auf der vertikalen Mittellinie:** x = 129.7. Das Script liest die
   Nabe aus der Gruppe `nabe` (Fallback: Zentrum von `rad`) – liegt sie nicht
   mittig, steht das Rad schief im Hero.
3. **Beinspitzen = Nabenzentrum:** Die Standbeine müssen exakt im Nabenpunkt
   zusammenlaufen, sonst "wandert" ihr Ansatz beim Übergang zur Scheibe.
4. **Gondeln lotrecht zeichnen** (gerade herunterhängend, wie im Stillstand).
   Der **oberste Punkt jeder Gondelgruppe** ist der Aufhängepunkt am Felgenring
   – das Script nimmt ihn als Drehpunkt der Gegendrehung und snappt ihn auf den
   gemeinsamen Felgenradius.
5. Gondeln müssen **nicht** perfekt gleichmäßig verteilt sein; Winkel und
   Radius liest das Script aus der Datei.
6. **Keine Schnittmasken/Clips** über Gruppengrenzen hinweg. Transformationen
   *innerhalb* der Gruppen sind erlaubt (das Script rechnet sie ein); die
   benannten Gruppen selbst bitte nicht gegeneinander transformieren.

### Export-Dialog

Datei → Exportieren → Exportieren als… → **SVG**, dann:

- **Objekt-IDs: „Erhalten“** – entscheidend, sonst gehen die Gruppennamen
  verloren und das Script findet nichts.
- Styling: Präsentationsattribute oder internes CSS – beides okay.
- **Responsiv: aus** (die viewBox muss erhalten bleiben).
- Dezimalstellen: 2–3.

Als `public/Riesenrad.svg` speichern (überschreiben), dann:

```bash
npm run generate:ferris-wheel
```

Das Script gibt Nabe, Felgenradius, Gondelzahl und alle Aufhängepunkte mit
Winkel aus. Sanity-Check: Radius bei allen Gondeln identisch (±1 Einheit),
Winkel ungefähr gleichmäßig verteilt. Fehlen die Gruppen, bricht das Script mit
Fehler ab, entfernt eine alte `Riesenrad-anim.svg` und die Site bleibt auf der
bisherigen (fehlerhaften) Legacy-Rotation.

### Fall-back: flacher Export ohne Gruppen

Stand 2026-11-05 liegt im Repo bereits eine automatisch gruppierte Fassung
(`rad`, `gestell`, `nabe`, `gondel-01..24`), erzeugt aus dem alten
Silhouetten-Export via `npm run regroup:ferris-wheel`
(`scripts/onelayer-ferris-wheel.mjs`, klassifiziert rein geometrisch; Backup
des Originals liegt in `.qwen/tmp/Riesenrad-flat-backup.svg`). Kommt aus
Illustrator wieder eine flache Datei ohne benannte Gruppen: erst
`npm run regroup:ferris-wheel`, dann `npm run generate:ferris-wheel` ausführen
und das Ergebnis per Screenshot gegenprüfen. Sauberer bleibt der manuelle
Export mit benannten Gruppen wie oben beschrieben.

**Fix 2026-11-06 (Kabinen kippten, Füße drehten mit):** Die geometrische
Klassifikation war zu eng – Fußplatten (y > 300) landeten im `rad` und
kreisten um die Nabe, Kabinendachteile bei r = 89–95 fielen durchs
Gondel-Raster und kippten mit dem Rad, und Monsterpfade mit mehreren
Teilpfaden wurden als Ganzes einsortiert. Jetzt splittet das Script
Teilpfade einzeln, sortiert Füße (y > 300) und längliche Teile entlang
der Beinlinien (Nabe → Füße, > 25 Einheiten, < 18 Abstand) ins `gestell`
und fasst Gondeln weiter (r = 85–165, max. 60). Ergebnis: 23 Gondeln,
`gestell` 30 Teile, alle Gondeln per `getScreenCTM` bei 0° (lotrecht)
verifiziert, Füße/Beine stehen still.

---

## 2. Boden: CSS-Planken statt Boden.svg (Stand 2026-11-06)

### Aktueller Stand: `Boden.svg` wird nicht mehr verwendet

Die neu gezeichnete `public/Boden.svg` (1920 × 1080, vertikale Planken
ab y = 540, obere Hälfte transparent) ist aus `HeroScene.tsx` entfernt –
ihre senkrechten Bretter passten nicht zur Zeltperspektive. Der Boden
ist jetzt die CSS-Fläche `.hero-ground` in `src/app/globals.css`:

- **Horizontale Bretter:** Web nur **3 Reihen** über 15 vh
  (`--hero-floor-h: 15vh`, `--hero-row-h: /3`), damit links/rechts
  vom Zelt kein hohes Plankenband sichtbar ist; Portrait 6 Reihen
  (`(100vh - --hero-ground-top) / 6`). Fugen per
  `repeating-linear-gradient(180deg, …)` plus Drei-Reihen-Farbwechsel
  über dem Holzverlauf. Die Bretter laufen **parallel zur
  Dachtraufe/Horizontlinie und senkrecht zu den Zeltwänden** – so
  passt die Fläche zur Zeltperspektive.
- **Mobile-Extras (Mockup-Abgleich):** CTAs auch auf Mobile
  nebeneinander (`HeroSection.tsx`, kleineres Padding/Text), und
  Nebelwolken unten an den Ecken als eigene
  `radial-gradient`-Schicht in `.hero-ground` (die Zelt-Nebel fallen
  auf Mobile mit 220vw aus dem Bild).
- **Position:** Landscape ab `100% - 15vh` (Horizont 85 vh), Portrait ab
  der Zelttür-Unterkante (`--hero-tent-top + 0.474 * --hero-stage-w`).
- **Z-Index:** `Himmel > Boden (.hero-ground) > Zelt > Schild >
  Eingang` (`HeroScene.tsx`).
- **Eingang-Position (2026-11-06, iPhone-Feinschliff):** Der Eingang
  reicht von fast ganz unten bis ins obere Drittel. Desktop unten
  verankert (`--hero-gate-top: calc(100vh - 0.55807 * --hero-gate-w)`),
  damit die Pfosten auf dem Boden stehen; Portrait Top `-4vh`, Höhe
  `105vh`, Breite `210vw` (größer als die sichtbare Breite, Box in die
  Höhe gedehnt per `object-fill`) – die Tafel-Unterkante liegt exakt
  an der Grenze zum oberen Drittel (`-4vh + 0.355 * 105vh = 33,3vh`),
  „Servus & Grias Di“ bleibt lesbar (Schriftzug ca. 95vw breit).
  Das (kleinere, `56vw`) Schild hängt per `--hero-sign-top` an der
  Tafel-Unterkante mit, sodass der Zelteingang darunter sichtbar
  bleibt. Nebelwolken im unteren Fünftel (`20vh`-Ellipsen über die
  ganze Breite) in `.hero-ground`, Buttons auf Mobile größer
  (`text-base` ab 420px, sonst `text-sm`, nebeneinander).
- `public/Boden.svg` liegt noch im Repo, wird aber nicht mehr
  eingebunden (kann gelöscht werden, wenn sie nicht zurückkommen soll).

---

## 3. PubSchild: Hinweis für spätere Änderungen

Die Hero-CSS schneidet aus `PubSchild.svg` Balken und Ketten weg und zentriert
die Tafel (`--hero-sign-*`, `.hero-sign-frame` in `src/app/globals.css`). Die
Prozentwerte sind auf das aktuelle Artboard **1024.56 × 762.58** und die
Position der Tafel darin kalibriert (Tafel-Bbox x 158.2–866.9, y 111–739.3;
Balkenunterkante y ≈ 67 = Aufhängepunkt des Pendelns). Wird das Schild neu
gezeichnet oder anders beschnitten, müssen diese Werte nachgezogen werden –
am einfachsten kurz Bescheid sagen, dann messe ich die neue Bbox aus.
