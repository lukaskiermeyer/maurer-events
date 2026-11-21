import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { adminUsers } from '../src/db/schema';
import { createEnrollmentToken } from '../src/lib/admin-enrollment';
import { appendAuditEvent } from '../src/lib/admin-audit';
import { revokeAllAdminSessions } from '../src/lib/admin-session';
import { revokeTrustedDevices } from '../src/lib/admin-mfa';
import { checkPasswordPolicy, hashPassword } from '../src/lib/admin-password';
import { setPasswordHash } from '../src/lib/admin-mfa';

// Notfall-Zugang per Server/CLI: erzeugt einen totp_reset-Token (mit PIN) und
// setzt optional direkt ein neues Passwort. Beide Vorgänge werden auditiert.
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const email = getArg('email');
const reason = getArg('reason');
const newPassword = getArg('password');
if (!email || !reason) { console.error('Usage: npm run admin:break-glass -- --email <email> --reason "<text>" [--password <neues-passwort>]'); process.exit(1); }

const allowlist = (process.env.ADMIN_EMAILS || process.env.ADMIN_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const normalized = email.trim().toLowerCase();
if (allowlist.length > 0 && !allowlist.includes(normalized)) { console.error('Email not in allowlist (ADMIN_EMAILS).'); process.exit(1); }

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function main() {
  const [admin] = await db.select().from(adminUsers).where(sql`lower(trim(${adminUsers.email})) = ${normalized}`);
  if (!admin) { console.error('Admin not found.'); process.exit(1); }

  if (newPassword) {
    const policyError = checkPasswordPolicy(newPassword);
    if (policyError) { console.error(policyError); process.exit(1); }
    await setPasswordHash(admin.id, await hashPassword(newPassword));
    console.log('Passwort neu gesetzt. TOTP bleibt unverändert Pflicht.');
  }

  await revokeAllAdminSessions(admin.id, 'breakglass');
  await revokeTrustedDevices(admin.email);

  const { rawToken, pin, expiresAt } = await createEnrollmentToken({
    adminId: admin.id,
    purpose: 'totp_reset',
    ttlMs: 30 * 60 * 1000,
    createdBy: null,
    createdVia: 'cli',
  });

  const host = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  console.log('');
  console.log('Break-Glass-Link (TOTP-Neueinrichtung, 30 min):');
  console.log(`${host}/admin/setup#token=${rawToken}`);
  console.log('');
  console.log(`PIN: ${pin}`);
  console.log(`Gültig bis: ${expiresAt.toISOString()}`);

  await appendAuditEvent({
    actorAdminId: null,
    subjectAdminId: admin.id,
    eventType: 'admin.breakglass.used',
    ipHash: null,
    userAgent: 'cli',
    metadata: { reason, passwordReset: !!newPassword },
  });

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
