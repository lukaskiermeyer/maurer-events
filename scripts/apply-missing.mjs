import fs from 'node:fs';
import crypto from 'node:crypto';
import postgres from 'postgres';

const folder = 'src/db/migrations';
const journal = JSON.parse(fs.readFileSync(folder + '/meta/_journal.json', 'utf8'));
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });

const tracked = await client`SELECT hash FROM drizzle.__drizzle_migrations`;
const trackedHashes = new Set(tracked.map((r) => r.hash));

// Migrations to apply (0021..0028). 0021 schema already present (fest_opportunities), just track.
const toApply = journal.entries.filter((e) => {
  const num = parseInt(e.tag.slice(0, 4), 10);
  return num >= 21 && num <= 28;
});

for (const entry of toApply) {
  const sqlPath = folder + '/' + entry.tag + '.sql';
  const raw = fs.readFileSync(sqlPath, 'utf8');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  // Apply SQL unless already tracked
  if (!trackedHashes.has(hash)) {
    console.log('Applying', entry.tag);
    const statements = raw.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await client.unsafe(stmt);
      } catch (e) {
        // Allow "already exists" for idempotency
        if (e.code === '42P07' || e.code === '42710' || e.code === '42P06') {
          console.log('  skip (already exists):', e.message.slice(0, 80));
        } else {
          throw e;
        }
      }
    }
  } else {
    console.log('Already tracked, skipping apply:', entry.tag);
  }

  // Track if not tracked
  if (!trackedHashes.has(hash)) {
    await client`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
    trackedHashes.add(hash);
    console.log('  tracked', entry.tag);
  }
}

console.log('Done.');
await client.end({ timeout: 5 });
