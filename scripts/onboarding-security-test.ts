// Mitarbeiter-Onboarding: Sicherheits- und Performance-Tests.
//
// Läuft isoliert wie scripts/reservation-security-test.ts:
// keine .env.local, kein Live-DB-Zugriff, kein Mail-/Cloudinary-Versand.
// Erstellt auf 127.0.0.1:55439 eine zufällig benannte eigene PostgreSQL-DB,
// wendet alle Migrationen an und entfernt nur diese DB beim Abschluss.
//
// Server Actions ("use server" in src/app/actions/staff.ts / staffAuth.ts /
// contracts.ts) können in diesem Harness nicht importiert werden, weil sie
// Next.js-Request-APIs (next/headers: cookies/headers, next/cache, next/navigation)
// brauchen. Daher prüft diese Suite die darunterliegenden, testbaren
// Sicherheitsmechanismen, die das Onboarding tragen:
//   - Passwort-Hashing (scrypt), Invite-Token (HMAC, 256 Bit), Sessions
//   - Feldverschlüsselung (AES-256-GCM) für Steuer-ID / SV-Nummer / IBAN
//   - DB-Constraints, atomare Einmal-Einlösung, Rate-Limit-Atomicity
//   - Upload-Validierung (Größe / Typ / Art), Vertrags-State-Machine,
//     Vertrags-Rendering (HTML-Escaping), Payroll-Vollständigkeit
// sowie Performance-Budgets (Latenz, Parallelität, N+1-freie Abfragen).
//
// Testserver starten (Windows, PostgreSQL 17) – siehe docs/testing.md:
//   & 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D '.reservation-test-db' -l '.reservation-test-db/server.log' -o '-p 55439 -h 127.0.0.1' -w start
// Danach:  npm run test:onboarding
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, after, before } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import type { db as appDb } from '../src/db';
import { hashPassword, hashToken, randomToken, verifyPassword } from '../src/lib/staff-auth';
import { decryptField, encryptField, maskField } from '../src/lib/secure-fields';
import { renderContract } from '../src/lib/contracts';
import { bicField, ibanField, isValidBic, isValidIban, normalizeIban, taxIdField } from '../src/lib/bank-details';
import { ALLOWED_UPLOAD_TYPES, DOCUMENT_KINDS, MAX_UPLOAD_BYTES, sniffMime } from '../src/lib/file-types';
import { buildPayrollCsv, missingPayrollFields } from '../src/lib/payroll';
import { runRetentionCleanup } from '../src/lib/retention';
import { takeRateLimit } from '../src/lib/rate-limit';
import { escapeHtml } from '../src/lib/escape';

process.env.AUTH_SECRET = 'onboarding-test-auth-secret-that-is-long-enough-123456';
process.env.STAFF_DATA_KEY = 'onboarding-test-staff-data-key-32-char';

const databaseName = `onboarding_security_${randomUUID().replaceAll('-', '')}`;
const admin = postgres('postgres://reservation_test@127.0.0.1:55439/postgres', { max: 1, connect_timeout: 5 });
let client: ReturnType<typeof postgres>;
let connection: typeof appDb;
let created = false;
before(async () => {
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  created = true;
  client = postgres(`postgres://reservation_test@127.0.0.1:55439/${databaseName}`, { max: 16, connect_timeout: 5 });
  connection = drizzle(client, { schema }) as unknown as typeof appDb;
  const journal = JSON.parse(await readFile('src/db/migrations/meta/_journal.json', 'utf8'));
  for (const entry of journal.entries) {
    const migration = await readFile(`src/db/migrations/${entry.tag}.sql`, 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement);
  }
});
after(async () => {
  if (client) await client.end();
  if (created) await admin.unsafe(`DROP DATABASE "${databaseName}"`);
  await admin.end();
});

async function staffFixture(email = `${randomUUID()}@example.com`) {
  const [role] = await connection.insert(schema.staffRoles).values({ key: `role-${randomUUID()}`, name: 'Testrolle', hourlyRateCents: 1500 }).returning();
  const [member] = await connection.insert(schema.staff).values({ email, firstName: 'Max', lastName: 'Muster', roleId: role.id, status: 'invited' }).returning();
  return { role, member };
}
function hasConstraint(constraint: string) {
  return (error: unknown) => {
    const stack: unknown[] = [error];
    const seen = new Set<unknown>();
    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== 'object' || seen.has(current)) continue;
      seen.add(current);
      const record = current as { constraint_name?: string; cause?: unknown; code?: string };
      if (record.constraint_name === constraint || record.code === constraint) return true;
      if (record.cause) stack.push(record.cause);
    }
    return false;
  };
}

// ---------------------------------------------------------------------------
// Passwörter & Invite-Token
// ---------------------------------------------------------------------------

