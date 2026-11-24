// Keine Env-Dateien, Live-Datenbanken oder externen Dienste. Die Suite erzeugt
// ausschließlich eine zufällig benannte Testdatenbank auf 127.0.0.1:55439.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import type { db as appDb } from '../src/db';
import { csvCell } from '../src/lib/csv';
import { sniffMime } from '../src/lib/file-types';
import { boundedBody, boundedJson } from '../src/lib/request-body';
import { BookingError } from '../src/lib/reservation-policy';
import { safeStaffMember } from '../src/lib/staff-privacy';
import { hmacSha256, hashToken } from '../src/lib/admin-crypto';

const TEST_SECRET = 'security-regression-test-secret-0123456789abcdef';
const databaseName = `security_regression_${randomUUID().replaceAll('-', '')}`;
const admin = postgres('postgres://reservation_test@127.0.0.1:55439/postgres', { max: 1, connect_timeout: 5 });
const databaseUrl = `postgres://reservation_test@127.0.0.1:55439/${databaseName}`;
let client: ReturnType<typeof postgres>;
let appClient: ReturnType<typeof postgres> | undefined;
let connection: typeof appDb;
let created = false;
let consumeRecoveryCode: typeof import('../src/lib/admin-recovery').consumeRecoveryCode;
let consumeRecoveryCodeForAdmin: typeof import('../src/lib/admin-mfa').consumeRecoveryCodeForAdmin;
let updateLastStep: typeof import('../src/lib/admin-mfa').updateLastStep;
let createTrustedDevice: typeof import('../src/lib/admin-mfa').createTrustedDevice;
let findTrustedDevice: typeof import('../src/lib/admin-mfa').findTrustedDevice;
let createAdminSession: typeof import('../src/lib/admin-session').createAdminSession;
let getAdminSession: typeof import('../src/lib/admin-session').getAdminSession;
let revokeAdminSession: typeof import('../src/lib/admin-session').revokeAdminSession;
let revokeAllAdminSessions: typeof import('../src/lib/admin-session').revokeAllAdminSessions;
let createEnrollmentToken: typeof import('../src/lib/admin-enrollment').createEnrollmentToken;
let consumeEnrollmentToken: typeof import('../src/lib/admin-enrollment').consumeEnrollmentToken;
let validateEnrollmentToken: typeof import('../src/lib/admin-enrollment').validateEnrollmentToken;
let hashRecoveryCodeLegacy: typeof import('../src/lib/totp').hashRecoveryCodeLegacy;

before(async () => {
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  created = true;
  client = postgres(databaseUrl, { max: 16, connect_timeout: 5 });
  connection = drizzle(client, { schema }) as unknown as typeof appDb;
  const journal = JSON.parse(await readFile('src/db/migrations/meta/_journal.json', 'utf8'));
  for (const entry of journal.entries) {
    const migration = await readFile(`src/db/migrations/${entry.tag}.sql`, 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await client.unsafe(statement);
    }
  }

  process.env.DATABASE_URL = databaseUrl;
  process.env.AUTH_SECRET = TEST_SECRET;
  process.env.AUTH_PEPPER = TEST_SECRET;
  process.env.STAFF_DATA_KEY = 'security-regression-staff-key-0123456789';
  appClient = (await import('../src/db')).db.$client;
  ({ consumeRecoveryCode } = await import('../src/lib/admin-recovery'));
  ({ consumeRecoveryCodeForAdmin, updateLastStep, createTrustedDevice, findTrustedDevice } = await import('../src/lib/admin-mfa'));
  ({ createAdminSession, getAdminSession, revokeAdminSession, revokeAllAdminSessions } = await import('../src/lib/admin-session'));
  ({ createEnrollmentToken, consumeEnrollmentToken, validateEnrollmentToken } = await import('../src/lib/admin-enrollment'));
  ({ hashRecoveryCodeLegacy } = await import('../src/lib/totp'));
});

after(async () => {
  if (appClient) await appClient.end();
  if (client) await client.end();
  if (created) await admin.unsafe(`DROP DATABASE "${databaseName}"`);
  await admin.end();
});

async function adminFixture() {
  const email = `${randomUUID()}@security-regression.test`;
  const [row] = await connection.insert(schema.adminUsers).values({
    email,
    emailNormalized: email,
    role: 'owner',
    status: 'active',
    createdBy: 'security-regression-test',
  }).returning();
  return row;
}

function hasStatus(status: number) {
  return (error: unknown) => error instanceof BookingError && error.status === status;
}

