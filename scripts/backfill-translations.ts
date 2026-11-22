// Backfill: fuellt leere EN/Bar-Felder fuer Events und Dokumente per KI (NIM).
// Manuell gepflegte Uebersetzungen bleiben erhalten (nur leere Felder werden gefuellt).
// Aufruf: npm run backfill:translations   (tsx --env-file=.env.local)
// Optional: --dry-run (nur anzeigen, nichts schreiben), --limit=N (max. Datensaetze).
// Achtung: NIM-Reasoning-Modell, Bairisch ~30-45s/Feld — bei vielen Datensaetzen dauert es.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, isNull } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { translateFields } from '../src/lib/translate';
import { validateCareerContent, fillCareerTranslations } from '../src/lib/career';

const empty = (v: string | null | undefined) => !v || !v.trim();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Number.POSITIVE_INFINITY;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  if (!process.env.NIM_API_KEY) console.warn('Hinweis: NIM_API_KEY fehlt — translateFields liefert den Originaltext (Fail-open).');
  const client = postgres(url, { max: 2, connect_timeout: 10 });
  const db = drizzle(client, { schema });

  let done = 0;

  const EVENT_FIELDS = [
    { src: 'title', en: 'titleEn', bar: 'titleBar' },
    { src: 'location', en: 'locationEn', bar: 'locationBar' },
    { src: 'description', en: 'descriptionEn', bar: 'descriptionBar' },
  ] as const;

  const events = await db.select().from(schema.events).where(isNull(schema.events.deletedAt));
  for (const ev of events) {
    if (done >= limit) break;
    const needs = EVENT_FIELDS.filter(f => empty(ev[f.en]) || empty(ev[f.bar]));
    if (needs.length === 0) continue;
    const updates: Partial<typeof schema.events.$inferInsert> = {};
    for (const f of needs) {
      const source = ev[f.src];
      if (!source || !source.trim()) continue;
      const t = await translateFields({ [f.src]: source });
      if (empty(ev[f.en])) updates[f.en] = t.en[f.src];
      if (empty(ev[f.bar])) updates[f.bar] = t.bar[f.src];
    }
    if (Object.keys(updates).length === 0) continue;
    console.log(`Event "${ev.title}" (${ev.id}): ${Object.keys(updates).join(', ')}`);
    if (!dryRun) await db.update(schema.events).set(updates).where(eq(schema.events.id, ev.id));
    done++;
  }

  const docs = await db.select().from(schema.eventDocuments);
  for (const doc of docs) {
    if (done >= limit) break;
    if (!empty(doc.titleEn) && !empty(doc.titleBar)) continue;
    if (!doc.title || !doc.title.trim()) continue;
    const t = await translateFields({ title: doc.title });
    const updates: Partial<typeof schema.eventDocuments.$inferInsert> = {};
    if (empty(doc.titleEn)) updates.titleEn = t.en.title;
    if (empty(doc.titleBar)) updates.titleBar = t.bar.title;
    if (Object.keys(updates).length === 0) continue;
    console.log(`Dokument "${doc.title}" (${doc.id}): ${Object.keys(updates).join(', ')}`);
    if (!dryRun) await db.update(schema.eventDocuments).set(updates).where(eq(schema.eventDocuments.id, doc.id));
    done++;
  }

  // Karriere-Inhalte (JSON im settings-Table, Key 'career_content'). Nur bei
  // gueltigem JSON verarbeiten, damit kein Fallback den Bestand ueberschreibt.
  const [careerRow] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'career_content'));
  if (careerRow?.value && done < limit) {
    try {
      const content = validateCareerContent(JSON.parse(careerRow.value));
      const filled = await fillCareerTranslations(content);
      if (JSON.stringify(filled) !== JSON.stringify(content)) {
        console.log('Karriere: leere EN/Bar-Felder gefuellt.');
        if (!dryRun) await db.update(schema.settings).set({ value: JSON.stringify(filled) }).where(eq(schema.settings.key, 'career_content'));
        done++;
      }
    } catch (e) {
      console.warn('Karriere-Inhalte nicht parsebar — uebersprungen.', e);
    }
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}Fertig: ${done} Datensätze ${dryRun ? 'würden' : 'wurden'} übersetzt.`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });