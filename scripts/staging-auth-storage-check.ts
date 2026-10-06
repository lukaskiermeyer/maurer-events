// Tests native application DB writes in a transaction that always rolls back.
// No real email, CAPTCHA bypass, login code or session is created.
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

async function main() {
  Object.assign(process.env, dotenv.parse(await fs.readFile('.env.local')));
  if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Staging test mode required');
  const { db } = await import('../src/db');
  const { adminAuth } = await import('../src/db/schema');
  const { otpHash, isAdminEmail } = await import('../src/lib/admin-identity');
  const { takeRateLimit } = await import('../src/lib/rate-limit');
  const rollback = new Error('Intentional diagnostic rollback');
  let stage = 'configuration';
  const report = { checkedAt: new Date().toISOString(), authSecretValid: false, authorizedRecipientIsAdmin: isAdminEmail('hello@madebylui.net'), rateLimitWrite: false, otpUpsert: false, otpRead: false, rolledBack: false };
  const email = `acceptance-${randomUUID()}@example.com`;
  const hash = otpHash(email, '000000');
  report.authSecretValid = hash.length === 64;
  try {
    await db.transaction(async tx => {
      stage = 'rate-limit';
      report.rateLimitWrite = await takeRateLimit(`acceptance-diagnostic:${email}`, 5, 900000, tx);
      stage = 'otp-save';
      const values = { email, otpCode: hash, attempts: 0, expiresAt: new Date(Date.now() + 600000) };
      await tx.insert(adminAuth).values(values).onConflictDoUpdate({ target: adminAuth.email, set: values });
      await tx.insert(adminAuth).values(values).onConflictDoUpdate({ target: adminAuth.email, set: values });
      report.otpUpsert = true;
      const rows = await tx.select({ email: adminAuth.email }).from(adminAuth).where(eq(adminAuth.email, email));
      report.otpRead = rows.length === 1;
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) { console.error('Native auth storage diagnostic failed at:', stage); throw new Error('Native auth storage unavailable'); }
    report.rolledBack = true;
  }
  const rows = await db.select({ email: adminAuth.email }).from(adminAuth).where(eq(adminAuth.email, email));
  if (rows.length) throw new Error('Diagnostic rollback failed');
  await fs.writeFile('test-results/staging-auth-storage.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().then(() => process.exit(0)).catch(() => { console.error('Auth storage diagnostic failed; no secret values logged.'); process.exit(1); });
