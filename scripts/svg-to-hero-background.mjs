#!/usr/bin/env node
/**
 * Codemod: public/Hintergrund.svg -> src/components/HeroBackground.tsx
 *
 * Erzeugt aus der statischen, handgezeichneten Festzelt-Szene eine Client-Component
 * mit semantischen Layern und framer-motion-Animationen.
 *
 *   node scripts/svg-to-hero-background.mjs
 *   npm run generate:hero-background
 *
 * Grundsaetze:
 *  - Pfade/Geometrie werden 1:1 aus der Quelldatei uebernommen, nie nachgebaut.
 *  - Keine externen Abhaengigkeiten (nur node:fs / node:path / node:url).
 *  - Deterministisch: gleicher Input ergibt byte-identischen Output.
 *  - Entfernt werden nur XML-Prolog, DOCTYPE, Kommentare und <metadata>/XMP.
 *
 * Layer-Klassifikation
 * --------------------
 * Die Szene hat ~1188 Formelemente mit ~1097 unterschiedlichen Fill-Farben - fast
 * jedes Element traegt einen eigenen Ton. Eine Zuordnung ueber feste Hex-Listen
 * wuerde nur rund 5 % der Elemente erfassen, deshalb wird im HSL-Raum klassifiziert.
 * Die in der Aufgabenstellung genannten Hexwerte dienen als Anker der Farbfamilien.
 *
 * Einzige Ausnahme: layer-flags. Die Flaggen-Blautoene (#2779af, #287bb2, #297ab1,
 * #297ab0) und das Zelt-Blau #2775ae sind farblich praktisch identisch
 * (Hue 203.8 vs 205.3, S 0.634 vs 0.634, L 0.420 vs 0.418) und damit im HSL-Raum
 * nicht trennbar. Fuer diese vier Hexwerte wird deshalb exakt gematcht.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(repoRoot, "public/Hintergrund.svg");
const TARGET = resolve(repoRoot, "src/components/HeroBackground.tsx");

const SHAPE_TAGS = new Set([
    "path",
    "circle",
    "ellipse",
    "rect",
    "polygon",
    "polyline",
    "line",
]);

/** Exakte Flaggen-Farben; siehe Header-Kommentar. */
const FLAG_HEXES = new Set(["#2779af", "#287bb2", "#297ab1", "#297ab0"]);

/** SVG-Praesentationsattribute -> JSX-Prop. Rest wird generisch ge-camel-cased. */
const ATTR_TO_JSX = {
    class: "className",
    "stop-color": "stopColor",
    "stop-opacity": "stopOpacity",
    "fill-opacity": "fillOpacity",
    "fill-rule": "fillRule",
    "stroke-width": "strokeWidth",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "stroke-miterlimit": "strokeMiterlimit",
    "stroke-dasharray": "strokeDasharray",
    "stroke-dashoffset": "strokeDashoffset",
    "stroke-opacity": "strokeOpacity",
    "clip-path": "clipPath",
    "clip-rule": "clipRule",
    "font-size": "fontSize",
    "font-family": "fontFamily",
    "text-anchor": "textAnchor",
    "xlink:href": "xlinkHref",
    "xml:space": "xmlSpace",
};

/** Reihenfolge der Layer-Ausgabe = Malerreihenfolge (unten -> oben). */
const LAYER_ORDER = ["scene", "wood", "trees", "tents", "fog", "flags", "lights"];
const ANIMATED_LAYERS = new Set(["fog", "flags", "lights"]);

