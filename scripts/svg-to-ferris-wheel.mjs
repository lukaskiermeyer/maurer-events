/*
 * Erzeugt aus dem Illustrator-Export public/Riesenrad.svg eine animierte Fassung
 * public/Riesenrad-anim.svg: Die Rad-Scheibe dreht um die Nabe, jede Gondel dreht
 * um ihren Aufhängepunkt gegen und bleibt dadurch lotrecht, das Gestell steht still.
 *
 * Voraussetzung ist ein Export mit benannten Gruppen (siehe
 * docs/illustrator-hero-exporte.md): `rad`, optional `nabe`, `gestell` und
 * `gondel-01`, `gondel-02`, ... Fehlen diese Gruppen, bleibt der Legacy-Pfad
 * (geclippte Scheibe) aktiv und das Script bricht mit einem Hinweis ab.
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Ohne Argumente: Produktivpfad. Mit Argumenten (Test): eigene Quelle/Ziel, Variante bleibt unangetastet. */
const [argSrc, argOut] = process.argv.slice(2);
const SRC = argSrc ? resolve(argSrc) : join(root, "public/Riesenrad.svg");
const OUT = argOut ? resolve(argOut) : join(root, "public/Riesenrad-anim.svg");
const VARIANT = join(root, "src/components/ferrisWheelVariant.ts");

const writeVariant = (v) => {
    if (argSrc) return;
    writeFileSync(VARIANT, `/* Von scripts/svg-to-ferris-wheel.mjs geschrieben - nicht manuell editieren. */\nexport const ferrisWheelVariant: "anim" | "legacy" = "${v}";\n`);
};

