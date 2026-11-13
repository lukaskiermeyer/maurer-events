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
    /* Fill-Farbe je Klasse (Gluehbirnen sind die hellen Kreise). */
    const fills = {};
    /* Klassen koennen Leerzeilen zwischen { und fill haben. */
    const styleRe = /\.([\w-]+)\s*\{[^}]*?fill:\s*(#[0-9a-fA-F]{6})/g;
    let sm;
    while ((sm = styleRe.exec(svg))) fills[sm[1]] = sm[2].toLowerCase();
    const re = /<circle\b([^>]*?)\/?>/g;
    const out = [];
    let m;
    while ((m = re.exec(svg))) {
        const a = m[1];
        const g = (n) => { const r = a.match(new RegExp(`\\b${n}="([^"]*)"`)); return r ? parseFloat(r[1]) : NaN; };
        const gs = (n) => { const r = a.match(new RegExp(`\\b${n}="([^"]*)"`)); return r ? r[1] : ""; };
        out.push({ cx: g("cx"), cy: g("cy"), r: g("r"), w: w, h: h, ox: minX, oy: minY, fill: fills[gs("class")] || gs("fill") || "" });
    }
    return out;
}

/* Helligkeit (0-255) einer Hex-Farbe. */
const lum = (hex) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(hex || "");
    if (!m) return 0;
    return 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16);
};

/* Lichterbogen des Zelteingangs: Spalten und Bogenspitze um x 840-1090,
   y 700-970 (inkl. unterer Birnen, sonst fehlen die untersten). */
const door = circles("Zelt.svg").filter((c) => c.r >= 3.5 && c.cx > 840 && c.cx < 1090 && c.cy > 700 && c.cy < 970);
/* Fenster-Birnen links/rechts davon (helle Kreise ausserhalb des Bogens). */
const windowLights = circles("Zelt.svg").filter(
    (c) => c.r >= 2.5 && lum(c.fill) >= 180 && (c.cx < 840 || c.cx > 1090)
);
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

/* Fenster-Birnen links/rechts des Eingangs (flackern mit). */
export const tentWindowLights: HeroLight[] = [
${fmt(windowLights)}
];

/* Alle Zelte-Birnen (Bogen + Fenster) - fuer das Funkel-Overlay. */
export const tentLights: HeroLight[] = [
${fmt([...door, ...windowLights])}
];

export const gateGarlandLights: HeroLight[] = [
${fmt(garland)}
];
`;

writeFileSync(join(root, "src/components/heroLightPoints.ts"), ts);
console.log(`heroLightPoints.ts geschrieben: ${door.length} Eingangsbirnen, ${windowLights.length} Fensterbirnen, ${garland.length} Girlandenbirnen`);
