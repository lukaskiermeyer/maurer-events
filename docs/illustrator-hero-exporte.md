# Hero-SVGs aus Illustrator exportieren (Boden & Eingang)

Stand: 2026-11-18. Die Hero-Szene baut sich aus `public/Himmel.svg`,
`Zelt.svg`, `PubSchild.svg` und `Eingang.svg` auf. `Riesenrad.svg` wurde am
2026-11-06 komplett aus dem Hero entfernt (Animation war nicht sauber
darstellbar), `Boden.svg` wird nicht mehr eingebunden – der Boden ist die
CSS-Fläche `.hero-ground` (s. unten).

Aktuell stehen **keine Illustrator-Exporte mehr aus**. Dieses Dokument
bleibt als Anleitung für spätere Neuzeichnungen bestehen (vor allem der
PubSchild-Abschnitt unten, weil dort kalibrierte Werte neu gemessen werden
müssen).

---

## 1. Riesenrad: entfernt (2026-11-06)

Das Riesenrad ist komplett aus dem Hero entfernt (`HeroScene.tsx`,
`.hero-wheel`-CSS, `HeroFerrisWheel.tsx`, `ferrisWheelVariant.ts`,
`public/Riesenrad*.svg` gelöscht). Die Scripts
`svg-to-ferris-wheel.mjs` / `onelayer-ferris-wheel.mjs` samt
package.json-Einträgen (`generate:ferris-wheel`, `regroup:ferris-wheel`)
liegen noch im Repo, werden aber nicht mehr benötigt – Kandidaten für eine
Aufräumaktion (siehe `docs/TODO.md`).

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