function fail(message) {
    console.error(`[svg-to-hero-background] ${message}`);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Quelle laden und bereinigen
// ---------------------------------------------------------------------------

if (!existsSync(SOURCE)) {
    fail(`Quelle fehlt: ${SOURCE}\nKein Fallback moeglich - Abbruch, es wird nichts generiert.`);
}

const cleaned = readFileSync(SOURCE, "utf8")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

// ---------------------------------------------------------------------------
// Minimaler, quote-sicherer Markup-Scanner + Tree-Builder
// ---------------------------------------------------------------------------

function scanTokens(markup) {
    const tokens = [];
    const n = markup.length;
    let i = 0;

    while (i < n) {
        if (markup[i] !== "<") {
            i += 1;
            continue;
        }
        if (markup.startsWith("<!--", i)) {
            const end = markup.indexOf("-->", i);
            i = end === -1 ? n : end + 3;
            continue;
        }
        if (markup.startsWith("<?", i)) {
            const end = markup.indexOf("?>", i);
            i = end === -1 ? n : end + 2;
            continue;
        }
        if (markup.startsWith("<!", i)) {
            const end = markup.indexOf(">", i);
            i = end === -1 ? n : end + 1;
            continue;
        }

        // Schliess-Tag
        if (markup[i + 1] === "/") {
            let j = i + 2;
            let name = "";
            while (j < n && /[^\s>]/.test(markup[j])) {
                name += markup[j];
                j += 1;
            }
            const end = markup.indexOf(">", j);
            tokens.push({ kind: "close", name });
            i = end === -1 ? n : end + 1;
            continue;
        }

        // Start-Tag
        let j = i + 1;
        let name = "";
        while (j < n && /[^\s/>]/.test(markup[j])) {
            name += markup[j];
            j += 1;
        }

        const attrs = Object.create(null);
        const attrOrder = [];
        let selfClosing = false;

        while (j < n) {
            while (j < n && /\s/.test(markup[j])) j += 1;
            if (markup[j] === "/" && markup[j + 1] === ">") {
                selfClosing = true;
                j += 2;
                break;
            }
            if (markup[j] === ">") {
                j += 1;
                break;
            }

            let attrName = "";
            while (j < n && /[^\s=/>]/.test(markup[j])) {
                attrName += markup[j];
                j += 1;
            }
            if (!attrName) {
                j += 1;
                continue;
            }
            while (j < n && /\s/.test(markup[j])) j += 1;

            if (markup[j] !== "=") {
                attrs[attrName] = "";
                attrOrder.push(attrName);
                continue;
            }
            j += 1;
            while (j < n && /\s/.test(markup[j])) j += 1;

            const quote = markup[j];
            let value = "";
            if (quote === '"' || quote === "'") {
                j += 1;
                while (j < n && markup[j] !== quote) {
                    value += markup[j];
                    j += 1;
                }
                j += 1;
            } else {
                while (j < n && !/[\s>]/.test(markup[j])) {
                    value += markup[j];
                    j += 1;
                }
            }
            attrs[attrName] = value;
            attrOrder.push(attrName);
        }

        tokens.push({ kind: selfClosing ? "void" : "open", name, attrs, attrOrder });
        i = j;
    }

    return tokens;
}

function buildTree(tokens) {
    const roots = [];
    const stack = [];

    for (const token of tokens) {
        if (token.kind === "close") {
            const open = stack.pop();
            if (!open || open.name !== token.name) {
                fail(`Markup nicht wohlgeformt: </${token.name}> ohne passendes Start-Tag.`);
            }
            continue;
        }
        const node = {
            name: token.name,
            attrs: token.attrs,
            attrOrder: token.attrOrder,
            children: [],
        };
        if (stack.length > 0) stack[stack.length - 1].children.push(node);
        else roots.push(node);
        if (token.kind === "open") stack.push(node);
    }

    if (stack.length > 0) {
        fail(`Markup nicht wohlgeformt: ${stack.length} Tag(s) nicht geschlossen.`);
    }
    return roots;
}

const roots = buildTree(scanTokens(cleaned));
const svgRoot = roots.find((node) => node.name === "svg");
if (!svgRoot) fail("Kein <svg>-Root gefunden.");

const viewBox = svgRoot.attrs.viewBox;
if (!viewBox) fail("<svg> hat kein viewBox-Attribut.");

// ---------------------------------------------------------------------------
// defs und Formelemente sammeln
// ---------------------------------------------------------------------------

function findAll(node, name, acc = []) {
    if (node.name === name) acc.push(node);
    for (const child of node.children) findAll(child, name, acc);
    return acc;
}

const defsNodes = svgRoot.children.filter((node) => node.name === "defs");
if (defsNodes.length > 1) fail("Mehr als ein <defs>-Block - unerwartet.");

const groups = findAll(svgRoot, "g");
if (groups.length > 1) {
    fail(
        `${groups.length} verschachtelte <g> gefunden. Ein Flatten wuerde ` +
            "Transformationen verlieren - Abbruch."
    );
}

const shapeContainer = groups.length === 1 ? groups[0] : svgRoot;
const shapes = shapeContainer.children.filter((node) => SHAPE_TAGS.has(node.name));

const unexpected = shapeContainer.children.filter(
    (node) => !SHAPE_TAGS.has(node.name) && node.name !== "defs"
);
if (unexpected.length > 0) {
    fail(`Nicht unterstuetzte Kindelemente: ${unexpected.map((u) => u.name).join(", ")}`);
}
if (shapes.length === 0) fail("Keine Formelemente gefunden.");

// ---------------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
    let h = hex.trim().replace(/^#/, "").toLowerCase();
    if (h.length === 3) {
        h = h
            .split("")
            .map((c) => c + c)
            .join("");
    }
    if (!/^[0-9a-f]{6}$/.test(h)) return null;
    return [
        Number.parseInt(h.slice(0, 2), 16),
        Number.parseInt(h.slice(2, 4), 16),
        Number.parseInt(h.slice(4, 6), 16),
    ];
}

function rgbToHsl([r, g, b]) {
    const R = r / 255;
    const G = g / 255;
    const B = b / 255;
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return { h, s, l };
}

/** { h, s, l } fuer einen Fill-Wert, sonst null (z. B. url(#verlauf)). */
function colorOf(fill) {
    if (!fill || !fill.startsWith("#")) return null;
    const rgb = hexToRgb(fill);
    return rgb ? rgbToHsl(rgb) : null;
}

/** Warme Lichtfarbe (Gelb/Orange/Creme). */
function isWarm({ h, s, l }) {
    return h >= 18 && h <= 100 && (s >= 0.12 || l >= 0.8);
}

// ---------------------------------------------------------------------------
// Attribute -> JSX-Props
// ---------------------------------------------------------------------------

function parseStyle(value) {
    const decls = new Map();
    for (const part of value.split(";")) {
        const idx = part.indexOf(":");
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key) decls.set(key, val);
    }
    return decls;
}

