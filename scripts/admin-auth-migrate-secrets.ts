import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import crypto from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { adminMfa, adminRecoveryCodes, adminUsers } from '../src/db/schema';
import { decryptSecret, encryptSecret } from '../src/lib/secret-box';

// Idempotent: kopiert bestehende TOTP-Secrets (admin_mfa, legacy-Verschluesselung)
// in admin_users.totp_secret_enc (aktuelle Verschluesselung) und ueberfuehrt
// Recovery-Code-Hashes in admin_recovery_codes. Bestehende Ziele werden nie ueberschrieben.
const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function main() {
  const mfaRows = await db.select().from(adminMfa);
  for (const mfa of mfaRows) {
    const [admin] = await db.select().from(adminUsers)
      .where(sql`lower(trim(${adminUsers.email})) = ${mfa.email}`);
    if (!admin) {
      console.log(`admin_mfa ${mfa.email}: kein admin_users-Eintrag – uebersprungen`);
      continue;
    }
    if (mfa.totpSecretEnc && mfa.totpEnabledAt && !admin.totpSecretEnc) {
      const secret = decryptSecret(mfa.totpSecretEnc);
      const enc = encryptSecret(secret);
      await db.update(adminUsers).set({
        totpSecretEnc: Buffer.from(enc, 'base64'),
        totpEnrolledAt: mfa.totpEnabledAt,
        totpLastUsedStep: mfa.totpLastCounter ?? null,
        updatedAt: new Date(),
      }).where(eq(adminUsers.id, admin.id));
      console.log(`TOTP migriert: ${mfa.email} (Secret neu verschluesselt, Step uebernommen)`);
    } else if (mfa.totpSecretEnc && admin.totpSecretEnc) {
      console.log(`TOTP bereits vorhanden: ${mfa.email} – unveraendert`);
    }
    const legacyCodes = (mfa.recoveryCodes as string[] | null) || [];
    if (legacyCodes.length > 0) {
      const [existing] = await db.select({ n: sql<number>`count(*)::int` }).from(adminRecoveryCodes)
        .where(and(eq(adminRecoveryCodes.adminId, admin.id), isNull(adminRecoveryCodes.consumedAt)));
      if ((existing?.n || 0) === 0) {
        const batchId = crypto.randomUUID();
        for (const hash of legacyCodes) {
          await db.insert(adminRecoveryCodes).values({ adminId: admin.id, batchId, codeHash: hash });
        }
        console.log(`Recovery-Codes migriert: ${mfa.email} (${legacyCodes.length}, Legacy-Hashes, single-use)`);
      } else {
        console.log(`Recovery-Codes bereits vorhanden: ${mfa.email} – unveraendert`);
      }
    }
  }
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
