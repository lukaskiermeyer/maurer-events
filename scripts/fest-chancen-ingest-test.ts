import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, after, before } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';

process.env.FEST_CHANCEN_INGEST_TOKEN = 'test-ingest-token-12345';
process.env.AUTH_SECRET = 'test-auth-secret-long-enough-1234567890';

const databaseName = `fest_chancen_${randomUUID().replaceAll('-', '')}`;
const admin = postgres('postgres://reservation_test@127.0.0.1:55439/postgres', { max: 1, connect_timeout: 5 });
let client: ReturnType<typeof postgres>;
let connection: ReturnType<typeof drizzle>;
let created = false;

before(async () => {
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  created = true;
  client = postgres(`postgres://reservation_test@127.0.0.1:55439/${databaseName}`, { max: 16, connect_timeout: 5 });
  connection = drizzle(client, { schema });
  process.env.DATABASE_URL = `postgres://reservation_test@127.0.0.1:55439/${databaseName}`;
  const journal = JSON.parse(await readFile('src/db/migrations/meta/_journal.json', 'utf8'));
  for (const entry of journal.entries) {
    const migration = await readFile(`src/db/migrations/${entry.tag}.sql`, 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement);
  }
});

after(async () => {
  if (client) await client.end();
  if (created) await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
});

// Import route after DATABASE_URL set
async function loadRoute() {
  const mod = await import('../src/app/api/admin/fest-chancen/ingest/route');
  return mod;
}