function toJsxName(name) {
    if (ATTR_TO_JSX[name]) return ATTR_TO_JSX[name];
    if (!name.includes("-")) return name;
    return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const JSX_UNSAFE = /["<>{}&]/;

/**
 * Liefert die JSX-Props (Wert bereits formatiert) und den normalisierten Fill-Wert.
 * `style` mit reiner fill-Deklaration wird zum `fill`-Attribut.
 */
function toJsxProps(node) {
    const props = [];
    let fill = null;

    for (const name of node.attrOrder) {
        const value = node.attrs[name];
        if (JSX_UNSAFE.test(value)) {
            fail(
                `Attribut ${name} von <${node.name}> enthaelt JSX-unsichere Zeichen: ` +
                    `${value.slice(0, 80)}`
            );
        }

        if (name === "style") {
            const decls = parseStyle(value);
            const fillDecl = decls.get("fill");
            if (fillDecl) fill = fillDecl.toLowerCase();
            if (decls.size === 1 && fillDecl) {
                props.push(["fill", JSON.stringify(fillDecl)]);
                continue;
            }
            const entries = [...decls.entries()]
                .map(([k, v]) => `${toJsxName(k)}: ${JSON.stringify(v)}`)
                .join(", ");
            props.push(["style", `{ { ${entries} } }`]);
            continue;
        }

        props.push([toJsxName(name), JSON.stringify(value)]);
    }

    return { props, fill };
}

function renderAttrs(props) {
    return props.map(([name, value]) => ` ${name}=${value}`).join("");
}

/** Serialisiert einen Teilbaum (fuer <defs>) als JSX. */
function serializeNode(node, pad) {
    const { props } = toJsxProps(node);
    if (node.children.length === 0) {
        return `${pad}<${node.name}${renderAttrs(props)} />`;
    }
    const kids = node.children.map((child) => serializeNode(child, `${pad}    `)).join("\n");
    return `${pad}<${node.name}${renderAttrs(props)}>\n${kids}\n${pad}</${node.name}>`;
}

// ---------------------------------------------------------------------------
// Klassifikation
// ---------------------------------------------------------------------------

function classify(node, fill) {
    // layer-lights: alle Kreise mit r < 4 und warmem Fill.
    if (node.name === "circle") {
        const r = Number.parseFloat(node.attrs.r ?? "");
        const c = colorOf(fill);
        if (Number.isFinite(r) && r < 4 && c && isWarm(c)) return "lights";
    }

    // Farblich nicht von tents trennbar -> exakter Match.
    if (fill && FLAG_HEXES.has(fill)) return "flags";

    const c = colorOf(fill);
    if (!c) return "scene";
    const { h, s, l } = c;

    if (h >= 180 && h <= 215 && l >= 0.55 && s >= 0.15) return "fog";
    if (h >= 175 && h <= 215 && l < 0.55 && s >= 0.15) return "tents";
    if (h >= 60 && h < 175) return "trees";
    if (h >= 8 && h < 60) return "wood";

    // Neutrale Grautoene, Schwarz und alles Uebrige: statischer Rest der Szene.
    return "scene";
}

const layers = new Map(LAYER_ORDER.map((name) => [name, []]));

for (const node of shapes) {
    const { props, fill } = toJsxProps(node);
    layers.get(classify(node, fill)).push({ node, props });
}

const emitted = [...layers.values()].reduce((sum, list) => sum + list.length, 0);
if (emitted !== shapes.length) {
    fail(`Elementverlust: ${shapes.length} gelesen, ${emitted} zugeordnet.`);
}

// ---------------------------------------------------------------------------
// Deterministische Animationsparameter
// ---------------------------------------------------------------------------

const round = (value, digits) => Number(value.toFixed(digits));

/** Twinkle: duration 2-3 s, delay deterministisch pro Index. */
function lightMotion(index) {
    return {
        duration: round(2 + ((index * 7) % 11) / 10, 1),
        delay: round((index * 0.13) % 2.4, 2),
    };
}

/** Wehen: duration 4-6 s. */
function flagMotion(index) {
    return {
        duration: round(4 + ((index * 3) % 5) * 0.5, 1),
        delay: round((index * 0.37) % 2, 2),
    };
}

const FOG_PARTS = [
    { key: "a", x: "[0, 18, 0]", opacity: "[0.88, 1, 0.88]", duration: 22 },
    { key: "b", x: "[0, -14, 0]", opacity: "[0.9, 1, 0.9]", duration: 26 },
];

// ---------------------------------------------------------------------------
// TSX erzeugen
// ---------------------------------------------------------------------------

const PAD = "                ";
const out = [];

out.push(`/* AUTO-GENERATED von scripts/svg-to-hero-background.mjs - nicht von Hand editieren. */
/* Quelle: public/Hintergrund.svg (Geometrie 1:1, nur Metadata entfernt).            */
/* Neu erzeugen: npm run generate:hero-background                                    */
"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function HeroBackground() {
    const reduced = useReducedMotion();

    return (
        <motion.div
            className="h-full w-full"
            initial={reduced ? false : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
        >
            <svg
                viewBox="${viewBox}"
                preserveAspectRatio="xMidYMid slice"
                className="h-full w-full"
                aria-hidden="true"
            >`);

if (defsNodes.length === 1) {
    const defs = defsNodes[0];
    out.push(`${PAD}<defs>`);
    for (const child of defs.children) {
        out.push(serializeNode(child, `${PAD}    `));
    }
    out.push(`${PAD}</defs>`);
}

for (const layer of LAYER_ORDER) {
    const entries = layers.get(layer);
    if (entries.length === 0) continue;
    out.push("");

    if (layer === "fog") {
        out.push(`${PAD}<g data-layer="fog">`);
        FOG_PARTS.forEach((part, partIndex) => {
            const slice = entries.filter((_, i) => i % FOG_PARTS.length === partIndex);
            if (slice.length === 0) return;
            out.push(`${PAD}    <motion.g`);
            out.push(`${PAD}        data-part="${part.key}"`);
            out.push(
                `${PAD}        animate={reduced ? false : { x: ${part.x}, opacity: ${part.opacity} }}`
            );
            out.push(`${PAD}        transition={`);
            out.push(`${PAD}            reduced`);
            out.push(`${PAD}                ? undefined`);
            out.push(
                `${PAD}                : { duration: ${part.duration}, repeat: Infinity, ease: "easeInOut" }`
            );
            out.push(`${PAD}        }`);
            out.push(`${PAD}    >`);
            for (const entry of slice) {
                out.push(
                    `${PAD}        <${entry.node.name}${renderAttrs(entry.props)} />`
                );
            }
            out.push(`${PAD}    </motion.g>`);
        });
        out.push(`${PAD}</g>`);
        continue;
    }

    if (layer === "flags") {
        out.push(`${PAD}<g data-layer="flags">`);
        entries.forEach((entry, index) => {
            const { duration, delay } = flagMotion(index);
            out.push(`${PAD}    <motion.${entry.node.name}${renderAttrs(entry.props)}`);
            out.push(
                `${PAD}        style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}`
            );
            out.push(
                `${PAD}        animate={reduced ? false : { skewY: [0, 3, 0], rotate: [0, 1.5, 0] }}`
            );
            out.push(`${PAD}        transition={`);
            out.push(`${PAD}            reduced`);
            out.push(`${PAD}                ? undefined`);
            out.push(
                `${PAD}                : { duration: ${duration}, delay: ${delay}, repeat: Infinity, ease: "easeInOut" }`
            );
            out.push(`${PAD}        }`);
            out.push(`${PAD}    />`);
        });
        out.push(`${PAD}</g>`);
        continue;
    }

    if (layer === "lights") {
        out.push(`${PAD}<g data-layer="lights">`);
        entries.forEach((entry, index) => {
            const { duration, delay } = lightMotion(index);
            out.push(`${PAD}    <motion.${entry.node.name}${renderAttrs(entry.props)}`);
            out.push(
                `${PAD}        style={{ transformBox: "fill-box", transformOrigin: "center" }}`
            );
            out.push(`${PAD}        animate={`);
            out.push(`${PAD}            reduced`);
            out.push(`${PAD}                ? false`);
            out.push(
                `${PAD}                : { opacity: [0.35, 1, 0.35], scale: [0.9, 1.1, 0.9] }`
            );
            out.push(`${PAD}        }`);
            out.push(`${PAD}        transition={`);
            out.push(`${PAD}            reduced`);
            out.push(`${PAD}                ? undefined`);
            out.push(
                `${PAD}                : { duration: ${duration}, delay: ${delay}, repeat: Infinity, ease: "easeInOut" }`
            );
            out.push(`${PAD}        }`);
            out.push(`${PAD}    />`);
        });
        out.push(`${PAD}</g>`);
        continue;
    }

    out.push(`${PAD}<g data-layer="${layer}">`);
    for (const entry of entries) {
        out.push(`${PAD}    <${entry.node.name}${renderAttrs(entry.props)} />`);
    }
    out.push(`${PAD}</g>`);
}

out.push(`            </svg>
        </motion.div>
    );
}
`);

const tsx = out.join("\n");
writeFileSync(TARGET, tsx, "utf8");

// ---------------------------------------------------------------------------
// Bericht
// ---------------------------------------------------------------------------

console.log(`[svg-to-hero-background] Quelle : ${SOURCE}`);
console.log(`[svg-to-hero-background] Ziel   : ${TARGET}`);
console.log(`[svg-to-hero-background] viewBox: ${viewBox}`);
console.log(`[svg-to-hero-background] Elemente gesamt: ${shapes.length}`);
for (const layer of LAYER_ORDER) {
    const count = layers.get(layer).length;
    if (count === 0) continue;
    console.log(
        `  - ${layer.padEnd(7)} ${String(count).padStart(4)}  ${
            ANIMATED_LAYERS.has(layer) ? "animiert" : "statisch"
        }`
    );
}
console.log(
    `[svg-to-hero-background] geschrieben: ${(Buffer.byteLength(tsx) / 1024).toFixed(1)} KB`
);