/* ------------------------------------------------------------------ Mathe */
const ident = () => [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function parseTransform(str) {
    let m = ident();
    if (!str) return m;
    const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g;
    let t;
    while ((t = re.exec(str))) {
        const n = t[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
        let op = ident();
        if (t[1] === "matrix") op = n;
        else if (t[1] === "translate") op = [1, 0, 0, 1, n[0] || 0, n[1] || 0];
        else if (t[1] === "scale") op = [n[0], 0, 0, n[1] ?? n[0], 0, 0];
        else if (t[1] === "rotate") {
            const a = (n[0] * Math.PI) / 180;
            const c = Math.cos(a), s = Math.sin(a);
            op = [c, s, -s, c, 0, 0];
            if (n.length >= 3) op = mul([1, 0, 0, 1, n[1], n[2]], mul(op, [1, 0, 0, 1, -n[1], -n[2]]));
        }
        m = mul(m, op);
    }
    return m;
}

function pathPoints(d) {
    const toks = d.match(/[aAcChHlLmMqQtTvVzZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
    let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0;
    const pts = [];
    const num = () => parseFloat(toks[i++]);
    const add = (px, py) => pts.push([px, py]);
    while (i < toks.length) {
        const t = toks[i];
        if (/[aAcChHlLmMqQtTvVzZ]/.test(t)) { cmd = t; i++; }
        const rel = cmd === cmd.toLowerCase();
        const C = cmd.toUpperCase();
        const bx = rel ? x : 0, by = rel ? y : 0;
        if (C === "M" || C === "L" || C === "T") { x = bx + num(); y = by + num(); add(x, y); }
        else if (C === "H") { x = bx + num(); add(x, y); }
        else if (C === "V") { y = by + num(); add(x, y); }
        else if (C === "C") { const p = []; for (let k = 0; k < 6; k++) p.push(num()); add(bx + p[0], by + p[1]); add(bx + p[2], by + p[3]); x = bx + p[4]; y = by + p[5]; add(x, y); }
        else if (C === "S" || C === "Q") { const p = []; for (let k = 0; k < 4; k++) p.push(num()); add(bx + p[0], by + p[1]); x = bx + p[2]; y = by + p[3]; add(x, y); }
        else if (C === "A") { const p = []; for (let k = 0; k < 7; k++) p.push(num()); x = bx + p[5]; y = by + p[6]; add(x, y); }
        else if (C === "Z") { x = sx; y = sy; }
        else { i++; continue; }
        if (C === "M") { sx = x; sy = y; }
    }
    return pts;
}

/** BBox eines Gruppen-Markups inkl. verschachtelter Gruppen-Transforms. */
function groupBBox(markup) {
    const stack = [ident()];
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    const re = /<(g|path|rect|circle|ellipse|polygon)\b([^>]*?)(\/?)>|<\/g>/g;
    let m;
    const grow = (px, py) => {
        bb[0] = Math.min(bb[0], px); bb[1] = Math.min(bb[1], py);
        bb[2] = Math.max(bb[2], px); bb[3] = Math.max(bb[3], py);
    };
    while ((m = re.exec(markup))) {
        if (m[0] === "</g>") { if (stack.length > 1) stack.pop(); continue; }
        const [, tag, attrs] = m;
        const matrix = mul(stack[stack.length - 1], parseTransform((attrs.match(/transform="([^"]*)"/) || [])[1]));
        if (tag === "g") { stack.push(matrix); continue; }
        let pts = null;
        if (tag === "path") pts = pathPoints((attrs.match(/\bd="([^"]*)"/) || [])[1] || "");
        else if (tag === "rect") {
            const x = +(attrs.match(/\bx="([^"]*)"/) || [])[1] || 0, y = +(attrs.match(/\by="([^"]*)"/) || [])[1] || 0;
            const w = +(attrs.match(/\bwidth="([^"]*)"/) || [])[1] || 0, h = +(attrs.match(/\bheight="([^"]*)"/) || [])[1] || 0;
            pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
        } else if (tag === "circle" || tag === "ellipse") {
            const cx = +(attrs.match(/\bcx="([^"]*)"/) || [])[1] || 0, cy = +(attrs.match(/\bcy="([^"]*)"/) || [])[1] || 0;
            const rx = +(attrs.match(/\br="([^"]*)"/) || [])[1] || +(attrs.match(/\brx="([^"]*)"/) || [])[1] || 0;
            const ry = +(attrs.match(/\br="([^"]*)"/) || [])[1] || +(attrs.match(/\bry="([^"]*)"/) || [])[1] || 0;
            pts = [[cx - rx, cy - ry], [cx + rx, cy - ry], [cx - rx, cy + ry], [cx + rx, cy + ry]];
        } else if (tag === "polygon") {
            const n = ((attrs.match(/points="([^"]*)"/) || [])[1] || "").trim().split(/[\s,]+/).map(Number);
            pts = []; for (let k = 0; k + 1 < n.length; k += 2) pts.push([n[k], n[k + 1]]);
        }
        for (const [px, py] of pts || []) { const [qx, qy] = apply(matrix, px, py); grow(qx, qy); }
    }
    return bb;
}

/** Sucht <g id="..."> in beliebiger Tiefe und liefert das Markup inkl. End-Tag. */
function extractGroup(svg, id) {
    const open = new RegExp(`<g\\b[^>]*\\bid="${id}"[^>]*>`, "i").exec(svg);
    if (!open) return null;
    let depth = 0, i = open.index;
    const re = /<g\b[^>]*>|<\/g>/g;
    re.lastIndex = i;
    let m;
    while ((m = re.exec(svg))) {
        if (m[0].startsWith("</g>")) { depth--; if (depth === 0) return svg.slice(i, re.lastIndex); }
        else depth++;
    }
    return null;
}

const groupIds = (svg) => [...svg.matchAll(/<g\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);

/* ------------------------------------------------------------------- Main */
const svg = readFileSync(SRC, "utf8");
writeVariant("legacy");

const ids = groupIds(svg);
const gondelIds = ids.filter((id) => /^(gondel|kabine|cabin)[-_]?\d*$/i.test(id)).sort();
const radMarkup = extractGroup(svg, "rad");
const gestellMarkup = extractGroup(svg, "gestell");

if (!radMarkup || gondelIds.length < 2) {
    if (existsSync(OUT)) {
        rmSync(OUT);
        console.error("public/Riesenrad-anim.svg entfernt (passt nicht zum aktuellen Export).");
    }
    console.error(
        [
            "Riesenrad.svg hat noch keine benannten Gruppen.",
            `  gefunden: ${ids.slice(0, 12).join(", ") || "(keine)"}`,
            "  erwartet: rad, gestell, gondel-01 .. gondel-NN (optional nabe)",
            "  Anleitung: docs/illustrator-hero-exporte.md",
            "Legacy-Rotation bleibt aktiv (src/components/ferrisWheelVariant.ts = legacy).",
        ].join("\n"),
    );
    process.exit(1);
}

const nabeMarkup = extractGroup(svg, "nabe");
const hubSource = nabeMarkup ? groupBBox(nabeMarkup) : groupBBox(radMarkup);
const hub = [(hubSource[0] + hubSource[2]) / 2, (hubSource[1] + hubSource[3]) / 2];

const gondeln = gondelIds.map((id) => {
    const markup = extractGroup(svg, id);
    const bb = groupBBox(markup);
    return { id, markup, raw: [(bb[0] + bb[2]) / 2, bb[1]] };
});
const dists = gondeln.map((g) => Math.hypot(g.raw[0] - hub[0], g.raw[1] - hub[1])).sort((a, b) => a - b);
const radius = dists[Math.floor(dists.length / 2)];
for (const g of gondeln) {
    const dx = g.raw[0] - hub[0], dy = g.raw[1] - hub[1];
    const len = Math.hypot(dx, dy) || 1;
    g.pivot = [hub[0] + (dx / len) * radius, hub[1] + (dy / len) * radius];
}

const STYLE = [
    "<style>",
    ".fw-spin{animation:fw-spin 240s linear infinite}",
    ".fw-counter{animation:fw-counter 240s linear infinite}",
    "@keyframes fw-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
    "@keyframes fw-counter{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}",
    "@media (prefers-reduced-motion:reduce){.fw-spin,.fw-counter{animation:none}}",
    "</style>",
].join("");

let out = svg;
const spinOpen = `<g class="fw-spin" style="transform-origin:${hub[0].toFixed(2)}px ${hub[1].toFixed(2)}px">`;
for (const g of gondeln) {
    /* Aussen dreht die Gondel mit dem Rad um die Nabe, innen dreht sie um ihren
       Aufhaengepunkt gegen - dadurch bleibt die Kabine lotrecht haengen. */
    const wrapped =
        `${spinOpen}<g class="fw-counter" style="transform-origin:${g.pivot[0].toFixed(2)}px ${g.pivot[1].toFixed(2)}px">${g.markup}</g></g>`;
    out = out.replace(g.markup, wrapped);
}
out = out.replace(radMarkup, `${spinOpen}${radMarkup}</g>`);
if (nabeMarkup) out = out.replace(nabeMarkup, `${spinOpen}${nabeMarkup}</g>`);
const svgOpenEnd = out.indexOf(">", out.indexOf("<svg")) + 1;
out = `${out.slice(0, svgOpenEnd)}${STYLE}${out.slice(svgOpenEnd)}`;

writeFileSync(OUT, out);
writeVariant("anim");

console.log(`public/Riesenrad-anim.svg geschrieben (${(out.length / 1024).toFixed(1)} KB)`);
console.log(`  Nabe:        ${hub.map((n) => n.toFixed(1)).join(", ")}`);
console.log(`  Gondelradius: ${radius.toFixed(1)}  Gondeln: ${gondeln.length}`);
console.log(`  Gestell statisch: ${gestellMarkup ? "ja" : "NEIN - Gruppe 'gestell' fehlt, Beine wuerden fehlen!"}`);
for (const g of gondeln) {
    const deg = (Math.atan2(g.pivot[1] - hub[1], g.pivot[0] - hub[0]) * 180) / Math.PI;
    console.log(`  ${g.id.padEnd(10)} Aufhaenger ${g.pivot.map((n) => n.toFixed(1)).join(", ")}  Winkel ${deg.toFixed(1)}deg`);
}
