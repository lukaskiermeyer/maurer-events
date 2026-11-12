/*
 * Einmaliges Umgruppieren des flachen Riesenrad-Exports in benannte Gruppen
 * (gestell / rad / nabe / gondel-NN), damit scripts/svg-to-ferris-wheel.mjs eine
 * physikalisch sinnvolle Animation bauen kann: Beine statisch, Rad dreht um die
 * Nabe, Gondeln bleiben lotrecht. Das Original liegt als Backup in .qwen/tmp.
 *
 * Klassifikation rein geometrisch (Nabe bei ca. 131.5/121.1, Felgenradius ~116):
 *  - nabe:    Kreise um den Nabenpunkt
 *  - gestell: Beine/Fuesse/Streben (sehr hohe oder sehr schmale Teile weit unten)
 *  - gondeln: kleine Elemente im Radiusband 95-150, geclustert nach Winkel
 *  - rad:     Rest (Felge, Speichen, Ringe)
 * Pfade mit mehreren Teilpfaden werden roh an den M-Befehlen gesplittet und
 * je Teilpfad zugeordnet.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public/Riesenrad.svg");
const BACKUP = join(root, ".qwen/tmp/Riesenrad-flat-backup.svg");

const svg = readFileSync(SRC, "utf8");
const HUB = [131.5, 121.1];

function pathBBox(d) {
    const toks = d.match(/[aAcChHlLmMqQtTvVzZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
    let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0;
    const bb = [Infinity, Infinity, -Infinity, -Infinity];
    const add = (px, py) => { bb[0] = Math.min(bb[0], px); bb[1] = Math.min(bb[1], py); bb[2] = Math.max(bb[2], px); bb[3] = Math.max(bb[3], py); };
    const num = () => parseFloat(toks[i++]);
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
    return bb;
}

/** Roh-Teilpfade: an den M-Befehlen schneiden, Strings bleiben unveraendert. */
function rawSubpaths(d) {
    const starts = [];
    const re = /M/g;
    let m;
    while ((m = re.exec(d))) starts.push(m.index);
    if (!starts.length) return [{ d, bb: pathBBox(d) }];
    return starts.map((s, k) => {
        const slice = d.slice(s, starts[k + 1] ?? d.length);
        return { d: slice, bb: pathBBox(slice) };
    });
}

function transformed(bb, tr) {
    if (!tr) return bb;
    const t = tr.match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/);
    const r = tr.match(/rotate\(([-\d.]+)\)/);
    let pts = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]];
    if (r) {
        const a = (+r[1] * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
        pts = pts.map(([x, y]) => [c * x - s * y, s * x + c * y]);
    }
    if (t) pts = pts.map(([x, y]) => [x + +t[1], y + +t[2]]);
    return pts.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
}

const elRe = /<(path|rect|circle|polygon)\b([^>]*?)\/?>/g;
const pieces = []; // { markup, bb }
let m;
while ((m = elRe.exec(svg))) {
    const tag = m[1], attrs = m[2].trim();
    const get = (n) => { const r = m[2].match(new RegExp(`\\b${n}="([^"]*)"`)); return r ? r[1] : null; };
    if (tag === "circle") {
        const cx = +get("cx"), cy = +get("cy"), r = +get("r");
        pieces.push({ markup: `<circle ${attrs}/>`, bb: [cx - r, cy - r, cx + r, cy + r] });
    } else if (tag === "rect") {
        const x = +get("x") || 0, y = +get("y") || 0, w = +get("width") || 0, h = +get("height") || 0;
        pieces.push({ markup: `<rect ${attrs}/>`, bb: transformed([x, y, x + w, y + h], get("transform")) });
    } else if (tag === "polygon") {
        const n = (get("points") || "").trim().split(/[\s,]+/).map(Number);
        const bb = [Infinity, Infinity, -Infinity, -Infinity];
        for (let k = 0; k + 1 < n.length; k += 2) {
            bb[0] = Math.min(bb[0], n[k]); bb[1] = Math.min(bb[1], n[k + 1]);
            bb[2] = Math.max(bb[2], n[k]); bb[3] = Math.max(bb[3], n[k + 1]);
        }
        pieces.push({ markup: `<polygon ${attrs}/>`, bb });
    } else {
        const d = get("d") || "";
        const subs = rawSubpaths(d);
        /* Selbstausloeschende Silhouetten-Monsterpfade (Dutzende Teilpfade)
           komplett verwerfen - die Zeichnung steckt in den Einzelpfaden. */
        if (subs.length > 40) continue;
        if (subs.length > 1) {
            /* Teilpfade einzeln klassifizieren: Monsterpfade enthalten sonst
               Bein-, Speichen- und Gondelteile in einem Stück - das ganze
               Stück wuerde mitdrehen (Beine) bzw. kippen (Gondeln). Jeder
               Teilpfad startet mit absolutem M und ist eigenstaendig gueltig. */
            const attrsNoD = attrs.replace(/\bd="[^"]*"/, "").trim();
            for (const s of subs) {
                if (!isFinite(s.bb[0])) continue;
                pieces.push({ markup: `<path ${attrsNoD} d="${s.d.trim()}"/>`, bb: s.bb });
            }
            continue;
        }
        pieces.push({ markup: `<path ${attrs}/>`, bb: subs[0].bb });
    }
}

