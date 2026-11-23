// Testet die Filter-, Datums-, Score- und Verifizierungs-Logik der Festfinder-Workflow-Nodes (docs-JSON)
// Aufruf: node scripts/test-festfinder-workflow.mjs  (rein lokal, ohne DB/Netz)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const j = JSON.parse(fs.readFileSync(`${root}docs/Festfinder - Vereinsfeste (v3 mit Mock-Switch).json`, 'utf8'));
const code = (name) => j.nodes.find((n) => n.name === name).parameters.jsCode;

function run(jsCode, llmOutputs, nodeMap) {
  const inputs = llmOutputs.map((d, i) => ({
    json: d.error ? { error: d.error } : { choices: [{ message: { content: JSON.stringify(d) } }] },
    pairedItem: { item: i },
  }));
  const $input = { all: () => inputs };
  const $ = (name) => {
    const arr = nodeMap[name] || [];
    return { all: () => arr, first: () => arr[0] };
  };
  return new Function('$input', '$', jsCode)($input, $);
}

const now = new Date();
const yNow = now.getUTCFullYear();
const plusDays = (d) => { const x = new Date(now); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const plusMonths = (m) => { const x = new Date(now); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

const chanceSrc = (i) => ({
  json: {
    url: `https://example${i}.de/page`,
    sourceUrlNormalized: `https://example${i}.de/page`,
    title: `Fall ${i}`,
    region: 'Ingolstadt',
    runId: 'test',
    todayIso: now.toISOString().slice(0, 10),
    minScore: 60,
    maxVerify: 10,
    maxSourceAgeDays: 180,
    nimModel: 'test',
    tavilyScore: 0.9,
  },
});

const radarSrc = (i) => ({
  json: {
    domain: `verein${i}.de`,
    url: `https://verein${i}.de/chronik`,
    title: `Verein ${i}`,
    contentHash: 'h' + i,
    queryType: 'gruendungsjahr',
    region: 'Ingolstadt',
    runId: 'test',
    todayIso: now.toISOString().slice(0, 10),
    horizonMonths: 48,
    connectMinMonths: 18,
    connectMaxMonths: 42,
    minLeadScore: 55,
    maxEnrich: 10,
    nimModel: 'test',
  },
});

let failures = 0;
const check = (label, cond, detail) => {
  console.log(`${cond ? '✓' : '✗ FEHLER'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
};

// ---------- Fest-Chancen Stufe 1: "Bewerten + Filtern (Stufe 1)" ----------
const chanceCases = [
  { name: 'open Kernregion, Termin in 12 Monaten + offene Frist', d: { isEventPage: true, festwirtStatus: 'open', eventType: 'volksfest', regionFit: 'core', eventDate: plusMonths(12), applicationDeadline: plusDays(30), sourceDate: plusDays(-5), planningSignal: 'termin', location: 'Ingolstadt', organizer: 'Stadt Ingolstadt' }, keep: true, leadType: 'open' },
  { name: 'open weit weg (Vilshofen-Pattern) -> far wird verworfen', d: { isEventPage: true, festwirtStatus: 'open', eventType: 'volksfest', regionFit: 'far', eventDate: plusMonths(12), planningSignal: 'presse', location: 'Vilshofen', organizer: 'Stadt Vilshofen' }, keep: false },
  { name: 'open mit ABGELAUFENER Frist -> hart verworfen', d: { isEventPage: true, festwirtStatus: 'open', eventType: 'volksfest', regionFit: 'core', eventDate: plusMonths(12), applicationDeadline: plusDays(-2), sourceDate: plusDays(-20), location: 'Kelheim', organizer: 'Stadt Kelheim' }, keep: false },
  { name: 'open mit VERGANGENEM Festdatum -> hart verworfen', d: { isEventPage: true, festwirtStatus: 'open', eventType: 'schuetzen', jubileeYears: 125, regionFit: 'core', eventDate: plusDays(-40), location: 'Kelheim', organizer: 'SV Alt' }, keep: false },
  { name: 'open mit VERALTETER Quelle (>180 Tage) -> hart verworfen', d: { isEventPage: true, festwirtStatus: 'open', eventType: 'volksfest', regionFit: 'core', eventDate: plusMonths(12), sourceDate: plusDays(-250), location: 'Ingolstadt', organizer: 'Alt-Artikel' }, keep: false },
  { name: 'signal Kernregion, Jahr y+2 (Ingolstadt-Pattern)', d: { isEventPage: true, festwirtStatus: 'unknown', eventType: 'volksfest', regionFit: 'core', eventYear: yNow + 2, sourceDate: plusDays(-10), planningSignal: 'termin', location: 'Ingolstadt', organizer: 'Volksfest Ingolstadt' }, keep: true, leadType: 'signal' },
  { name: 'taken -> verworfen', d: { isEventPage: true, festwirtStatus: 'taken', eventType: 'volksfest', regionFit: 'core', recurring: true, eventYear: yNow + 1, incumbentFestwirt: 'Brauerei X' }, keep: false },
  { name: 'closed -> verworfen', d: { isEventPage: true, festwirtStatus: 'closed', eventType: 'volksfest', regionFit: 'adjacent', eventYear: yNow + 1, location: 'Waldkraiburg' }, keep: false },
  { name: 'Streit-News -> isEventPage false', d: { isEventPage: false, festwirtStatus: 'open', eventType: 'volksfest', regionFit: 'adjacent' }, keep: false },
  { name: 'Notfall abgesprungen (Pfaffenhofen-Pattern)', d: { isEventPage: true, festwirtStatus: 'open', emergency: true, eventType: 'volksfest', regionFit: 'adjacent', planningSignal: 'presse', location: 'Pfaffenhofen', organizer: 'Volksfest Pfaffenhofen' }, keep: true, leadType: 'open' },
];

const chanceSources = chanceCases.map((_, i) => chanceSrc(i));
const chanceOut = run(code('Bewerten + Filtern (Stufe 1)'), chanceCases.map((c) => c.d), {
  'Kandidaten vorbereiten': chanceSources,
  'Bekannte URLs laden (Fest)': [{ json: { urls: [], eventKeys: [] } }],
}).filter((o) => !o.json._empty);

const keptTitles = chanceOut.map((o) => o.json.title);
console.log('--- Fest-Chancen Stufe 1: Bewerten + Filtern ---');
chanceCases.forEach((c, i) => {
  const kept = keptTitles.includes(`Fall ${i}`);
  check(`Fall ${i + 1} (${c.name}): ${c.keep ? 'behalten' : 'verworfen'}`, kept === c.keep);
  if (c.keep) {
    const row = chanceOut.find((o) => o.json.title === `Fall ${i}`);
    if (c.leadType) check(`  leadType=${c.leadType}`, row.json.leadType === c.leadType, row.json.leadType);
    check('  verifyQuery erzeugt', Boolean(row.json.verifyQuery));
  }
});
check('Genau 3 von 10 behalten', chanceOut.length === 3, String(chanceOut.length));

// ---------- Fest-Chancen Stufe 2: "Verifizierung auswerten" ----------
const verifyInputs = [
  { verificationStatus: 'verified', applicationDeadline: plusDays(25), festwirtStatus: 'open', contactEmail: 'neu@stadt.de', verificationSummary: 'Ausschreibung offen, Frist bestätigt.' },
  { verificationStatus: 'already_awarded', festwirtStatus: 'taken', verificationSummary: 'Wirt wurde letzte Woche vergeben.' },
  { verificationStatus: 'verified', applicationDeadline: plusDays(-3), festwirtStatus: 'open', verificationSummary: 'Frist doch schon vorbei.' },
];
const verifyOut = run(code('Verifizierung auswerten'), verifyInputs, {
  'Verify-Kontext bündeln': chanceOut,
}).filter((o) => !o.json._empty);

console.log('\n--- Fest-Chancen Stufe 2: Verifizierung auswerten ---');
check('Nur 1 von 3 passiert Stufe-2 Verifizierung', verifyOut.length === 1, String(verifyOut.length));
if (verifyOut[0]) {
  check('  verificationStatus=verified', verifyOut[0].json.verificationStatus === 'verified');
  check('  Kontakt aus Nachrecherche übernommen', verifyOut[0].json.contactEmail === 'neu@stadt.de');
  check('  verifiedAt gesetzt', Boolean(verifyOut[0].json.verifiedAt));
}

// ---------- Radar Stufe 1: "Jubiläen + Lead-Score" ----------
const radarCases = [
  { name: '3-Jahres-Vorlauf (150J in y+3): connecten', d: { vereinName: 'FF Gerolfing', ort: 'Gerolfing', vereinsTyp: 'feuerwehr', foundingYear: (yNow + 3) - 150, regionFit: 'core', mitglieder: 320, contactName: 'Hans Muster', contactEmail: 'hans@ff.de', planningSignals: [{ type: 'festausschuss', text: 'Ausschuss' }] }, keep: true, status: 'connecten' },
  { name: 'Kurzfristig (150J in y+1): jetzt_anbieten', d: { vereinName: 'FF Zuchering', ort: 'Zuchering', vereinsTyp: 'feuerwehr', foundingYear: (yNow + 1) - 150, regionFit: 'core', mitglieder: 120, planningSignals: [] }, keep: true, status: 'jetzt_anbieten' },
  { name: 'Dachau-Pattern: far -> verworfen', d: { vereinName: 'Stadt Dachau', ort: 'Dachau', vereinsTyp: 'other', regionFit: 'far', announcedEvents: [{ year: yNow + 2 }] }, keep: false },
  { name: 'Listen-Seite: vereinName null -> verworfen', d: { vereinName: null, ort: 'Buxheim', vereinsTyp: 'feuerwehr', regionFit: 'core', foundingYear: (yNow + 2) - 150 }, keep: false },
];

const radarSources = radarCases.map((_, i) => radarSrc(i));
const radarOut = run(code('Jubiläen + Lead-Score'), radarCases.map((c) => c.d), {
  'Radar-Treffer sammeln': radarSources,
  'Bekannte Domains laden (Radar)': [{ json: { radarDomains: [], radarDeletedLeadKeys: [] } }],
}).filter((o) => !o.json._empty);

console.log('\n--- Radar Stufe 1: Jubiläen + Lead-Score ---');
radarCases.forEach((c, i) => {
  const kept = radarOut.some((o) => o.json.domain === `verein${i}.de`);
  check(`Fall ${i + 1} (${c.name}): ${c.keep ? 'behalten' : 'verworfen'}`, kept === c.keep);
  if (c.keep && c.status) {
    const row = radarOut.find((o) => o.json.domain === `verein${i}.de`);
    check(`  status=${c.status}`, row.json.status === c.status, row.json.status);
    check('  enrichQuery erzeugt', Boolean(row.json.enrichQuery));
  }
});

// ---------- Radar Stufe 2: "Radar-Enrich auswerten" ----------
const enrichInputs = [
  { isRelevantClub: true, nextVisitEvent: 'Starkbierfest', nextVisitDate: plusDays(60), nextVisitUrl: 'https://verein0.de/termine', tentHistory: '2004 großes Festzelt', verificationSummary: 'Starkbierfest als idealer Besuchsanlass gefunden.' },
  { isRelevantClub: true, nextVisitEvent: 'Altes Fest', nextVisitDate: plusDays(-20), verificationSummary: 'Nur vergangenes Fest gefunden.' },
];
const enrichOut = run(code('Radar-Enrich auswerten'), enrichInputs, {
  'Radar-Enrich bündeln': radarOut,
}).filter((o) => !o.json._empty);

console.log('\n--- Radar Stufe 2: Radar-Enrich auswerten ---');
check('Beide Vereine behalten', enrichOut.length === 2, String(enrichOut.length));
check('Zukünftiger Besuchs-Anlass übernommen', enrichOut[0]?.json.nextVisitEvent === 'Starkbierfest' && Boolean(enrichOut[0]?.json.nextVisitDate));
check('nextAction nennt Starkbierfest', Boolean(enrichOut[0]?.json.nextAction?.includes('Starkbierfest')));
check('Vergangenes Besuchs-Datum ignoriert', enrichOut[1]?.json.nextVisitDate === null && enrichOut[1]?.json.nextVisitEvent === null);

console.log(failures === 0 ? '\nALLE WORKFLOW-TESTS BESTANDEN' : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
