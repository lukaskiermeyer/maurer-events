import { validateCareerContent, parseCareerContent, DEFAULT_CAREER_CONTENT, MAX_POSITIONS } from '../src/lib/career';

let failures = 0;
const check = (name: string, fn: () => boolean) => {
  let ok = false;
  try { ok = fn(); } catch (error) { console.log(`FEHLER ${name}: ${(error as Error).message}`); failures += 1; return; }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`);
  if (!ok) failures += 1;
};
const rejects = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };

check('Standardinhalt ist gültig', () => validateCareerContent(DEFAULT_CAREER_CONTENT).positions.length === 2);

check('Trimmt und filtert leere Vorteile', () => {
  const out = validateCareerContent({
    ...DEFAULT_CAREER_CONTENT,
    positions: [{ ...DEFAULT_CAREER_CONTENT.positions[0], title: '  Service  ', benefits: ['  Trinkgeld  ', '', '   '] }],
  });
  return out.positions[0].title === 'Service' && out.positions[0].benefits.length === 1;
});

check('Leere Stellenliste ist erlaubt', () => validateCareerContent({ ...DEFAULT_CAREER_CONTENT, positions: [] }).positions.length === 0);

check('Lehnt leere Stellenbezeichnung ab', () => rejects(() => validateCareerContent({
  ...DEFAULT_CAREER_CONTENT, positions: [{ ...DEFAULT_CAREER_CONTENT.positions[0], title: '   ' }],
})));

check('Lehnt zu lange Beschreibung ab', () => rejects(() => validateCareerContent({
  ...DEFAULT_CAREER_CONTENT, positions: [{ ...DEFAULT_CAREER_CONTENT.positions[0], description: 'x'.repeat(2001) }],
})));

check('Lehnt doppelte Kennungen ab', () => rejects(() => validateCareerContent({
  ...DEFAULT_CAREER_CONTENT, positions: [DEFAULT_CAREER_CONTENT.positions[0], DEFAULT_CAREER_CONTENT.positions[0]],
})));

check('Lehnt ungültige Kennung ab', () => rejects(() => validateCareerContent({
  ...DEFAULT_CAREER_CONTENT, positions: [{ ...DEFAULT_CAREER_CONTENT.positions[0], id: 'a b/c' }],
})));

check(`Lehnt mehr als ${MAX_POSITIONS} Stellen ab`, () => rejects(() => validateCareerContent({
  ...DEFAULT_CAREER_CONTENT,
  positions: Array.from({ length: MAX_POSITIONS + 1 }, (_, i) => ({ ...DEFAULT_CAREER_CONTENT.positions[0], id: `p${i}` })),
})));

check('Lehnt zu viele Vorteile ab', () => rejects(() => validateCareerContent({
  ...DEFAULT_CAREER_CONTENT, positions: [{ ...DEFAULT_CAREER_CONTENT.positions[0], benefits: Array.from({ length: 11 }, (_, i) => `b${i}`) }],
})));

check('Ohne gespeicherten Inhalt: Standard', () => parseCareerContent(undefined).positions.length === 2);

check('Beschädigtes JSON: leere Seite statt Absturz', () => {
  const out = parseCareerContent('{kaputt');
  return out.positions.length === 0 && out.headline.length > 0;
});

check('Veraltetes JSON: leere Seite statt Absturz', () => parseCareerContent(JSON.stringify({ headline: 'x' })).positions.length === 0);

check('Gültiges JSON wird übernommen', () => parseCareerContent(JSON.stringify(DEFAULT_CAREER_CONTENT)).positions[0].title === 'Servicekräfte (m/w/d)');

console.log(failures === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);