function streamedRequest(chunks: string[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Request('http://security-regression.test', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

test('CSV-Zellen neutralisieren Formeln und escapen Trennzeichen', () => {
  for (const payload of ['=1+1', '+CMD', '-2+3', '@SUM(A1:A2)', '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1']) {
    const cell = csvCell(payload);
    const decoded = cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell;
    assert.ok(decoded.startsWith("'"), `Formel nicht neutralisiert: ${JSON.stringify(payload)}`);
  }
  assert.equal(csvCell('normaler Text'), 'normaler Text');
  assert.equal(csvCell('a,"b'), '"a,""b"');
  assert.equal(csvCell('a;b', ';'), '"a;b"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(['a', 'b']), 'a|b');
});

test('Mitarbeiter-Redaction entfernt Credentials und verschluesselte Lohndaten', () => {
  const member = {
    id: randomUUID(),
    firstName: 'Test',
    passwordHash: 'scrypt$secret',
    taxIdEnc: 'cipher-tax',
    socialSecurityEnc: 'cipher-social',
    ibanEnc: 'cipher-iban',
  } as unknown as typeof schema.staff.$inferSelect;
  const safe = safeStaffMember(member);
  for (const key of ['passwordHash', 'taxIdEnc', 'socialSecurityEnc', 'ibanEnc']) {
    assert.equal(key in safe, false, `${key} wurde serialisiert`);
  }
  assert.deepEqual([safe.hasTaxId, safe.hasSocialSecurity, safe.hasIban], [true, true, true]);
  assert.equal(JSON.stringify(safe).includes('cipher-'), false);
  const empty = safeStaffMember({ ...member, taxIdEnc: null, socialSecurityEnc: null, ibanEnc: null });
  assert.deepEqual([empty.hasTaxId, empty.hasSocialSecurity, empty.hasIban], [false, false, false]);
});

test('Dateisignaturen erkennen PDF, JPEG, PNG und WebP exakt', () => {
  const fixtures: Array<[Buffer, string]> = [
    [Buffer.from('%PDF-1.7\n'), 'application/pdf'],
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), 'image/jpeg'],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), 'image/png'],
    [Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]), 'image/webp'],
  ];
  for (const [bytes, expected] of fixtures) {
    assert.equal(sniffMime(bytes), expected);
    for (const [, other] of fixtures.filter(([, mime]) => mime !== expected)) assert.notEqual(sniffMime(bytes), other);
  }
  assert.equal(sniffMime(Buffer.from('<html>not an upload</html>')), null);
  assert.equal(sniffMime(Buffer.from('%PD')), null);
});

test('Request-Limits akzeptieren gueltiges JSON und blockieren defekte oder grosse Bodies', async () => {
  const valid = new Request('http://security-regression.test', { method: 'POST', body: '{"ok":true}' });
  assert.deepEqual(await boundedJson(valid), { ok: true });
  const malformed = new Request('http://security-regression.test', { method: 'POST', body: '{"ok":' });
  await assert.rejects(boundedJson(malformed), hasStatus(400));
  const declared = new Request('http://security-regression.test', {
    method: 'POST',
    headers: { 'content-length': '1000' },
    body: '"too large"',
  });
  await assert.rejects(boundedJson(declared, 16), hasStatus(413));
  await assert.rejects(boundedBody(streamedRequest(['123', '456']), 5), hasStatus(413));
  assert.equal(await boundedBody(streamedRequest(['123', '456']), 6), '123456');
});