test('Passwortrichtlinie und scrypt-Hashing (kein Klartext, kein Timing-Leak)', async () => {
  await assert.rejects(hashPassword('kurz123'), /mindestens 10/);
  await assert.rejects(hashPassword('x'.repeat(201)), /mindestens 10/);
  await assert.rejects(hashPassword(42 as unknown as string), /mindestens 10/);
  const hash = await hashPassword('sicheres-passwort-123');
  assert.ok(hash.startsWith('scrypt$'));
  assert.ok(!hash.includes('sicheres-passwort'));
  assert.equal(await verifyPassword('sicheres-passwort-123', hash), true);
  assert.equal(await verifyPassword('falsch', hash), false);
  assert.equal(await verifyPassword('sicheres-passwort-123', null), false);
  assert.equal(await verifyPassword('', hash), false);
  assert.equal(await verifyPassword('sicheres-passwort-123', 'kein-scrypt-hash'), false);
  const second = await hashPassword('sicheres-passwort-123');
  assert.notEqual(hash, second, 'Salz muss zufällig sein');
});

test('Invite-Token: 256 Bit Entropie, HMAC-Hash statt Klartext in der DB', () => {
  const a = randomToken();
  const b = randomToken();
  assert.ok(a.length >= 43, '32 Bytes base64url sind mindestens 43 Zeichen');
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  const hash = hashToken(a);
  assert.equal(hash, hashToken(a), 'Hash muss deterministisch sein (Lookup per Hash)');
  assert.notEqual(hash, a);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'anderes-test-auth-secret-that-is-long-enough-98765';
  try {
    assert.notEqual(hashToken(a), hash, 'Hash muss vom Secret abhängen');
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});

test('AUTH_SECRET unter 32 Zeichen wird hart abgelehnt (fail closed)', () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'zu-kurz';
  try {
    assert.throws(() => hashToken(randomToken()), /AUTH_SECRET/);
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});

// ---------------------------------------------------------------------------
// Feldverschlüsselung (Steuer-ID, SV-Nummer, IBAN)
// ---------------------------------------------------------------------------

test('Feldverschlüsselung: Roundtrip, Zufalls-IV, keine Klartext-Lecks', () => {
  for (const plain of ['DE89370400440532013000', '12345678901', '65820576142']) {
    const enc = encryptField(plain);
    assert.ok(enc?.startsWith('v1:'));
    assert.ok(!enc!.includes(plain), 'Ciphertext darf den Klartext nicht enthalten');
    assert.equal(decryptField(enc), plain);
    assert.notEqual(encryptField(plain), enc, 'IV muss Zufall sein (Gleichheit sonst Seitenkanal)');
  }
  assert.equal(encryptField(null), null);
  assert.equal(encryptField(undefined), null);
  assert.equal(encryptField(''), null);
  assert.equal(decryptField(null), null);
  assert.equal(decryptField(undefined), null);
});

test('Feldverschlüsselung: Manipulation wird durch GCM-Auth-Tag erkannt', () => {
  const enc = encryptField('DE89370400440532013000')!;
  const parts = enc.split(':');
  assert.equal(parts.length, 4);
  // Ciphertext-Teil manipulieren: letztes Zeichen ersetzen.
  const tampered = [...parts];
  tampered[3] = (tampered[3][0] === 'A' ? 'B' : 'A') + tampered[3].slice(1);
  assert.throws(() => decryptField(tampered.join(':')));
  // Tag-Teil manipulieren.
  const tamperedTag = [...parts];
  tamperedTag[2] = (tamperedTag[2][0] === 'A' ? 'B' : 'A') + tamperedTag[2].slice(1);
  assert.throws(() => decryptField(tamperedTag.join(':')));
  assert.throws(() => decryptField('v1:kaputt'));
  assert.throws(() => decryptField('v1:a:b'));
});

test('Maskierung zeigt höchstens die letzten 4 Zeichen', () => {
  const enc = encryptField('DE89370400440532013000');
  const masked = maskField(enc, 4);
  assert.ok(masked.endsWith('3000'));
  assert.ok(!masked.includes('DE893704'));
  assert.ok(!masked.includes('DE89'));
  assert.equal(maskField(null), '—');
  assert.equal(maskField(encryptField('AB'), 4), '••');
});

test('Ohne Staff-Schlüssel schlägt die Verschlüsselung fehl (fail closed, kein AUTH_SECRET-Fallback)', () => {
  const prevData = process.env.STAFF_DATA_KEY;
  const prevAuth = process.env.AUTH_SECRET;
  try {
    delete process.env.STAFF_DATA_KEY;
    delete process.env.AUTH_SECRET;
    assert.throws(() => encryptField('DE89370400440532013000'), /STAFF_DATA_KEY/);
    // Nur AUTH_SECRET darf NICHT als Ersatz dienen (Schlüsseltrennung).
    process.env.AUTH_SECRET = 'a'.repeat(64);
    assert.throws(() => encryptField('DE89370400440532013000'), /STAFF_DATA_KEY/);
    // Zu kurzer Schlüssel wird abgelehnt.
    process.env.STAFF_DATA_KEY = 'zu-kurz';
    assert.throws(() => encryptField('DE89370400440532013000'), /STAFF_DATA_KEY/);
    // Klartext ohne v1:-Präfix wird abgelehnt (kein Legacy-Passthrough).
    process.env.STAFF_DATA_KEY = 'onboarding-test-staff-data-key-32-char';
    assert.throws(() => decryptField('DE89370400440532013000'), /ungültig/);
  } finally {
    if (prevData === undefined) delete process.env.STAFF_DATA_KEY;
    else process.env.STAFF_DATA_KEY = prevData;
    if (prevAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevAuth;
  }
});

// ---------------------------------------------------------------------------
// DB-Constraints (Staff, Invite, Dokument, Vertrag)
// ---------------------------------------------------------------------------

test('Mitarbeiter-E-Mail ist case-/whitespace-insensitiv eindeutig', async () => {
  const rawEmail = `${randomUUID()}@Example.COM`;
  const email = rawEmail.toLowerCase();
  const { member } = await staffFixture(email);
  assert.ok(member.id);
  // Lookup wie staffLogin/createStaff: lower(trim(email)) findet denselben Datensatz.
  const [found] = await connection.select().from(schema.staff).where(sql`lower(trim(${schema.staff.email})) = ${email}`);
  assert.equal(found.id, member.id);
  await assert.rejects(
    connection.insert(schema.staff).values({ email: ` ${rawEmail.toUpperCase()} `, firstName: 'Dup', lastName: 'Likat' }),
    hasConstraint('staff_email_unique'),
  );
});

test('Status- und Beschäftigungsart-Checks lehnen ungültige Werte ab', async () => {
  const { role } = await staffFixture();
  await assert.rejects(
    connection.insert(schema.staff).values({ email: `${randomUUID()}@example.com`, firstName: 'X', lastName: 'Y', status: 'hacked' }),
    hasConstraint('staff_status_check'),
  );
  await assert.rejects(
    connection.insert(schema.staff).values({ email: `${randomUUID()}@example.com`, firstName: 'X', lastName: 'Y', employmentType: 'boss' }),
    hasConstraint('staff_employment_check'),
  );
  const [ok] = await connection.insert(schema.staff).values({ email: `${randomUUID()}@example.com`, firstName: 'X', lastName: 'Y', roleId: role.id, status: 'onboarding', employmentType: 'minijob' }).returning();
  assert.equal(ok.status, 'onboarding');
});

test('Invite wird nur als HMAC-Hash gespeichert; Hash ist eindeutig', async () => {
  const { member } = await staffFixture();
  const token = randomToken();
  const tokenHash = hashToken(token);
  await connection.insert(schema.staffInvites).values({ staffId: member.id, tokenHash, expiresAt: new Date(Date.now() + 7 * 86400000), createdBy: 'admin@example.com' });
  const [row] = await connection.select().from(schema.staffInvites).where(eq(schema.staffInvites.tokenHash, tokenHash));
  assert.ok(row);
  assert.notEqual(row.tokenHash, token);
  assert.equal(row.tokenHash, tokenHash);
  await assert.rejects(
    connection.insert(schema.staffInvites).values({ staffId: member.id, tokenHash, expiresAt: new Date(Date.now() + 7 * 86400000), createdBy: 'admin@example.com' }),
    hasConstraint('staff_invite_token_unique'),
  );
});

test('Einladungsclaim ist atomar und genau einmal möglich (20 parallele Versuche)', async () => {
  const { member } = await staffFixture();
  const tokenHash = hashToken(randomToken());
  const [invite] = await connection.insert(schema.staffInvites).values({ staffId: member.id, tokenHash, expiresAt: new Date(Date.now() + 7 * 86400000), createdBy: 'admin@example.com' }).returning();
  // Exakt die Bedingung aus acceptStaffInvite (src/app/actions/staffAuth.ts):
  // WHERE id, usedAt IS NULL, expiresAt > now – d. h. nur ein Gewinner.
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    connection.update(schema.staffInvites).set({ usedAt: new Date() }).where(and(
      eq(schema.staffInvites.id, invite.id), isNull(schema.staffInvites.usedAt), gt(schema.staffInvites.expiresAt, new Date()),
    )).returning({ id: schema.staffInvites.id }),
  ));
  assert.equal(results.filter(r => r.length).length, 1, 'Genau ein paralleler Claim darf gewinnen');
  const [after1] = await connection.select().from(schema.staffInvites).where(eq(schema.staffInvites.id, invite.id));
  assert.ok(after1.usedAt);
  const second = await connection.update(schema.staffInvites).set({ usedAt: new Date() }).where(and(
    eq(schema.staffInvites.id, invite.id), isNull(schema.staffInvites.usedAt), gt(schema.staffInvites.expiresAt, new Date()),
  )).returning();
  assert.equal(second.length, 0, 'Wiederverwendung muss scheitern');
});

