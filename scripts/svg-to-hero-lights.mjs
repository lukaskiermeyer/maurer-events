/*
 * Liest die Gluehbirnen-Kreise aus public/Zelt.svg (Lichterbogen am Eingang) und
 * public/Eingang.svg (Girlanden-Birnen an Tafel und Pfosten) und schreibt sie als
 * Prozentkoordinaten nach src/components/heroLightPoints.ts. Das Overlay in
 * HeroLights.tsx legt dort ein sanftes Funkeln ueber die gezeichneten Birnen.
 *
 * Aufruf: npm run generate:hero-lights (nach jedem Neu-Export der beiden SVGs).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function circles(file) {
    const svg = readFileSync(join(root, "public", file), "utf8");
    const [minX, minY, w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const re = /<circle\b([^>]*?)\/?>/g;
    const out = [];
    let m;
    while ((m = re.exec(svg))) {
        const a = m[1];
        const g = (n) => { const r = a.match(new RegExp(`\\b${n}="([^"]*)"`)); return r ? parseFloat(r[1]) : NaN; };
        out.push({ cx: g("cx"), cy: g("cy"), r: g("r"), w: w, h: h, ox: minX, oy: minY });
    }
    return out;
}

/* Lichterbogen des Zelteingangs: Spalten und Bogenspitze um x 840-1090, y 690-950. */
const door = circles("Zelt.svg").filter((c) => c.r >= 3.5 && c.cx > 840 && c.cx < 1090 && c.cy > 690 && c.cy < 950);
/* Girlanden-Birnen an Tafel und Pfosten des Eingangstors, oberhalb y=400. */
const garland = circles("Eingang.svg").filter((c) => c.r >= 6 && c.cy < 400);

const fmt = (list) =>
    list
        .map((c) => `    { x: ${(((c.cx - c.ox) / c.w) * 100).toFixed(3)}, y: ${(((c.cy - c.oy) / c.h) * 100).toFixed(3)}, r: ${(((c.r * 2) / c.w) * 100).toFixed(3)} },`)
        .join("\n");

const ts = `/* Von scripts/svg-to-hero-lights.mjs geschrieben - nicht manuell editieren.
 * Prozentkoordinaten relativ zur jeweiligen Stage-Box (Artboard des SVGs). */
export type HeroLight = { x: number; y: number; r: number };

export const tentDoorLights: HeroLight[] = [
${fmt(door)}
];

export const gateGarlandLights: HeroLight[] = [
${fmt(garland)}
];
`;

writeFileSync(join(root, "src/components/heroLightPoints.ts"), ts);
console.log(`heroLightPoints.ts geschrieben: ${door.length} Eingangsbirnen, ${garland.length} Girlandenbirnen`);
