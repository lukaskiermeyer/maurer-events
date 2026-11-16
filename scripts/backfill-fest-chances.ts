import crypto from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

function normalizeUrl(raw: string): string {
  let url = raw.trim().toLowerCase();
  url = url.split('#')[0];
  url = url.split('?')[0];
  url = url.replace(/\/+$/, '');
  return url;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toDateOnly(value: Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const client = postgres(url, { max: 4, connect_timeout: 10 });
  const db = drizzle(client, { schema });

  const legacy = await db.select().from(schema.festOpportunities);
  let inserted = 0;
  let existing = 0;
  for (const row of legacy) {
    const normalized = row.sourceUrlNormalized?.trim() || normalizeUrl(row.sourceUrl);
    const hash = sha256Hex(normalized);
    const found = await db.select().from(schema.festChances).where(
      eq(schema.festChances.urlHash, hash),
    ).limit(1);
    if (found.length > 0) {
      existing++;
      continue;
    }
    if (dryRun) {
      inserted++;
      continue;
    }
    await db.insert(schema.festChances).values({
      urlHash: hash,
      sourceUrl: row.sourceUrl,
      sourceUrlNormalized: normalized,
      title: row.title,
      organizer: row.organizer,
      location: row.location,
      region: row.region,
      eventDate: toDateOnly(row.eventDate),
      monthsAhead: row.monthsAhead,
      jubileeYears: row.jubileeYears,
      festwirtStatus: row.festwirtStatus ?? 'unknown',
      eventType: 'other',
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      emergency: false,
      score: row.score ?? 0,
      scoreReason: row.scoreReason,
      nimModel: null,
      runId: row.n8nRunId,
      status: row.status ?? 'new',
      notes: row.notes ?? null,
      discoveredAt: row.discoveredAt ?? new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inserted++;
  }
  console.log(JSON.stringify({ dryRun, total: legacy.length, inserted, existing }, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});