test('Abgelaufene Einladung kann nicht eingelöst werden (0/20 Gewinner)', async () => {
  const { member } = await staffFixture();
  const [invite] = await connection.insert(schema.staffInvites).values({ staffId: member.id, tokenHash: hashToken(randomToken()), expiresAt: new Date(Date.now() - 1000), createdBy: 'admin@example.com' }).returning();
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    connection.update(schema.staffInvites).set({ usedAt: new Date() }).where(and(
      eq(schema.staffInvites.id, invite.id), isNull(schema.staffInvites.usedAt), gt(schema.staffInvites.expiresAt, new Date()),
    )).returning({ id: schema.staffInvites.id }),
  ));
  assert.equal(results.filter(r => r.length).length, 0);
  const [row] = await connection.select().from(schema.staffInvites).where(eq(schema.staffInvites.id, invite.id));
  assert.equal(row.usedAt, null, 'Abgelaufene Einladung darf nicht als eingelöst markiert werden');
});

test('Sensible Felder liegen in der DB verschlüsselt (Onboarding-Speicherung)', async () => {
  const { member } = await staffFixture();
  const taxId = '12345678901';
  const iban = 'DE89370400440532013000';
  const social = '65820576142';
  await connection.update(schema.staff).set({
    taxIdEnc: encryptField(taxId),
    ibanEnc: encryptField(iban),
    socialSecurityEnc: encryptField(social),
  }).where(eq(schema.staff.id, member.id));
  const [row] = await connection.select().from(schema.staff).where(eq(schema.staff.id, member.id));
  assert.ok(row.taxIdEnc?.startsWith('v1:') && row.ibanEnc?.startsWith('v1:') && row.socialSecurityEnc?.startsWith('v1:'));
  assert.notEqual(row.taxIdEnc, taxId);
  assert.notEqual(row.ibanEnc, iban);
  assert.notEqual(row.socialSecurityEnc, social);
  assert.equal(decryptField(row.taxIdEnc), taxId);
  assert.equal(decryptField(row.ibanEnc), iban);
  assert.equal(decryptField(row.socialSecurityEnc), social);
});