const center = (bb) => [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
/* Abstand eines Punkts zu einer Beinlinie Nabe -> Fuss. */
const distToLeg = (cx, cy) => {
    const distSeg = (x1, y1, x2, y2) => {
        const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / len2));
        return Math.hypot(cx - (x1 + t * dx), cy - (y1 + t * dy));
    };
    return Math.min(distSeg(HUB[0], HUB[1], 51, 309), distSeg(HUB[0], HUB[1], 223, 309));
};
const isLeg = (bb) => {
    const [cx, cy] = center(bb);
    const w = bb[2] - bb[0], h = bb[3] - bb[1];
    /* Fussplatten reichen bis y=314 - nur Beine/Fuesse kommen so tief,
       die Felge endet bei y~237. Vorher landeten sie im Rad und kreisten. */
    if (bb[3] > 300) return true;
    if (h > 150 && bb[3] > 300 && Math.abs(cx - HUB[0]) < 110) return true;
    if (bb[1] > 233 && (h > 40 || w < 8)) return true;
    /* Bein-/Strebenteile entlang der beiden Beinlinien (unterhalb der Nabe):
       frueher fielen sie ins Rad und drehten sich mit den Speichen.
       Nur laengliche Teile (>25) - kleine Gondelteile bei den Beinwinkeln
       (ca. 65/115 Grad) duerfen nicht als Bein einsortiert werden. */
    if (cy > 150 && Math.max(w, h) > 25 && distToLeg(cx, cy) < 18) return true;
    return false;
};

const groups = { gestell: [], rad: [], nabe: [] };
const candidates = [];
for (const p of pieces) {
    if (!isFinite(p.bb[0])) { groups.rad.push(p); continue; }
    const [cx, cy] = center(p.bb);
    const w = p.bb[2] - p.bb[0], h = p.bb[3] - p.bb[1];
    const r = Math.hypot(cx - HUB[0], cy - HUB[1]);
    if (p.markup.startsWith("<circle") && r < 5) { groups.nabe.push(p); continue; }
    if (isLeg(p.bb)) { groups.gestell.push(p); continue; }
    /* Gondeln: weiter gefasst als frueher (95-150 / <48) - Kabinendach-
       teile bei r=89-95 und groessere Kabinenteile fielen sonst ins Rad,
       drehten mit und kippten statt lotrecht zu haengen. */
    if (r > 85 && r < 165 && Math.max(w, h) < 60) { candidates.push({ ...p, r, a: Math.atan2(cy - HUB[1], cx - HUB[0]) }); continue; }
    groups.rad.push(p);
}

candidates.sort((a, b) => a.a - b.a);
const clusters = [];
for (const c of candidates) {
    const last = clusters[clusters.length - 1];
    if (last && c.a - last.a < 0.14) { last.items.push(c); last.a = (last.a * (last.items.length - 1) + c.a) / last.items.length; }
    else clusters.push({ a: c.a, items: [c] });
}
if (clusters.length > 1 && clusters[0].a - (clusters[clusters.length - 1].a - Math.PI * 2) < 0.14) {
    clusters[0].items.unshift(...clusters.pop().items);
    clusters[0].a = Math.atan2(
        clusters[0].items.reduce((s, it) => s + Math.sin(it.a), 0),
        clusters[0].items.reduce((s, it) => s + Math.cos(it.a), 0),
    );
}
clusters.forEach((c, i) => { groups[`gondel-${String(i + 1).padStart(2, "0")}`] = c.items; });

console.log(`Klassifikation -> gestell: ${groups.gestell.length}, rad: ${groups.rad.length}, nabe: ${groups.nabe.length}, Gondeln: ${clusters.length} (${clusters.map((c) => c.items.length).join("/")})`);
console.log(`Winkel: ${clusters.map((c) => ((c.a * 180) / Math.PI).toFixed(0)).join(", ")}`);

const order = ["gestell", "rad", "nabe", ...Object.keys(groups).filter((k) => k.startsWith("gondel"))];
const body = order
    .filter((g) => groups[g].length)
    .map((g) => `  <g id="${g}">\n    ${groups[g].map((p) => p.markup).join("\n    ")}\n  </g>`)
    .join("\n");

const openEnd = svg.indexOf(">", svg.indexOf("<svg")) + 1;
const firstG = svg.indexOf("<g", openEnd);
/* Header (Metadata, defs, style mit den Fill-Klassen) unbedingt erhalten. */
const header = svg.slice(openEnd, firstG === -1 ? svg.length : firstG);
const out = `${svg.slice(0, openEnd)}${header}<g id="Ebene_1">\n${body}\n</g>\n</svg>\n`;

if (!existsSync(BACKUP)) copyFileSync(SRC, BACKUP);
writeFileSync(SRC, out);
console.log(`public/Riesenrad.svg neu gruppiert (${(out.length / 1024).toFixed(1)} KB), Backup: .qwen/tmp/Riesenrad-flat-backup.svg`);
