// Erzeugt die Web-Variante der Kunden-Holzoptik aus dem Illustrator-Export.
//
// Der Export (assets/Holzoptik_MaurerEvents.png, 5504x3072, ~27 MB) ist als
// Sektions-Hintergrund unbrauchbar gross. Zusätzlich ist das Rohholz zu
// kontrastreich fuer dunkle Schrift: seine dunkelsten Stellen (Astloecher,
// Fugen) liegen bei L=0.062 und geben mit base-dark nur 2.11:1.
//
// Der warme Wash (#F0C896 @ 55%) hebt die dunkelste Stelle auf L=0.280 an
// (base-dark 6.22:1, /80 4.84:1 -> jeweils WCAG AA) und laesst die Maserung
// erhalten: die Helligkeitsspanne sinkt nur von 0.46 auf 0.29. Ein Cream- oder
// Weiss-Wash wuerde den Honigton entsaettigen und rosstig wirken lassen.
//
// Aufruf: npm run generate:wood-texture
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

// Quelle liegt bewusst ausserhalb von public/: der 27-MB-Export soll nicht
// oeffentlich ausgeliefert und mit deployed werden, nur die WebP-Derivate.
const SRC = path.join(process.cwd(), "assets", "Holzoptik_MaurerEvents.png");
const OUT = path.join(process.cwd(), "public", "Holzoptik_MaurerEvents.webp");
const OUT_MOBILE = path.join(process.cwd(), "public", "Holzoptik_MaurerEvents-mobile.webp");
const WASH = [0xf0, 0xc8, 0x96];
const WASH_ALPHA = 0.55;
const WIDTH = 2000;
// Hochformat-Schnitt fuer Mobile: eine schmale Sektion ist viel hoeher als
// breit, `cover` skaliert dort ueber die Hoehe. Mit dem Querformat-Asset waere
// das ~1.7x Hochskalieren (weiche Maserung); der Portrait-Schnitt liefert
// native Aufloesung bei gleicher Plankenoptik.
const MOBILE_WIDTH = 1000;

if (!fs.existsSync(SRC)) {
  console.error(`Quelle fehlt: ${SRC}`);
  process.exit(1);
}

const washLayer = {
  input: Buffer.from([WASH[0], WASH[1], WASH[2], Math.round(WASH_ALPHA * 255)]),
  raw: { width: 1, height: 1, channels: 4 },
  tile: true,
  blend: "over",
};

const washed = await sharp(SRC)
  .resize({ width: WIDTH })
  .removeAlpha()
  .composite([washLayer])
  .webp({ quality: 80, effort: 6 })
  .toFile(OUT);

const src = await sharp(SRC).metadata();
const sliceWidth = Math.round(src.height * (MOBILE_WIDTH / 1807));
const mobile = await sharp(SRC)
  .extract({
    left: Math.round((src.width - sliceWidth) / 2),
    top: 0,
    width: sliceWidth,
    height: src.height,
  })
  .resize({ width: MOBILE_WIDTH })
  .removeAlpha()
  .composite([washLayer])
  .webp({ quality: 80, effort: 6 })
  .toFile(OUT_MOBILE);

const srcSize = fs.statSync(SRC).size;
for (const [file, info] of [[OUT, washed], [OUT_MOBILE, mobile]]) {
  console.log(`${path.basename(file)}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
}
console.log(`Quelle war ${(srcSize / 1024 / 1024).toFixed(1)} MB -> Faktor ${(srcSize / washed.size).toFixed(0)}x kleiner`);