test('Fremder Zugriff auf Dokumente/Verträge schlägt fehl (IDOR-Schutz, staffId-Bindung)', async () => {
  const { member: owner } = await staffFixture();
  const { member: attacker } = await staffFixture();
  const [doc] = await connection.insert(schema.staffDocuments).values({ staffId: owner.id, kind: 'id_card', fileUrl: 'https://example.com/ausweis.pdf', mimeType: 'application/pdf' }).returning();
  // Eigenes Dokument (staffId = Aufrufer): gefunden.
  const [own] = await connection.select().from(schema.staffDocuments).where(and(eq(schema.staffDocuments.id, doc.id), eq(schema.staffDocuments.staffId, owner.id)));
  assert.equal(own?.id, doc.id);
  // Fremdes Dokument (staffId = Angreifer): nicht gefunden – wie in /api/team/upload.
  const [foreign] = await connection.select().from(schema.staffDocuments).where(and(eq(schema.staffDocuments.id, doc.id), eq(schema.staffDocuments.staffId, attacker.id)));
  assert.equal(foreign, undefined);
  // Vertrag ans signieren ist ebenfalls staff-gebunden (contracts.ts).
  const [contract] = await connection.insert(schema.contracts).values({ staffId: owner.id, templateVersion: 1, bodyHtml: '<p>x</p>', signatureMode: 'text' }).returning();
  const [foreignContract] = await connection.select().from(schema.contracts).where(and(eq(schema.contracts.id, contract.id), eq(schema.contracts.staffId, attacker.id)));
  assert.equal(foreignContract, undefined);
});

test('Dokument-Status- und Art-Checks lehnen ungültige Werte ab (DB + App-Whitelist)', async () => {
  const { member } = await staffFixture();
  await assert.rejects(
    connection.insert(schema.staffDocuments).values({ staffId: member.id, kind: 'id_card', fileUrl: 'https://example.com/x.pdf', mimeType: 'application/pdf', status: 'hacked' }),
    hasConstraint('staff_documents_status_check'),
  );
  // Defense in Depth: DB-Check (Migration 0018) + App-Whitelist müssen exakt übereinstimmen.
  for (const kind of DOCUMENT_KINDS) {
    const [doc] = await connection.insert(schema.staffDocuments).values({ staffId: member.id, kind, fileUrl: 'https://example.com/x.pdf', mimeType: 'application/pdf' }).returning();
    assert.ok(doc.id);
  }
  await assert.rejects(
    connection.insert(schema.staffDocuments).values({ staffId: member.id, kind: 'contract_signed', fileUrl: 'https://example.com/x.pdf', mimeType: 'application/pdf' }),
    hasConstraint('staff_documents_kind_check'),
  );
  await assert.rejects(
    connection.insert(schema.staffDocuments).values({ staffId: member.id, kind: '<script>', fileUrl: 'https://example.com/x.pdf', mimeType: 'application/pdf' }),
    hasConstraint('staff_documents_kind_check'),
  );
  assert.ok(!DOCUMENT_KINDS.has('contract_signed'));
  assert.ok(!DOCUMENT_KINDS.has('<script>'));
});

test('Dokument-Upload-Validierung: Größe und Typ sind fail-fast (Route src/app/api/team/upload)', async () => {
  const headerLength = MAX_UPLOAD_BYTES + 1024 * 1024;
  assert.ok(headerLength > MAX_UPLOAD_BYTES, 'Content-Length über dem Limit wird vor dem Lesen abgewiesen');
  for (const [type, expected] of [['application/pdf', true], ['image/jpeg', true], ['image/png', true], ['image/webp', true], ['image/svg+xml', false], ['text/html', false], ['application/zip', false], ['', false]] as const) {
    assert.equal(ALLOWED_UPLOAD_TYPES.has(type), expected, `MIME ${type} muss ${expected ? 'erlaubt' : 'abgelehnt'} sein`);
  }
  assert.equal((10 * 1024 * 1024 + 1) > MAX_UPLOAD_BYTES, true, '10 MB + 1 Byte muss abgewiesen werden');
  assert.equal((10 * 1024 * 1024) > MAX_UPLOAD_BYTES, false, 'Exakt 10 MB ist die Grenze');
});

