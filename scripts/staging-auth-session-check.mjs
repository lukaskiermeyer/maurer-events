// Read-only evidence of operator login. No OTP or bearer-session value is selected.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
const env = dotenv.parse(await fs.readFile('.env.local'));
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Staging test mode required');
const db = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const [sessions] = await db`SELECT count(*)::int AS active_count, max(created_at) AS latest_created_at FROM public.admin_sessions WHERE lower(trim(email))='hello@madebylui.net' AND valid_until>now()`;
  const [{ count: unconsumed }] = await db`SELECT count(*)::int AS count FROM public.admin_auth WHERE lower(trim(email))='hello@madebylui.net' AND expires_at>now()`;
  const report = { checkedAt: new Date().toISOString(), activeSessionCount: sessions.active_count, latestSessionCreatedAt: sessions.latest_created_at, unconsumedOtpCount: unconsumed, scope: 'read-only metadata; operator-reported real browser login' };
  await fs.writeFile('test-results/staging-auth-session.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.end({ timeout: 3 }); }
