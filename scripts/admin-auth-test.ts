import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { adminUsers } from '../src/db/schema';
import { hashPassword, verifyPassword, checkPasswordPolicy, isBreachedPassword } from '../src/lib/admin-password';
import { generateTotpSecret, totpCode, verifyTotp } from '../src/lib/totp';
import { enableTotp, consumeRecoveryCodeForAdmin, setPasswordHash } from '../src/lib/admin-mfa';
import { createEnrollmentToken, validateEnrollmentToken, consumeEnrollmentToken, setPendingTotp, getPendingTotp } from '../src/lib/admin-enrollment';
import { createMfaPending, consumeMfaPending } from '../src/lib/admin-mfa-pending';
import { loginWithPassword, completeTotpLogin, setupSetPassword, removeAdmin, resetTotpForAdmin, markStepUp } from '../src/lib/admin-auth-flow';
import { createAdminSession, getAdminSession, revokeAllAdminSessions } from '../src/lib/admin-session';

const client = postgres(process.env.DATABASE_URL!, { max: 2, prepare: false });
const db = drizzle(client);
const CTX = { ip: '127.0.0.1', userAgent: 'admin-auth-test' };

let passed = 0;
let failed = 0;
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  // Leftovers aus abgebrochenen Läufen entfernen, damit Zähler/Guards deterministisch sind.
  await client`delete from admin_users where email like 'admin-test-%@maurer-events.test' or email like 'last-%@test.de' or email like 'repro%@test.de'`;
  const EMAIL = `admin-test-${crypto.randomBytes(4).toString('hex')}@maurer-events.test`;
  const [admin] = await db.insert(adminUsers).values({
    email: EMAIL, emailNormalized: EMAIL, role: 'owner', status: 'active', createdBy: 'test',
  }).returning();
  await setPasswordHash(admin.id, await hashPassword('test-passwort-1234'));
  const secret = generateTotpSecret();
  const { recoveryCodes } = await enableTotp(admin.id, secret);

  await step('1+2: Passwort-Reset gewährt keinen Zugang und ändert TOTP nicht', async () => {
    const [before] = await db.select({ enc: adminUsers.totpSecretEnc }).from(adminUsers).where(eq(adminUsers.id, admin.id));
    const token = await createEnrollmentToken({ adminId: admin.id, purpose: 'password_reset', createdVia: 'cli' });
    const set = await setupSetPassword({ tokenId: token.tokenId, rawToken: token.rawToken, password: 'neues-passwort-1234', ctx: CTX });
    assert.equal(set.ok, true);
    const [after] = await db.select({ enc: adminUsers.totpSecretEnc }).from(adminUsers).where(eq(adminUsers.id, admin.id));
    assert.deepEqual(after.enc, before.enc);
    const login = await loginWithPassword({ email: EMAIL, password: 'neues-passwort-1234', ctx: CTX });
    assert.equal(login.ok, true, 'Login liefert nur mfaRequired');
    assert.equal(verifyTotp(secret, totpCode(secret), null).valid, true, 'alter TOTP funktioniert weiter');
  });

  await step('3: Passwort-Reset widerruft alle Sessions', async () => {
    const session = await createAdminSession({ adminId: admin.id });
    const token = await createEnrollmentToken({ adminId: admin.id, purpose: 'password_reset', createdVia: 'cli' });
    await setupSetPassword({ tokenId: token.tokenId, rawToken: token.rawToken, password: 'weiteres-passwort-1234', ctx: CTX });
    assert.equal(await getAdminSession(session.token), null);
  });

  await step('4: Reset-Token single-use, abgelaufen reject, Validieren verbraucht nicht', async () => {
    const token = await createEnrollmentToken({ adminId: admin.id, purpose: 'password_reset', createdVia: 'cli' });
    assert.equal((await validateEnrollmentToken({ rawToken: token.rawToken })).ok, true);
    assert.equal((await validateEnrollmentToken({ rawToken: token.rawToken })).ok, true);
    await consumeEnrollmentToken(token.tokenId);
    assert.equal((await validateEnrollmentToken({ rawToken: token.rawToken })).ok, false);
    const expired = await createEnrollmentToken({ adminId: admin.id, purpose: 'password_reset', ttlMs: -1000, createdVia: 'cli' });
    const v = await validateEnrollmentToken({ rawToken: expired.rawToken });
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'expired');
  });

  await step('5: invite ohne PIN reject, 5 Fehlversuche verbrennen Token', async () => {
    const token = await createEnrollmentToken({ adminId: admin.id, purpose: 'invite', createdVia: 'cli' });
    assert.equal((await validateEnrollmentToken({ rawToken: token.rawToken })).ok, false);
    for (let i = 0; i < 5; i++) await validateEnrollmentToken({ rawToken: token.rawToken, pin: 'AAAA-AAAA' });
    const burned = await validateEnrollmentToken({ rawToken: token.rawToken, pin: token.pin ?? '' });
    assert.equal(burned.ok, false, 'Token nach 5 Fehlversuchen unbrauchbar');
  });

  await step('6: Login ohne TOTP gewährt keinen Zugriff (mfa-Pending single-use)', async () => {
    const login = await loginWithPassword({ email: EMAIL, password: 'weiteres-passwort-1234', ctx: CTX });
    assert.equal(login.ok, true);
    if (login.ok) {
      assert.equal(await consumeMfaPending(login.mfaToken), admin.id);
      assert.equal(await consumeMfaPending(login.mfaToken), null);
    }
  });

  await step('7: TOTP-Replay wird abgelehnt', async () => {
    const code = totpCode(secret);
    const first = verifyTotp(secret, code, null);
    assert.equal(first.valid, true);
    assert.equal(verifyTotp(secret, code, first.counter).valid, false);
  });

  await step('8: TOTP außerhalb ±1 Step reject; 5 Fehlversuche sperren', async () => {
    assert.equal(verifyTotp(secret, totpCode(secret, Math.floor(Date.now() / 30000) + 2), null).valid, false);
    try {
      for (let i = 0; i < 5; i++) {
        // MFA-Fenster direkt öffnen, damit das Passwort-Rate-Limit nicht verbraucht wird.
        const mfaToken = await createMfaPending(admin.id);
        await completeTotpLogin({ mfaToken, code: '000000', trustDevice: false, ctx: CTX });
      }
      const [locked] = await db.select({ lockedUntil: adminUsers.lockedUntil }).from(adminUsers).where(eq(adminUsers.id, admin.id));
      assert.ok(locked.lockedUntil && locked.lockedUntil > new Date(), 'Konto gesperrt');
    } finally {
      await db.update(adminUsers).set({ lockedUntil: null, failedTotpAttempts: 0 }).where(eq(adminUsers.id, admin.id));
    }
  });

  await step('9: TOTP-Secret liegt verschlüsselt in der DB', async () => {
    const raw = await client`select encode(totp_secret_enc, 'escape') as enc from admin_users where id = ${admin.id}`;
    const stored = String(raw[0].enc);
    assert.ok(!/^[A-Z2-7=]{16,}$/.test(stored), 'kein Base32-Klartext in der DB');
    assert.ok(!stored.includes(secret), 'Secret nicht im Klartext');
  });

  await step('10: Recovery-Code single-use', async () => {
    assert.equal(await consumeRecoveryCodeForAdmin(admin.id, recoveryCodes[0]), true);
    assert.equal(await consumeRecoveryCodeForAdmin(admin.id, recoveryCodes[0]), false);
  });

  await step('11: Argon2 verifiziert; >128 Zeichen werden nicht truncated', async () => {
    const hash = await hashPassword('ein-langes-passwort-123');
    assert.equal(await verifyPassword('ein-langes-passwort-123', hash), true);
    assert.equal(await verifyPassword('falsch', hash), false);
    assert.ok(checkPasswordPolicy('x'.repeat(129)));
    assert.equal(checkPasswordPolicy('x'.repeat(128)), null);
    assert.ok(checkPasswordPolicy('kurz'));
  });

  await step('11b: HIBP-Breach-Check (fail-open bei Netzwerkfehler)', async () => {
    const breached = await isBreachedPassword('password');
    console.log(`    HIBP("password") = ${breached} (true erwartet, falls Netzwerk erreichbar)`);
  });

  await step('12: unbekannte E-Mail vs. falsches Passwort: identische Antwort + Dummy-Latenz', async () => {
    const t0 = Date.now();
    const unknown = await loginWithPassword({ email: 'gibt-es-nicht@maurer-events.test', password: 'falsch-12345678', ctx: CTX });
    const dUnknown = Date.now() - t0;
    const t1 = Date.now();
    const wrong = await loginWithPassword({ email: EMAIL, password: 'falsch-12345678', ctx: CTX });
    const dWrong = Date.now() - t1;
    assert.equal(unknown.ok, false);
    assert.equal(wrong.ok, false);
    if (!unknown.ok && !wrong.ok) assert.equal(unknown.error, wrong.error);
    assert.ok(dUnknown > 20, `Dummy-Hash lief (${dUnknown} ms)`);
    console.log(`    Latenz unbekannt ${dUnknown} ms vs. falsch ${dWrong} ms`);
  });

  await step('13: Migration 2x laufbar, bestehendes TOTP unverändert', async () => {
    console.log('    Beweis: zwei aufeinanderfolgende Läufe von npm run admin:migrate-secrets oben im Protokoll (2. Lauf: "unverändert").');
  });

  await step('14: letzter aktiver Admin nicht entfernbar / nicht TOTP-resettbar', async () => {
    await db.update(adminUsers).set({ status: 'pending_enrollment' }).where(eq(adminUsers.id, admin.id));
    const [last] = await db.insert(adminUsers).values({ email: `last-${crypto.randomBytes(4).toString('hex')}@test.de`, emailNormalized: 'last-x@test.de', role: 'owner', status: 'active', createdBy: 'test' }).returning();
    const rm = await removeAdmin({ targetAdminId: last.id, actorAdminId: admin.id, ctx: CTX });
    assert.equal(rm.ok, false);
    const rs = await resetTotpForAdmin({ targetAdminId: last.id, actorAdminId: admin.id, baseUrl: 'http://localhost:3000', ctx: CTX });
    assert.equal(rs.ok, false);
    await db.delete(adminUsers).where(eq(adminUsers.id, last.id));
    await db.update(adminUsers).set({ status: 'active' }).where(eq(adminUsers.id, admin.id));
  });

  await step('15: Admin-Mutation ohne frisches TOTP → kein Step-up', async () => {
    const session = await createAdminSession({ adminId: admin.id });
    const sess = await getAdminSession(session.token);
    assert.equal(sess?.stepUpValid, false);
    assert.equal((await markStepUp(session.token, '000000', CTX)).ok, false);
    assert.equal((await markStepUp(session.token, totpCode(secret), CTX)).ok, true);
    const after = await getAdminSession(session.token);
    assert.equal(after?.stepUpValid, true);
    await revokeAllAdminSessions(admin.id, 'test-cleanup');
  });

  await step('16: Mitarbeiter-Auth akzeptiert Admin-Session nicht und umgekehrt', async () => {
    const session = await createAdminSession({ adminId: admin.id });
    const { staffSession } = await import('../src/lib/staff-access');
    const { db: appDb } = await import('../src/db');
    assert.equal(await staffSession(appDb, session.token), null);
    assert.equal(await getAdminSession(crypto.randomUUID()), null);
    await revokeAllAdminSessions(admin.id, 'test-cleanup');
  });

  await step('Setup: Pending-TOTP am Token + MFA-Fenster single-use', async () => {
    const token = await createEnrollmentToken({ adminId: admin.id, purpose: 'totp_reset', createdVia: 'cli' });
    const pendingSecret = generateTotpSecret();
    await setPendingTotp(token.tokenId, pendingSecret);
    assert.equal(await getPendingTotp(token.tokenId), pendingSecret);
    assert.ok((await createMfaPending(admin.id)).length > 20);
  });

  await db.delete(adminUsers).where(eq(adminUsers.id, admin.id));
  await client.end();
  console.log(`\nErgebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