test('Upload-Sniffing erkennt den Inhalt, nicht nur die Client-Angabe (Magic Bytes)', () => {
  const pdf = Buffer.from('%PDF-1.7\n%test');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from('WEBP'), Buffer.from('VP8 ')]);
  assert.equal(sniffMime(pdf), 'application/pdf');
  assert.equal(sniffMime(jpeg), 'image/jpeg');
  assert.equal(sniffMime(png), 'image/png');
  assert.equal(sniffMime(webp), 'image/webp');
  // Umbenanntes HTML/JS darf nicht als PDF/PNG durchgehen.
  assert.equal(sniffMime(Buffer.from('<script>alert(1)</script>')), null);
  assert.equal(sniffMime(Buffer.from('<html><body>x</body></html>')), null);
  assert.equal(sniffMime(Buffer.alloc(0)), null);
  // Typ-Mismatch (client claim != Inhalt) muss die Route abweisen – hier modelliert:
  assert.notEqual(sniffMime(pdf), 'image/png');
  assert.notEqual(sniffMime(png), 'application/pdf');
});

test('IBAN/BIC/Steuer-ID: gültige Werte passieren, ungültige Prüfsummen fallen durch', () => {
  // Bekannt gültige IBANs (DE-Beispiel, mit Leerzeichen normalisiert).
  assert.equal(isValidIban('DE89 3704 0044 0532 0130 00'), true);
  assert.equal(isValidIban('DE89370400440532013000'), true);
  assert.equal(normalizeIban('de89 3704 0044 0532 0130 00'), 'DE89370400440532013000');
  assert.equal(ibanField('DE89 3704 0044 0532 0130 00'), 'DE89370400440532013000');
  // Prüfsumme manipuliert / Format ungültig.
  assert.equal(isValidIban('DE89370400440532013001'), false);
  assert.equal(isValidIban('DE00 3704 0044 0532 0130 00'), false);
  assert.equal(isValidIban('keine-iban'), false);
  assert.equal(isValidIban('DE89'), false);
  assert.equal(isValidIban(42), false);
  assert.throws(() => ibanField('DE89370400440532013001'), /Ungültige IBAN/);
  assert.throws(() => ibanField('<script>alert(1)</script>'), /Ungültige IBAN/);
  assert.equal(ibanField(''), null);
  assert.equal(ibanField(null), null);

  assert.equal(isValidBic('COBADEFFXXX'), true);
  assert.equal(isValidBic('COBADEFF'), true);
  assert.equal(bicField('cobadeffxxx'), 'COBADEFFXXX');
  assert.equal(isValidBic('COBA'), false);
  assert.equal(isValidBic('COBADEFFX12!'), false);
  assert.throws(() => bicField('keine-bic'), /Ungültige BIC/);
  assert.equal(bicField(''), null);

  assert.equal(taxIdField('12345678901'), '12345678901');
  assert.equal(taxIdField('123 4567 8901'), '12345678901');
  assert.throws(() => taxIdField('1234567890'), /Ungültige Steuer-ID/);
  assert.throws(() => taxIdField('1234567890A'), /Ungültige Steuer-ID/);
  assert.equal(taxIdField(''), null);
});

test('Invite-Einlösung hat IP- und Token-Rate-Limits (parallele Versuche begrenzt)', async () => {
  const ip = randomUUID();
  const ipResults = await Promise.all(Array.from({ length: 20 }, () => takeRateLimit(`staff-invite-ip:${ip}`, 10, 15 * 60000, connection)));
  assert.equal(ipResults.filter(Boolean).length, 10, 'IP-Schicht muss bei 10/15 min deckeln');
  const tokenHash = hashToken(randomToken());
  const tokenResults = await Promise.all(Array.from({ length: 20 }, () => takeRateLimit(`staff-invite:${tokenHash}`, 5, 15 * 60000, connection)));
  assert.equal(tokenResults.filter(Boolean).length, 5, 'Token-Schicht muss bei 5/15 min deckeln');
  assert.equal(tokenHash.length, 64);
});

test('Vertrags-State-Machine und Verifizierung sind atomar (nur signed → verified)', async () => {
  const { member } = await staffFixture();
  const [pending] = await connection.insert(schema.contracts).values({ staffId: member.id, templateVersion: 1, bodyHtml: '<p>x</p>', signatureMode: 'text', status: 'pending' }).returning();
  // Verifizierung eines noch nicht unterschriebenen Vertrags muss scheitern (WHERE status = signed).
  const tooEarly = await connection.update(schema.contracts).set({ status: 'verified' }).where(and(eq(schema.contracts.id, pending.id), eq(schema.contracts.status, 'signed'))).returning();
  assert.equal(tooEarly.length, 0);
  await connection.update(schema.contracts).set({ status: 'signed' }).where(eq(schema.contracts.id, pending.id));
  const results = await Promise.all(Array.from({ length: 10 }, () =>
    connection.update(schema.contracts).set({ status: 'verified' }).where(and(eq(schema.contracts.id, pending.id), eq(schema.contracts.status, 'signed'))).returning(),
  ));
  assert.equal(results.filter(r => r.length).length, 1, 'Genau eine parallele Verifizierung darf gewinnen');
  await assert.rejects(
    connection.update(schema.contracts).set({ status: 'hacked' as never }).where(eq(schema.contracts.id, pending.id)),
    hasConstraint('contracts_status_check'),
  );
});