function req(body: unknown, token?: string, method = 'POST') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== undefined) headers['authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/admin/fest-chancen/ingest', {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}

test('1. leeres Array -> 200, inserted 0', async () => {
  const { POST } = await loadRoute();
  const res = await POST(req([], 'test-ingest-token-12345'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.inserted, 0);
  assert.equal(json.updated, 0);
  assert.equal(json.skipped, 0);
  assert.equal(json.received, 0);
});

test('2. neues Element -> 200, inserted 1, Datensatz in DB', async () => {
  const { POST } = await loadRoute();
  const payload = [{
    sourceUrl: 'https://example.com/fest1',
    title: 'Jubiläum',
    score: 80,
    runId: 'run-1',
  }];
  const res = await POST(req(payload, 'test-ingest-token-12345'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.inserted, 1);
  const rows = await connection.select().from(schema.festChances);
  assert.ok(rows.length >= 1);
  const row = rows.find((r) => r.sourceUrl === 'https://example.com/fest1');
  assert.ok(row);
  assert.equal(row?.title, 'Jubiläum');
  assert.equal(row?.score, 80);
  assert.equal(row?.status, 'new');
});

test('3. identisches Element zweimal -> zweiter Lauf updated 1, inserted 0, Gesamtzahl bleibt 1 (für diese URL)', async () => {
  const { POST } = await loadRoute();
  const payload = [{ sourceUrl: 'https://example.com/fest2', title: 'Fest2', score: 70 }];
  const r1 = await POST(req(payload, 'test-ingest-token-12345'));
  assert.equal((await r1.json()).inserted, 1);
  const r2 = await POST(req(payload, 'test-ingest-token-12345'));
  const j2 = await r2.json();
  assert.equal(j2.updated, 1);
  assert.equal(j2.inserted, 0);
  const rows = await connection.select().from(schema.festChances).where(eq(schema.festChances.sourceUrl, 'https://example.com/fest2'));
  assert.equal(rows.length, 1);
});

test('4. Element mit status contacted in DB, erneuter Ingest -> status bleibt contacted, score aktualisiert', async () => {
  const { POST } = await loadRoute();
  // insert contacted row manually
  const url = 'https://example.com/fest3';
  const normalized = url.toLowerCase();
  const hash = (await import('node:crypto')).createHash('sha256').update(normalized).digest('hex');
  await connection.insert(schema.festChances).values({
    urlHash: hash,
    sourceUrl: url,
    sourceUrlNormalized: normalized,
    title: 'Fest3',
    score: 50,
    status: 'contacted',
    notes: 'manuell',
  });
  const payload = [{ sourceUrl: url, title: 'Fest3', score: 90 }];
  const res = await POST(req(payload, 'test-ingest-token-12345'));
  const json = await res.json();
  assert.equal(json.updated, 1);
  const [row] = await connection.select().from(schema.festChances).where(eq(schema.festChances.urlHash, hash));
  assert.equal(row.status, 'contacted');
  assert.equal(row.score, 90);
  assert.equal(row.notes, 'manuell');
});

test('5. fehlender Token -> 401 JSON', async () => {
  const { POST } = await loadRoute();
  const res = await POST(req([], undefined));
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
});

test('6. falscher Token -> 401 JSON', async () => {
  const { POST } = await loadRoute();
  const res = await POST(req([], 'wrong-token'));
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.ok, false);
});

test('7. sourceUrl fehlt -> 400 mit Index-Angabe', async () => {
  const { POST } = await loadRoute();
  const res = await POST(req([{ title: 'ohne url' }], 'test-ingest-token-12345'));
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.ok(Array.isArray(json.errors));
  assert.equal(json.errors[0].index, 0);
});

test('8. festwirtStatus fantasie -> 400', async () => {
  const { POST } = await loadRoute();
  const res = await POST(req([{ sourceUrl: 'https://example.com/x', festwirtStatus: 'fantasie' }], 'test-ingest-token-12345'));
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.ok, false);
});

test('9. GET auf ingest -> 405 JSON', async () => {
  const { GET } = await loadRoute();
  const res = await GET(new Request('http://localhost/api/admin/fest-chancen/ingest', { method: 'GET' }));
  assert.equal(res.status, 405);
  const json = await res.json();
  assert.equal(json.ok, false);
});

test('10. unbekannte /api-Pfad -> 404 JSON, nicht HTML', async () => {
  const mod = await import('../src/app/api/[...notfound]/route');
  const res = await mod.GET(new Request('http://localhost/api/does-not-exist'));
  assert.equal(res.status, 404);
  const text = await res.text();
  assert.ok(!text.includes('.astro-icon'));
  const json = JSON.parse(text);
  assert.equal(json.ok, false);
  assert.equal(json.error, 'not_found');
});

test('11. status/notes bleiben in beiden Tabellen unverändert', async () => {
  const { POST } = await loadRoute();
  const url = 'https://example.com/status-notes-both';
  const normalized = url.toLowerCase();
  const hash = (await import('node:crypto')).createHash('sha256').update(normalized).digest('hex');
  await connection.insert(schema.festChances).values({
    urlHash: hash,
    sourceUrl: url,
    sourceUrlNormalized: normalized,
    title: 'X',
    score: 50,
    status: 'contacted',
    notes: 'manuell',
  });
  await connection.insert(schema.festOpportunities).values({
    sourceUrl: url,
    sourceUrlNormalized: normalized,
    urlHash: hash,
    title: 'X',
    score: 50,
    status: 'contacted',
    notes: 'manuell',
  });
  const res = await POST(req([{ sourceUrl: url, title: 'X', score: 90 }], 'test-ingest-token-12345'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.updated, 1);
  const [c] = await connection.select().from(schema.festChances).where(eq(schema.festChances.urlHash, hash));
  assert.equal(c.status, 'contacted');
  assert.equal(c.notes, 'manuell');
  assert.equal(c.score, 90);
  const [o] = await connection.select().from(schema.festOpportunities).where(eq(schema.festOpportunities.urlHash, hash));
  assert.equal(o.status, 'contacted');
  assert.equal(o.notes, 'manuell');
  assert.equal(o.score, 90);
});

test('12. gleiche sourceUrl mit ?utm=x und ?utm=y -> genau ein Datensatz in beiden Tabellen', async () => {
  const { POST } = await loadRoute();
  const base = 'https://example.com/utm-dedupe';
  const r1 = await POST(req([{ sourceUrl: base + '?utm=x', title: 'UTM', score: 10 }], 'test-ingest-token-12345'));
  assert.equal((await r1.json()).inserted, 1);
  const r2 = await POST(req([{ sourceUrl: base + '?utm=y', title: 'UTM', score: 20 }], 'test-ingest-token-12345'));
  const j2 = await r2.json();
  assert.equal(j2.updated, 1);
  assert.equal(j2.inserted, 0);
  const normalized = base.toLowerCase();
  const hash = (await import('node:crypto')).createHash('sha256').update(normalized).digest('hex');
  const c = await connection.select().from(schema.festChances).where(eq(schema.festChances.urlHash, hash));
  assert.equal(c.length, 1);
  const o = await connection.select().from(schema.festOpportunities).where(eq(schema.festOpportunities.urlHash, hash));
  assert.equal(o.length, 1);
});

test('13. Batch 1 valid + 1 invalid -> inserted 1, skipped 1, HTTP 200', async () => {
  const { POST } = await loadRoute();
  const res = await POST(req([
    { sourceUrl: 'https://example.com/batch-valid', title: 'valid', score: 80 },
    { title: 'invalid' },
  ], 'test-ingest-token-12345'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.inserted, 1);
  assert.equal(json.skipped, 1);
});

test('14. erster Lauf inserted=N updated=0, zweiter identischer Lauf inserted=0 updated=N', async () => {
  const { POST } = await loadRoute();
  const payload = [
    { sourceUrl: 'https://example.com/batch-a', title: 'A', score: 10 },
    { sourceUrl: 'https://example.com/batch-b', title: 'B', score: 20 },
  ];
  const r1 = await POST(req(payload, 'test-ingest-token-12345'));
  const j1 = await r1.json();
  assert.equal(j1.inserted, 2);
  assert.equal(j1.updated, 0);
  const r2 = await POST(req(payload, 'test-ingest-token-12345'));
  const j2 = await r2.json();
  assert.equal(j2.inserted, 0);
  assert.equal(j2.updated, 2);
});

test('15. Migration 0026 auf leerer DB anwendbar und rückrollbar', async () => {
  const dbName = `fest_chances_mig_${(await import('node:crypto')).randomUUID().replaceAll('-', '')}`;
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  const client = postgres(`postgres://reservation_test@127.0.0.1:55439/${dbName}`, { max: 4, connect_timeout: 5 });
  try {
    const migration = await readFile('src/db/migrations/0026_fest_chances.sql', 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement);
    const [exists] = await client`SELECT to_regclass('public.fest_chances') AS t`;
    assert.ok(exists.t, 'fest_chances sollte existieren');
    await client.unsafe('DROP TABLE IF EXISTS public.fest_chances');
    const [gone] = await client`SELECT to_regclass('public.fest_chances') AS t`;
    assert.equal(gone.t, null);
  } finally {
    await client.end();
    await admin.unsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  }
});