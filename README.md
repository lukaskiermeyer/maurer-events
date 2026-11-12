# Maurer Events

Next.js 16 / React 19 mit deutsch-englischer Eventseite, Tischreservierung,
Stripe-Zahlung, PDF-Tickets und einem Adminbereich mit Einlass-Team.

## Lokal starten

Node.js 22 und PostgreSQL verwenden. `.env.example` nach `.env.local` kopieren
und eigene Entwicklungs-/Testdienste eintragen. Keine Liveschlüssel für Tests.

```sh
npm ci
npm run dev
```

## Prüfen

```sh
npm run lint
npm run build
npm run test:security
npm run test:acceptance
```

Sicherheitstests und Abnahme brauchen den isolierten PostgreSQL-Testserver auf
Port 55439. `test:acceptance` startet den Produktionsbuild auf einem freien lokalen Port,
erzeugt eine eigene Datenbank und entfernt diese wieder. Browserabhängigkeiten
müssen installiert sein. Einrichtung: [docs/testing.md](docs/testing.md).

## Hosting und Übergabe

- [Aktuelle Projektabnahme](docs/project-acceptance.md)
- [Vercel und Coolify auf Netcup](docs/coolify.md): Konfiguration, Umzug,
  Migrationen, geplanter Cleanup, Backups und Grenzen des kostenlosen Vercel-Tarifs.
- [Provider und Betrieb](docs/deployment.md): Variablen, Webhook-Ereignisse, CAPTCHA.
- [Admin-Anleitung](docs/admin-guide.md)
- [Offene Punkte vor echtem Verkauf](docs/KNOWN_ISSUES.md)

Das Docker-Image nutzt den vorhandenen kleingeschriebenen `dockerfile` und läuft
als Standalone-Server auf Port 3000. Vercel baut dasselbe Repository direkt über
`vercel.json`. Geheimnisse gehören in die jeweilige Hosting-Umgebung.

## Hero-Hintergrund (generiert)

`src/components/HeroBackground.tsx` wird von `scripts/svg-to-hero-background.mjs`
aus `public/Hintergrund.svg` erzeugt und in `HeroSection` als erstes Kind der
`<section>` eingebunden. Die Quelldatei bleibt unverändert als Fallback/Poster liegen.

```sh
npm run generate:hero-background
```

Der Codemod entfernt XML-Prolog, DOCTYPE, Kommentare und `<metadata>`/XMP, wandelt
Attribute nach JSX (`stop-color` → `stopColor`, …) und gruppiert die Formelemente
nach Fill-Farbe in Layer. Weil fast jedes Element einen eigenen Farbton trägt, wird
im HSL-Raum klassifiziert; die genannten Referenz-Hexwerte dienen als Anker der
Farbfamilien. Nur `layer-flags` matcht exakt, da Flaggen- und Zelt-Blau (#2779af vs.
#2775ae) farblich nicht trennbar sind.

| Layer | Inhalt | Animation |
| --- | --- | --- |
| `layer-scene` | neutrale Grau-/Schwarztöne, Verlaufsflächen | statisch |
| `layer-wood` | Brauntöne (Holz, Boden, Fachwerk) | statisch |
| `layer-trees` | Grüntöne (Bäume, Buschwerk) | statisch |
| `layer-tents` | Teal-/Blautöne (Zelte, Aufbauten) | statisch |
| `layer-fog` | graublaue Himmels- und Nebeltöne | Drift x [0,18,0] / [0,-14,0], 22/26 s gegengleich |
| `layer-flags` | Flaggen-Blau (#2779af u. a.) | Wehen skewY [0,3,0] / rotate [0,1.5,0], 4-6 s |
| `layer-lights` | Kreise mit r < 4 und warmem Fill | Twinkle opacity/scale, 2-3 s, Stagger 0.13 s |

Dazu einmaliger Entrance (opacity 0→1, scale 1.04→1, 0.9 s easeOut) auf dem gesamten
SVG. Bei `prefers-reduced-motion` rendert die Komponente vollständig statisch.
Animiert werden ausschließlich `transform` und `opacity`; animierte SVG-Knoten setzen
`transform-box: fill-box`, damit Skalierung und Wehen um die eigene Form erfolgen.