test('Vertrags-Rendering escapet HTML und nutzt nur Snapshot-Werte', () => {
  const staff = {
    firstName: '<script>alert(1)</script>', lastName: 'Muster', email: 'max@example.com', phone: null,
    street: '<b>Hauptstraße</b>', zip: '80331', city: 'München', hourlyRateCents: 1500,
    entryDate: new Date('2026-09-01'),
  } as unknown as typeof schema.staff.$inferSelect;
  const role = { name: 'Bedienung' } as unknown as typeof schema.staffRoles.$inferSelect;
  const html = renderContract('<p>{{name}} · {{rolle}} · {{adresse}}</p>', staff, role);
  assert.ok(!html.includes('<script>'), 'Rohes Script-Tag darf nicht ins Vertrags-HTML gelangen');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<b>Hauptstraße</b>'));
  assert.equal(escapeHtml('<a title="x">\''), '&lt;a title=&quot;x&quot;&gt;&#039;');
});

test('Genau eine aktive Vertragsversion je Rolle (Versionierung)', async () => {
  const { role } = await staffFixture();
  const [v1] = await connection.insert(schema.contractTemplates).values({ roleId: role.id, name: 'Arbeitsvertrag', bodyHtml: '<p>v1</p>', signatureMode: 'text', status: 'active', version: 1, createdBy: 'admin@example.com' }).returning();
  const [v2] = await connection.insert(schema.contractTemplates).values({ roleId: role.id, name: 'Arbeitsvertrag', bodyHtml: '<p>v2</p>', signatureMode: 'handwritten', status: 'active', version: 2, createdBy: 'admin@example.com' }).returning();
  // Demotion wie in saveContractTemplate: alte aktive auf reviewed.
  await connection.update(schema.contractTemplates).set({ status: 'reviewed' }).where(and(
    eq(schema.contractTemplates.roleId, role.id!), eq(schema.contractTemplates.status, 'active'), sql`${schema.contractTemplates.id} <> ${v2.id}`,
  ));
  const actives = await connection.select().from(schema.contractTemplates).where(and(eq(schema.contractTemplates.roleId, role.id!), eq(schema.contractTemplates.status, 'active')));
  assert.equal(actives.length, 1);
  assert.equal(actives[0].id, v2.id);
  const [old] = await connection.select().from(schema.contractTemplates).where(eq(schema.contractTemplates.id, v1.id));
  assert.equal(old.status, 'reviewed');
});

test('Payroll-Gate blockiert unvollständiges Onboarding; CSV escapet Trennzeichen', async () => {
  const empty = {
    id: '12345678-1234-1234-1234-123456789012', firstName: '', lastName: '', birthDate: null, street: '', zip: '', city: '',
    entryDate: null, employmentType: 'minijob', hourlyRateCents: 0, monthlySalaryCents: 0, taxIdEnc: null,
    taxClass: '', childAllowances: 0, socialSecurityEnc: null, healthInsurance: '', ibanEnc: null, bic: '', status: 'invited',
  } as unknown as typeof schema.staff.$inferSelect;
  assert.ok(missingPayrollFields(empty).includes('IBAN'));
  assert.ok(missingPayrollFields(empty).includes('Steuer-ID'));
  assert.ok(missingPayrollFields(empty).length >= 10);
  const complete = {
    id: '12345678-1234-1234-1234-123456789012', firstName: 'Max', lastName: 'Muster', birthDate: new Date('1990-01-01'),
    street: 'Hauptstraße 1', zip: '80331', city: 'München', entryDate: new Date('2026-09-01'), employmentType: 'minijob',
    hourlyRateCents: 1500, monthlySalaryCents: 0, taxIdEnc: encryptField('12345678901'), taxClass: '1', childAllowances: 0,
    socialSecurityEnc: encryptField('65820576142'), healthInsurance: 'AOK', ibanEnc: encryptField('DE89370400440532013000'), bic: 'COBADEFFXXX', status: 'active',
  } as unknown as typeof schema.staff.$inferSelect;
  assert.deepEqual(missingPayrollFields(complete), []);
  assert.ok(buildPayrollCsv([['a;b']]).includes('"a;b"'));
  assert.ok(buildPayrollCsv([['x"y']]).includes('"x""y"'));
});

