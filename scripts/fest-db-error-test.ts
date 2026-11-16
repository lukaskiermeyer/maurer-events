import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

async function main() {
  const admin = postgres('postgres://reservation_test@127.0.0.1:55439/postgres', { max: 1, connect_timeout: 5 });
  const databaseName = `fest_dberr_${randomUUID().replaceAll('-', '')}`;
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  const url = `postgres://reservation_test@127.0.0.1:55439/${databaseName}`;
  const client = postgres(url, { max: 4, connect_timeout: 5 });
  process.env.DATABASE_URL = url;
  process.env.FEST_CHANCEN_INGEST_TOKEN = 'test-ingest-token-12345';
  process.env.AUTH_SECRET = 'test-auth-secret-long-enough-1234567890';

  try {
    const journal = JSON.parse(await readFile('src/db/migrations/meta/_journal.json', 'utf8'));
    for (const entry of journal.entries) {
      const migration = await readFile(`src/db/migrations/${entry.tag}.sql`, 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement);
    }
    const mod = await import('../src/app/api/admin/fest-chancen/ingest/route');
    const res = await mod.POST(new Request('http://localhost/api/admin/fest-chancen/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-ingest-token-12345' },
      body: JSON.stringify([
        { sourceUrl: 'https://example.com/dberr-valid', title: 'valid', score: 80 },
        { sourceUrl: 'https://example.com/dberr-invalid', title: 'invalid', score: 70, eventDate: '9999-99-99' },
      ]),
    }));
    assert.equal(res.status, 200, 'HTTP 200');
    const json = await res.json();
    assert.equal(json.inserted, 1, 'inserted 1');
    assert.equal(json.skipped, 1, 'skipped 1');
    console.log('PASS fest-db-error-test', JSON.stringify(json));
  } finally {
    await client.end();
    await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });