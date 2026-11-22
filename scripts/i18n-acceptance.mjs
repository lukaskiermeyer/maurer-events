// i18n-Abnahmetest: prueft, dass keine fixen UI-Strings unuebersetzt bleiben.
// Läuft ohne DB/Netzwerk und ohne Provider-Keys. Aufruf: npm run test:i18n
//
// Teil 1 (hart): messages/de|en|bar.json — gleiche Keys, keine leeren Werte wo DE
//   Inhalt hat, identische Platzhalter.
// Teil 2 (hart): hartcodierte UI-Texte im oeffentlichen Scope (Komponenten + Seiten,
//   ohne Admin/Team). per TypeScript-AST: JsxText + Literal-Attribute (aria-label,
//   placeholder, title, alt, label). Texte in ui()/t()/localized() sind JsxExpression
//   bzw. Objekt-Literale und werden dadurch NICHT erfasst (korrekt uebersetzt).
//   Erlaubt sind nur Allowlist-Literale (Eigennamen, Marken, Adressen, E-Mails,
//   Sprach-Autonyme, Symbole, dekorative Kurzel).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const problems = [];
const info = [];

// ---------- Teil 1: Messages ----------
const load = (f) => JSON.parse(readFileSync(join(root, 'messages', f), 'utf8'));
const de = load('de.json'), en = load('en.json'), bar = load('bar.json');
function paths(o, p = '', out = []) {
  for (const [k, v] of Object.entries(o)) {
    const q = p ? p + '.' + k : k;
    if (Array.isArray(v)) v.forEach((it, i) => (it && typeof it === 'object') ? paths(it, q + '[' + i + ']', out) : out.push(q + '[' + i + ']'));
    else if (v && typeof v === 'object') paths(v, q, out);
    else out.push(q);
  }
  return out;
}
const get = (o, p) => p.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((a, k) => a == null ? a : a[k], o);
const ph = (s) => typeof s === 'string' ? (s.match(/\{\{[^}]+\}\}|\{[^}]+\}|%[sd]/g) || []).sort() : [];
const dp = paths(de).sort();
for (const [name, obj] of [['en', en], ['bar', bar]]) {
  const lp = paths(obj);
  for (const p of dp) {
    if (!lp.includes(p)) { problems.push(`messages/${name}.json: fehlender Key "${p}"`); continue; }
    const d = get(de, p), t = get(obj, p);
    if (typeof d === 'string' && d.trim() && (typeof t !== 'string' || !t.trim())) problems.push(`messages/${name}.json: leerer Wert "${p}" (DE hat Inhalt)`);
    else if (typeof d === 'string' && JSON.stringify(ph(d)) !== JSON.stringify(ph(t))) problems.push(`messages/${name}.json: Platzhalter abweichend "${p}" DE=${JSON.stringify(ph(d))} ${name}=${JSON.stringify(ph(t))}`);
  }
  for (const p of lp) if (!dp.includes(p)) info.push(`messages/${name}.json: zusaetzlicher Key "${p}" (nicht in DE)`);
}

// ---------- Teil 2: Hartcodierte UI-Texte (AST) ----------
const ALLOW_EXACT = new Set([
  'PDF', 'VIP', 'p.P.', 'Pers.', 'X', 'T', 'ME', 'QR-Code', 'QR', 'Code', 'Logo',
  'Instagram', 'TikTok', 'Google', 'Cloudinary', 'Stripe', 'NVIDIA', 'Rive',
  'Deutsch', 'English', 'Bayrisch', 'Bairisch', 'Boarisch',
  'MAURER EVENTS', 'Maurer Events', 'Maurer Events Logo', 'Made by', 'Made by Lui', 'MadeByLui',
  'Max Mustermann', 'John Doe', 'Rive Logo', 'Platzhalter', 'Da Maurerwirt',
  'Festwirt Easteregg', 'Festwirt Figur', 'MAURER', 'EVENTS', 'seit 2025',
  'Navigation', 'Links', 'Kontakt', 'Impressum', 'AGB', 'Datenschutz', 'Widerruf', 'Stornobedingungen', 'Widerrufsrecht',
  'Est. 2025', '2025', 'OK',
]);
const ALLOW_PATTERN = [
  /^[\s\d.,:;+\-–—•·×✓←→€%(){}[\]/\\|@#*!?°"'’‘„“‚…]+$/, // nur Symbole/Zahlen/Satzzeichen
  /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,             // E-Mail
  /^https?:\/\//i, /^www\./i,                              // URL
  /^@\w+$/,                                               // Social-Handle
  /^\d{5}\s/,                                             // PLZ + Ort
  /^Schwaiger Str/i, /^Müchsmünster$/i, /^Neustadt/i,
  /^(DE|EN|BAR|de|en|bar)$/,
  /^Florian Maurer\b/,                                    // Eigenname (Foto-Alt)
  /^&[a-z]+;$/i,                                         // HTML-Entity (z. B. &copy;)
];
function allowed(text) {
  const t = text.trim();
  if (!t) return true;
  if (ALLOW_EXACT.has(t)) return true;
  return ALLOW_PATTERN.some(rx => rx.test(t));
}
function looksLikeText(s) {
  return /[A-Za-zÄÖÜäöüß]/.test(s) && s.trim().length >= 2;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(e)) out.push(full);
  }
  return out;
}
const sep = join('src', 'components');
const scope = [
  ...walk(join(root, 'src/components')).filter(f =>
    !f.includes(join(sep, 'admin')) && !f.includes(join(sep, 'team'))),
  ...walk(join(root, 'src/app/[locale]')).filter(f =>
    !f.includes(join('src', 'app', '[locale]', 'admin')) &&
    !f.includes(join('src', 'app', '[locale]', 'team')) &&
    /page\.tsx$|error\.tsx$|not-found\.tsx$|layout\.tsx$/.test(f)),
];
// Rechtstexte sind bewusst DE/EN (bar faellt auf DE zurueck) — eigene Datenquellen.
const LEGAL = ['datenschutz', 'agb', 'impressum', 'widerruf', 'stornobedingungen'].map(s => join('src', 'app', '[locale]', s));
const TEXT_ATTRS = new Set(['aria-label', 'placeholder', 'title', 'alt', 'label']);

for (const file of scope) {
  if (LEGAL.some(l => file.includes(l))) continue;
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const flag = (s, pos) => {
    if (!looksLikeText(s) || allowed(s)) return;
    problems.push(`${rel}:${lineOf(pos)}: hartcodierter UI-Text ${JSON.stringify(s.trim())} — ueber useTranslations/ui()/localized lokalisieren`);
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      flag(node.text, node.pos);
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf);
      if (TEXT_ATTRS.has(name)) flag(node.initializer.text, node.initializer.pos);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// ---------- Report ----------
if (info.length) { console.log('Hinweise:'); info.forEach(x => console.log('  ' + x)); }
if (problems.length) {
  console.error(`\nFAIL: ${problems.length} i18n-Problem(e):`);
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
console.log(`OK: i18n-Abnahme bestanden. Messages de/en/bar konsistent (${dp.length} Keys), keine hartcodierten UI-Texte im oeffentlichen Scope (${scope.length} Dateien).`);