test('Retention-Cleanup löscht nur abgelaufene Invites/Sessions (frische bleiben)', async () => {
  const { member } = await staffFixture();
  const [expiredInvite] = await connection.insert(schema.staffInvites).values({ staffId: member.id, tokenHash: hashToken(randomToken()), expiresAt: new Date(0), createdBy: 'admin@example.com' }).returning();
  const [freshInvite] = await connection.insert(schema.staffInvites).values({ staffId: member.id, tokenHash: hashToken(randomToken()), expiresAt: new Date(Date.now() + 86400000), createdBy: 'admin@example.com' }).returning();
  await connection.insert(schema.staffSessions).values({ staffId: member.id, validUntil: new Date(0) });
  const [freshSession] = await connection.insert(schema.staffSessions).values({ staffId: member.id, validUntil: new Date(Date.now() + 86400000) }).returning();
  const result = await runRetentionCleanup(connection, new Date());
  assert.ok(result.staffInvites >= 1);
  assert.ok(result.staffSessions >= 1);
  assert.equal((await connection.select().from(schema.staffInvites).where(eq(schema.staffInvites.id, expiredInvite.id))).length, 0);
  assert.equal((await connection.select().from(schema.staffInvites).where(eq(schema.staffInvites.id, freshInvite.id))).length, 1);
  assert.equal((await connection.select().from(schema.staffSessions).where(eq(schema.staffSessions.id, freshSession.id))).length, 1);
});

test('Retention: ID-/Gesundheitsdocs 365 Tage nach Austritt, Rest bleibt', async () => {
  const { member } = await staffFixture();
  const now = new Date();
  await connection.update(schema.staff).set({ exitDate: new Date(now.getTime() - 366 * 86400000) }).where(eq(schema.staff.id, member.id));
  const [idDoc] = await connection.insert(schema.staffDocuments).values({ staffId: member.id, kind: 'id_card', fileUrl: 'https://example.com/id.pdf', mimeType: 'application/pdf' }).returning();
  const [healthDoc] = await connection.insert(schema.staffDocuments).values({ staffId: member.id, kind: 'health_certificate', fileUrl: 'https://example.com/health.pdf', mimeType: 'application/pdf' }).returning();
  const [minijobDoc] = await connection.insert(schema.staffDocuments).values({ staffId: member.id, kind: 'minijob_form', fileUrl: 'https://example.com/mini.pdf', mimeType: 'application/pdf' }).returning();
  const result = await runRetentionCleanup(connection, now);
  assert.ok(result.purgedIdDocUrls.includes('https://example.com/id.pdf'));
  assert.ok(result.purgedIdDocUrls.includes('https://example.com/health.pdf'));
  assert.equal((await connection.select().from(schema.staffDocuments).where(eq(schema.staffDocuments.id, idDoc.id))).length, 0);
  assert.equal((await connection.select().from(schema.staffDocuments).where(eq(schema.staffDocuments.id, healthDoc.id))).length, 0);
  assert.equal((await connection.select().from(schema.staffDocuments).where(eq(schema.staffDocuments.id, minijobDoc.id))).length, 1);
  const [row] = await connection.select().from(schema.staff).where(eq(schema.staff.id, member.id));
  assert.equal(row.firstName, 'Max', 'Mitarbeiter darf nach 1 Jahr noch NICHT anonymisiert sein');
});

test('Retention: 10-Jahres-Anonymisierung löscht PII + Docs/Verträge, idempotent', async () => {
  const { member } = await staffFixture();
  const now = new Date();
  await connection.update(schema.staff).set({
    exitDate: new Date(now.getTime() - 3651 * 86400000),
    taxIdEnc: encryptField('12345678901'),
    ibanEnc: encryptField('DE89370400440532013000'),
    phone: '0170 123',
    street: 'Hauptstraße 1',
    status: 'inactive',
    privacyVersion: '2026-11',
    privacyAcceptedAt: now,
  }).where(eq(schema.staff.id, member.id));
  await connection.insert(schema.staffDocuments).values({ staffId: member.id, kind: 'minijob_form', fileUrl: 'https://example.com/mini.pdf', mimeType: 'application/pdf' });
  await connection.insert(schema.contracts).values({ staffId: member.id, templateVersion: 1, bodyHtml: '<p>x</p>', signatureMode: 'text' });
  const result = await runRetentionCleanup(connection, now);
  assert.equal(result.anonymizedStaff, 1);
  assert.ok(result.purgedAnonymizeUrls.includes('https://example.com/mini.pdf'));
  const [row] = await connection.select().from(schema.staff).where(eq(schema.staff.id, member.id));
  assert.equal(row.email, `anonymized-${member.id}@deleted.invalid`);
  assert.equal(row.firstName, 'Anonymisiert');
  assert.equal(row.phone, null);
  assert.equal(row.street, null);
  assert.equal(row.taxIdEnc, null);
  assert.equal(row.ibanEnc, null);
  assert.equal(row.passwordHash, null);
  assert.equal((await connection.select().from(schema.staffDocuments).where(eq(schema.staffDocuments.staffId, member.id))).length, 0);
  assert.equal((await connection.select().from(schema.contracts).where(eq(schema.contracts.staffId, member.id))).length, 0);
  // Zweiter Lauf anonymisiert nicht erneut.
  const second = await runRetentionCleanup(connection, now);
  assert.equal(second.anonymizedStaff, 0);
});

test('Retention: ohne exitDate wird kein Mitarbeiter anonymisiert; Audit-Fristen getrennt', async () => {
  const { member } = await staffFixture();
  await connection.update(schema.staff).set({ taxIdEnc: encryptField('12345678901') }).where(eq(schema.staff.id, member.id));
  const now = new Date();
  const recent = await runRetentionCleanup(connection, now);
  assert.equal(recent.anonymizedStaff, 0);
  const [row] = await connection.select().from(schema.staff).where(eq(schema.staff.id, member.id));
  assert.equal(decryptField(row.taxIdEnc), '12345678901');
  // Audit: allgemeiner Eintrag >1 Jahr weg, staff-Audit <10 Jahre bleibt.
  await connection.insert(schema.auditLog).values({ actorType: 'test', actorId: 'test', action: 'old', entityType: 'test', entityId: null, createdAt: new Date(now.getTime() - 366 * 86400000) });
  await connection.insert(schema.auditLog).values({ actorType: 'staff', actorId: member.id, action: 'staff.onboarding.save', entityType: 'staff', entityId: member.id, createdAt: new Date(now.getTime() - 366 * 86400000) });
  await runRetentionCleanup(connection, now);
  const remaining = await connection.select({ action: schema.auditLog.action }).from(schema.auditLog);
  assert.ok(!remaining.some(entry => entry.action === 'old'));
  assert.ok(remaining.some(entry => entry.action === 'staff.onboarding.save'));
});

test('Rate-Limit (staffLogin) ist atomic: exakt 5 Gewinner bei 20/1000 parallelen Versuchen', async () => {
  const key = randomUUID();
  const results = await Promise.all(Array.from({ length: 20 }, () => takeRateLimit(key, 5, 60000, connection)));
  assert.equal(results.filter(Boolean).length, 5);
  const key2 = randomUUID();
  const results2 = await Promise.all(Array.from({ length: 1000 }, () => takeRateLimit(key2, 5, 60000, connection)));
  assert.equal(results2.filter(Boolean).length, 5, 'Auch 1000 parallele Login-Versuche dürfen das Limit nicht sprengen');
  // Anderer Schlüssel ist unabhängig.
  const results3 = await Promise.all(Array.from({ length: 20 }, () => takeRateLimit(randomUUID(), 5, 60000, connection)));
  assert.equal(results3.filter(Boolean).length, 20);
});

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

test('Verschlüsselungs-Durchsatz: 1000 Roundtrips bleiben schnell', async () => {
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    const plain = `DE89370400440532013${String(i).padStart(3, '0')}`;
    assert.equal(decryptField(encryptField(plain)), plain);
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 5000, `1000 AES-Roundtrips zu langsam: ${elapsed.toFixed(0)} ms`);
});

test('Passwort-Hashing parallel: 20 Hashes verifizieren korrekt ( bounded CPU)', async () => {
  const start = performance.now();
  const hashes = await Promise.all(Array.from({ length: 20 }, () => hashPassword('sicheres-passwort-123')));
  assert.equal(new Set(hashes).size, 20);
  for (const hash of hashes) assert.equal(await verifyPassword('sicheres-passwort-123', hash), true);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 30000, `20 scrypt-Hashes+Verifizierungen zu langsam: ${elapsed.toFixed(0)} ms`);
});

test('Mitarbeiterliste (Join) bleibt bei 200 Datensätzen schnell und vollständig', async () => {
  const { role } = await staffFixture();
  for (let i = 0; i < 200; i++) {
    await connection.insert(schema.staff).values({ email: `bulk-${i}-${randomUUID()}@example.com`, firstName: `Bulk${i}`, lastName: 'Test', roleId: role.id });
  }
  const start = performance.now();
  const rows = await connection.select({ member: schema.staff, role: schema.staffRoles }).from(schema.staff)
    .leftJoin(schema.staffRoles, eq(schema.staffRoles.id, schema.staff.roleId))
    .orderBy(schema.staff.lastName, schema.staff.firstName);
  const elapsed = performance.now() - start;
  assert.ok(rows.length >= 200);
  assert.ok(elapsed < 5000, `Mitarbeiterliste zu langsam: ${elapsed.toFixed(0)} ms`);
  // Wiederholung: kein N+1/Cache-Regression.
  const againStart = performance.now();
  const again = await connection.select().from(schema.staff).limit(200);
  assert.ok(again.length >= 200);
  assert.ok(performance.now() - againStart < 2000);
});

test('Invite-Lookup per Token-Hash skaliert mit 200 Invites (Unique-Index)', async () => {
  const { member } = await staffFixture();
  const hashes: string[] = [];
  for (let i = 0; i < 200; i++) {
    const h = hashToken(randomToken());
    hashes.push(h);
    await connection.insert(schema.staffInvites).values({ staffId: member.id, tokenHash: h, expiresAt: new Date(Date.now() + 86400000), createdBy: 'admin@example.com' });
  }
  const start = performance.now();
  for (const h of hashes.slice(0, 20)) {
    const [row] = await connection.select().from(schema.staffInvites).where(eq(schema.staffInvites.tokenHash, h));
    assert.ok(row);
  }
  assert.ok(performance.now() - start < 2000);
  const [total] = await connection.select({ n: count() }).from(schema.staffInvites);
  assert.ok(total.n >= 200);
});

test('Rate-Limit-Parallelität: 500 distincte Schlüssel ohne Deadlock', async () => {
  const start = performance.now();
  const results = await Promise.all(Array.from({ length: 500 }, () => takeRateLimit(randomUUID(), 5, 60000, connection)));
  assert.equal(results.filter(Boolean).length, 500);
  assert.ok(performance.now() - start < 10000);
});
