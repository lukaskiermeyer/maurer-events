import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

async function main() {
const admin = postgres('postgres://reservation_test@127.0.0.1:55439/postgres', { max: 1, connect_timeout: 5 });
const databaseName = `fest_mig_collision_${randomUUID().replaceAll('-', '')}`;
await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
const url = `postgres://reservation_test@127.0.0.1:55439/${databaseName}`;
const client = postgres(url, { max: 4, connect_timeout: 5 });

try {
  const journal = JSON.parse(await readFile('src/db/migrations/meta/_journal.json', 'utf8'));
  for (const entry of journal.entries) {
    if (entry.tag === '0027_fest_opportunities_url_hash') break;
    const migration = await readFile(`src/db/migrations/${entry.tag}.sql`, 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement);
  }

  await client`INSERT INTO public.fest_opportunities (source_url, source_url_normalized, title, score, status, updated_at, discovered_at)
    VALUES ('https://example.com/coll?utm=x','https://example.com/coll','Coll X',50,'new',now(),now())`;
  await client`INSERT INTO public.fest_opportunities (source_url, source_url_normalized, title, score, status, updated_at, discovered_at)
    VALUES ('https://example.com/coll?utm=y','https://example.com/coll','Coll Y',90,'new',now() + interval '1 hour',now())`;
  await client`INSERT INTO public.fest_opportunities (source_url, source_url_normalized, title, score, status)
    VALUES ('https://example.com/other','https://example.com/other','Other',10,'new')`;

  const mig = await readFile('src/db/migrations/0027_fest_opportunities_url_hash.sql', 'utf8');
  for (const statement of mig.split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement);

  const [{ c: rows }] = await client`SELECT count(*)::int AS c FROM public.fest_opportunities`;
  assert.equal(rows, 2, 'Bestand nach Dedupe: 2 Zeilen');
  const [{ c: logRows }] = await client`SELECT count(*)::int AS c FROM public.fest_opportunities_dedupe_log`;
  assert.equal(logRows, 1, '1 Verlierer im Log');
  const dup = await client`SELECT url_hash FROM public.fest_opportunities GROUP BY url_hash HAVING count(*) > 1`;
  assert.equal(dup.length, 0, 'keine Duplikate');
  const [{ c: nulls }] = await client`SELECT count(*)::int AS c FROM public.fest_opportunities WHERE url_hash IS NULL`;
  assert.equal(nulls, 0, 'keine NULL url_hash');
  const winner = await client`SELECT title, score FROM public.fest_opportunities WHERE source_url_normalized='https://example.com/coll'`;
  assert.equal(winner[0].title, 'Coll Y');
  assert.equal(winner[0].score, 90);

  // down
  const down = await readFile('src/db/migrations/0027_fest_opportunities_url_hash_down.sql', 'utf8');
  for (const statement of down.split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement);
  const [{ c: col }] = await client`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='fest_opportunities' AND column_name='url_hash'`;
  assert.equal(col, 0, 'down entfernt url_hash');

  console.log('PASS fest-migration-collision-test');
} finally {
  await client.end();
  await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
}
}
main().catch((e) => { console.error(e); process.exit(1); });