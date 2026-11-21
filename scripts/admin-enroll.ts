import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import { adminUsers } from '../src/db/schema';
import { createEnrollmentToken } from '../src/lib/admin-enrollment';
import { appendAuditEvent } from '../src/lib/admin-audit';

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const email = getArg('email');
const ttlStr = getArg('ttl') || '72h';
if (!email) { console.error('Usage: npm run admin:enroll -- --email <email> --ttl 72h'); process.exit(1); }

const allowlist = (process.env.ADMIN_EMAILS || process.env.ADMIN_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const normalized = email.trim().toLowerCase();
if (allowlist.length > 0 && !allowlist.includes(normalized)) {
  console.error('Email not in allowlist (ADMIN_EMAILS).');
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

function ttlMs(s: string): number {
  const m = s.match(/^(\d+)(m|h)$/);
  if (!m) return 72 * 3600 * 1000;
  const n = Number(m[1]);
  return m[2] === 'h' ? n * 3600 * 1000 : n * 60 * 1000;
}

async function main() {
  const [admin] = await db.select().from(adminUsers).where(sql`lower(trim(${adminUsers.email})) = ${normalized}`);
  let target = admin;
  if (!target) {
    const [ins] = await db.insert(adminUsers).values({
      email: normalized,
      emailNormalized: normalized,
      displayName: normalized,
      role: 'owner',
      status: 'pending_enrollment',
      createdBy: 'cli',
    }).returning();
    target = ins;
  }

  const { rawToken, pin, expiresAt } = await createEnrollmentToken({
    adminId: target.id,
    purpose: 'invite',
    ttlMs: ttlMs(ttlStr),
    createdBy: null,
    createdVia: 'cli',
  });

  const host = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  console.log('');
  console.log('Einrichtungs-Link (Wizard: Passwort + TOTP + Recovery-Codes):');
  console.log(`${host}/admin/setup#token=${rawToken}`);
  console.log('');
  console.log(`PIN (out-of-band durchgeben, z. B. Telefon): ${pin}`);
  console.log(`Gültig bis: ${expiresAt.toISOString()}`);

  await appendAuditEvent({
    actorAdminId: null,
    subjectAdminId: target.id,
    eventType: 'admin.invite.created_cli',
    ipHash: null,
    userAgent: 'cli',
    metadata: { ttl: ttlStr },
  });

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