test('Recovery-Codes sind bei 20 parallelen Versuchen genau einmal gueltig', async () => {
  const adminRow = await adminFixture();
  const code = '01234-56789';
  await connection.insert(schema.adminRecoveryCodes).values({
    adminId: adminRow.id,
    batchId: randomUUID(),
    codeHash: hmacSha256(TEST_SECRET, '0123456789'),
  });
  const results = await Promise.all(Array.from({ length: 20 }, () => consumeRecoveryCode(adminRow.id, code)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await consumeRecoveryCode(adminRow.id, code), false);
});

test('Legacy-Recovery-Codes sind ebenfalls atomar und genau einmal gueltig', async () => {
  const adminRow = await adminFixture();
  const code = 'ABCDE-FGHIJ';
  await connection.insert(schema.adminRecoveryCodes).values({
    adminId: adminRow.id,
    batchId: randomUUID(),
    codeHash: hashRecoveryCodeLegacy(code),
  });
  const results = await Promise.all(Array.from({ length: 20 }, () => consumeRecoveryCodeForAdmin(adminRow.id, code)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await consumeRecoveryCodeForAdmin(adminRow.id, code), false);
});

test('TOTP-Zeitschritte akzeptieren nur einen parallelen Gewinner und keinen Ruecksprung', async () => {
  const adminRow = await adminFixture();
  const results = await Promise.all(Array.from({ length: 20 }, () => updateLastStep(adminRow.id, 100)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await updateLastStep(adminRow.id, 99), false);
  assert.equal(await updateLastStep(adminRow.id, 100), false);
  assert.equal(await updateLastStep(adminRow.id, 101), true);
});

test('Einrichtungstokens sind atomar und nach Verbrauch ungueltig', async () => {
  const adminRow = await adminFixture();
  const token = await createEnrollmentToken({ adminId: adminRow.id, purpose: 'invite', createdVia: 'ui' });
  assert.equal((await validateEnrollmentToken({ rawToken: token.rawToken, pin: token.pin })).ok, true);
  const results = await Promise.all(Array.from({ length: 20 }, () => consumeEnrollmentToken(token.tokenId)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await consumeEnrollmentToken(token.tokenId), false);
  assert.equal((await validateEnrollmentToken({ rawToken: token.rawToken, pin: token.pin })).ok, false);
});

test('Passwort-Reset-Verbrauch entwertet auch andere offene Tokens', async () => {
  const adminRow = await adminFixture();
  const invite = await createEnrollmentToken({ adminId: adminRow.id, purpose: 'invite', createdVia: 'ui' });
  const reset = await createEnrollmentToken({ adminId: adminRow.id, purpose: 'password_reset', createdVia: 'ui' });
  const results = await Promise.all(Array.from({ length: 20 }, () => consumeEnrollmentToken(reset.tokenId)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await validateEnrollmentToken({ rawToken: reset.rawToken })).ok, false);
  assert.equal((await validateEnrollmentToken({ rawToken: invite.rawToken, pin: invite.pin })).ok, false);
});

const trustedDeviceCtx = { ip: '203.0.113.27', userAgent: 'security-regression-browser' };

test('Session-Widerruf entwertet nur das zugeordnete Trusted Device', async () => {
  const adminRow = await adminFixture();
  const otherAdmin = await adminFixture();
  const session = await createAdminSession({ adminId: adminRow.id });
  const otherSession = await createAdminSession({ adminId: otherAdmin.id });
  const raw = await createTrustedDevice(adminRow.email, trustedDeviceCtx, session.token);
  const otherRaw = await createTrustedDevice(otherAdmin.email, trustedDeviceCtx, otherSession.token);

  await revokeAdminSession(session.token, 'security_regression');

  assert.equal(await getAdminSession(session.token), null);
  assert.equal(await findTrustedDevice(raw, adminRow.email, trustedDeviceCtx), null);
  assert.ok(await findTrustedDevice(otherRaw, otherAdmin.email, trustedDeviceCtx));
  assert.ok(await getAdminSession(otherSession.token));
});

test('Globaler Session-Widerruf entwertet alle Trusted Devices dieses Admins', async () => {
  const adminRow = await adminFixture();
  const otherAdmin = await adminFixture();
  const sessions = await Promise.all([
    createAdminSession({ adminId: adminRow.id }),
    createAdminSession({ adminId: adminRow.id }),
  ]);
  const otherSession = await createAdminSession({ adminId: otherAdmin.id });
  const rawTokens = await Promise.all(sessions.map(session => createTrustedDevice(adminRow.email, trustedDeviceCtx, session.token)));
  const otherRaw = await createTrustedDevice(otherAdmin.email, trustedDeviceCtx, otherSession.token);

  await revokeAllAdminSessions(adminRow.id, 'security_regression');

  for (const session of sessions) assert.equal(await getAdminSession(session.token), null);
  for (const raw of rawTokens) assert.equal(await findTrustedDevice(raw, adminRow.email, trustedDeviceCtx), null);
  assert.ok(await findTrustedDevice(otherRaw, otherAdmin.email, trustedDeviceCtx));
  assert.ok(await getAdminSession(otherSession.token));
});

test('Natürlicher Session-Ablauf lässt das Trusted Device bis zu seinem eigenen Ablauf gültig', async () => {
  const adminRow = await adminFixture();
  const session = await createAdminSession({ adminId: adminRow.id });
  const raw = await createTrustedDevice(adminRow.email, trustedDeviceCtx, session.token);
  await connection.update(schema.adminPasskeySessions)
    .set({ idleExpiresAt: new Date(0) })
    .where(eq(schema.adminPasskeySessions.tokenHash, hashToken(session.token)));

  assert.equal(await getAdminSession(session.token), null);
  assert.ok(await findTrustedDevice(raw, adminRow.email, trustedDeviceCtx));
});

test('API-Logout löscht Session, MFA-Fenster und Trusted-Device-Cookie', async () => {
  const source = await readFile('src/app/api/admin/auth/logout/route.ts', 'utf8');
  for (const cookie of ['__Host-adm_session', '__Host-adm_mfa', '__Host-adm_trusted']) {
    assert.ok(source.includes(`cookieStore.delete('${cookie}');`), `${cookie} wird nicht gelöscht`);
  }
});
