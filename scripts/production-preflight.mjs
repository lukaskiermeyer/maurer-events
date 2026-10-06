// Read-only production checks. No migrations, bookings, provider writes or email.
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';
import Stripe from 'stripe';

const option = name => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const envFile = option('--env') || '.env.local';
const env = { ...dotenv.parse(await fs.readFile(envFile)), ...process.env };
const target = option('--url') || env.NEXT_PUBLIC_BASE_URL;
const production = process.argv.includes('--production');
const results = [];
const record = (id, status, detail) => { results.push({ id, status, detail }); console.log(`${status.toUpperCase()} ${id}: ${detail}`); };
const check = async (id, fn) => { try { await fn(); } catch (error) { record(id, 'blocked', `Prüfung fehlgeschlagen (${error?.name || 'Error'}). Keine Zugangsdaten protokolliert.`); } };
const configured = name => !!env[name] && !/^(\.\.\.|.*replace-with.*|your-.*|sk_(test|live)_\.\.\.|whsec_\.\.\.)$/.test(env[name]);
const get = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(15000), redirect: 'follow' });
let origin;
await check('config.url', async () => {
  origin = new URL(target).origin;
  record('config.url', origin.startsWith('https://') ? 'pass' : 'fail', origin.startsWith('https://') ? 'HTTPS-Prüfziel.' : 'Prüfziel verwendet kein HTTPS.');
  record('config.checkout-origin', env.NEXT_PUBLIC_BASE_URL === origin ? 'pass' : 'fail', env.NEXT_PUBLIC_BASE_URL === origin ? 'Checkout-Konfiguration entspricht Prüfziel.' : 'Lokale Checkout-Konfiguration weicht vom Prüfziel ab; entfernte Runtime separat prüfen.');
});
for (const name of ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'ADMIN_EMAILS']) record(`config.${name}`, configured(name) ? 'pass' : 'fail', configured(name) ? 'Gesetzt; Wert bleibt verborgen.' : 'Fehlt oder enthält einen Platzhalter.');
for (const name of ['AUTH_SECRET', 'CRON_SECRET']) record(`config.${name}`, configured(name) && env[name].length >= 32 ? 'pass' : 'fail', configured(name) && env[name].length >= 32 ? 'Gesetzt, mindestens 32 Zeichen.' : 'Fehlt oder ist zu kurz.');
record('config.dev-login', env.ALLOW_DEV_LOGIN !== 'true' ? 'pass' : 'fail', env.ALLOW_DEV_LOGIN !== 'true' ? 'Entwicklungsanmeldung nicht aktiviert.' : 'Entwicklungsanmeldung ausdrücklich aktiviert.');
const stripeTest = env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
record('config.stripe-mode', (production ? !stripeTest && env.STRIPE_SECRET_KEY?.startsWith('sk_live_') : stripeTest) ? 'pass' : 'fail', stripeTest ? 'Stripe-Testmodus.' : 'Stripe-Live- oder unbekannter Modus.');

await check('database', async () => {
  if (!configured('DATABASE_URL')) return;
  const db = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 10, idle_timeout: 1, connection: {search_path:'public'} });
  try {
    const snapshot = await db.begin('read only', async tx => {
      await tx`SET LOCAL statement_timeout = '15000ms'`;
      const columns = await tx`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`;
      const has = (table, column) => columns.some(c => c.table_name === table && c.column_name === column);
      const required = [['reservations', 'request_hash'], ['reservations', 'checkout_params'], ['reservations', 'ticket_email_payload'], ['reservations', 'ticket_sent_at'], ['admin_auth', 'attempts'], ['security_rate_limits', 'reset_at']];
      const missing = required.filter(([table, column]) => !has(table, column)).map(([table, column]) => `${table}.${column}`);
      const enums = await tx`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid WHERE typname = 'reservation_status'`;
      if (!enums.some(v => v.enumlabel === 'payment_pending')) missing.push('reservation_status.payment_pending');
      record('database.schema', missing.length ? 'fail' : 'pass', missing.length ? `Fehlt: ${missing.join(', ')}.` : 'Erforderliche Sicherheitsfelder und Status vorhanden.');
      const [{ count: qrDuplicates }] = await tx`SELECT count(*)::int AS count FROM (SELECT qr_code_text FROM reservations WHERE qr_code_text IS NOT NULL GROUP BY qr_code_text HAVING count(*) > 1) d`;
      const [{ count: waitDuplicates }] = await tx`SELECT count(*)::int AS count FROM (SELECT event_id, lower(trim(email)) FROM waitlists GROUP BY event_id, lower(trim(email)) HAVING count(*) > 1) d`;
      record('database.duplicates', qrDuplicates + waitDuplicates ? 'fail' : 'pass', `${qrDuplicates} doppelte QR-Gruppen, ${waitDuplicates} doppelte Wartelisten-Gruppen.`);
      const unique = await tx`SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE 'CREATE UNIQUE%'`;
      const qrUnique = unique.some(i => i.tablename === 'reservations' && i.indexdef.includes('(qr_code_text)'));
      const waitUnique = unique.some(i => i.tablename === 'waitlists' && i.indexdef.includes('event_id') && i.indexdef.includes('lower('));
      record('database.uniqueness', qrUnique && waitUnique ? 'pass' : 'fail', `QR-Eindeutigkeit: ${qrUnique}; normalisierte Wartelisten-Eindeutigkeit: ${waitUnique}.`);
      const active = ['pending', 'payment_pending', 'paid', 'confirmed', 'checked_in'];
      const occupied = await tx`SELECT count(*)::int AS count FROM (SELECT r.event_id, r.reservation_date::date FROM reservations r JOIN events e ON e.id = r.event_id WHERE r.status::text = ANY(${active}) AND e.max_capacity > 0 GROUP BY r.event_id, r.reservation_date::date, e.max_capacity, e.walk_in_reserve HAVING sum(r.guest_count) > e.max_capacity - e.walk_in_reserve) d`;
      const tables = await tx`SELECT count(*)::int AS count FROM (SELECT r.table_id, r.reservation_date::date FROM reservations r JOIN tables t ON t.id = r.table_id WHERE r.status::text = ANY(${active}) GROUP BY r.table_id, r.reservation_date::date, t.capacity HAVING sum(r.guest_count) > t.capacity) d`;
      record('database.capacity', occupied[0].count + tables[0].count ? 'fail' : 'pass', `${occupied[0].count} überbuchte Eventtage, ${tables[0].count} überbuchte Tischtage.`);
      const states = await tx`SELECT status::text AS status, count(*)::int AS count FROM reservations GROUP BY status`;
      record('database.status', 'info', JSON.stringify(states));
      const [{ count: review }] = await tx`SELECT count(*)::int AS count FROM reservations WHERE status::text IN ('payment_review', 'disputed')`;
      record('database.payment-review', review ? 'fail' : 'pass', `${review} Zahlungen benötigen manuelle Klärung.`);
      if (has('reservations', 'checkout_params')) {
        const [{ count: legacy }] = await tx`SELECT count(*)::int AS count FROM reservations WHERE status::text = 'pending' AND stripe_session_id IS NULL AND checkout_params IS NULL`;
        record('database.legacy-holds', legacy ? 'fail' : 'pass', `${legacy} Holds ohne rekonstruierbare Zahlungszuordnung.`);
      }
      const [{ ledger }] = await tx`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS ledger`;
      record('database.migration-ledger', ledger ? 'pass' : 'fail', ledger ? 'Drizzle-Migrationsledger vorhanden.' : 'Kein Drizzle-Migrationsledger; vor Migration Baseline klären.');
      return { requiredSchemaPresent: missing.length === 0 };
    });
    return snapshot;
  } finally { await db.end({ timeout: 3 }); }
});

await check('stripe', async () => {
  if (!configured('STRIPE_SECRET_KEY')) return;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia', timeout: 10000, maxNetworkRetries: 0 });
  await stripe.accounts.retrieve();
  record('stripe.authentication', 'pass', 'Stripe-API akzeptiert den Schlüssel.');
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const expected = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired', 'charge.refunded', 'charge.dispute.created'];
  const match = endpoints.data.find(e => e.url === `${origin}/api/webhooks/stripe` && e.status === 'enabled');
  const missing = match ? expected.filter(type => !match.enabled_events.includes('*') && !match.enabled_events.includes(type)) : expected;
  record('stripe.webhook-subscription', match && !missing.length ? 'pass' : 'fail', match ? `Fehlende Ereignisse: ${missing.join(', ') || 'keine'}.` : 'Kein aktiver Webhook für das Prüfziel im konfigurierten Stripe-Modus.');
});
await check('resend', async () => {
  if (!configured('RESEND_API_KEY')) return;
  const response = await get('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
  if (!response.ok) { record('resend.sender-domain', 'blocked', `Domainprüfung nicht zugänglich (HTTP ${response.status}); möglicherweise Schlüssel nur für Versand.`); return; }
  const data = await response.json();
  const senderAddress = env.EMAIL_FROM || 'servus@maurer-events.com';
  const domain = senderAddress.match(/@([^>\s]+)>?$/)?.[1];
  const sender = data.data?.find(d => d.name === domain);
  record('resend.sender-domain', sender?.status === 'verified' ? 'pass' : 'fail', sender?.status === 'verified' ? `Absenderdomain ${domain} verifiziert.` : `Absenderdomain ${domain} nicht als verifiziert gefunden.`);
});

if (origin) {
  for (const route of ['/api/health', '/', '/en', '/admin', '/admin/login']) await check(`http.${route}`, async () => {
    const response = await get(`${origin}${route}`);
    const html = route === '/admin' || route === '/' || route === '/en' ? await response.text() : '';
    const login = route !== '/admin' || new URL(response.url).pathname.endsWith('/admin/login') || (html.includes('NEXT_REDIRECT') && html.includes('/admin/login'));
    record(`http.${route}`, response.status === 200 && login ? 'pass' : 'fail', `HTTP ${response.status}${route === '/admin' ? `; Login-Weiterleitung: ${login}` : ''}.`);
    if (route === '/' || route === '/en') {
      record(`http.render.${route}`, !html.includes('Da ist etwas schiefgelaufen.') ? 'pass' : 'fail', html.includes('Da ist etwas schiefgelaufen.') ? 'Serverfehleransicht trotz HTTP 200.' : 'Keine Serverfehleransicht erkannt; Hydrierung separat im Browser prüfen.');
    }
    if (route === '/api/health') record('http.health-cache', /no-store/.test(response.headers.get('cache-control') || '') ? 'pass' : 'fail', 'Readiness muss aktuellen Datenbankzustand ohne Cache melden.');
    if (route === '/') for (const [header, expectedValue] of [['x-frame-options', 'DENY'], ['x-content-type-options', 'nosniff'], ['referrer-policy', 'strict-origin-when-cross-origin']]) record(`http.header.${header}`, response.headers.get(header) === expectedValue ? 'pass' : 'fail', `Erwarteter Header ${expectedValue}.`);
  });
  for (const [id, route, init, status] of [
    ['cron-auth', '/api/cron/cleanup', {}, 401],
    ['webhook-signature', '/api/webhooks/stripe', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 'invalid' } }, 400],
    ['checkout-origin', '/api/checkout', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', Origin: 'https://invalid.example' } }, 403],
    ['checkout-input', '/api/checkout', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }, 400],
  ]) await check(`http.${id}`, async () => {
    const response = await get(`${origin}${route}`, init);
    record(`http.${id}`, response.status === status ? 'pass' : 'fail', `HTTP ${response.status}; erwartet ${status}.`);
  });
}
const report = { checkedAt: new Date().toISOString(), target: origin, mode: production ? 'production' : 'staging', scope: 'read-only', results };
await fs.mkdir('test-results', { recursive: true });
const reportPath = option('--out') || 'test-results/production-preflight.json';
if (path.resolve(reportPath) === path.resolve(envFile)) throw new Error('Report cannot overwrite environment file');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`Bericht: ${reportPath}`);
process.exitCode = results.some(r => r.status === 'fail' || r.status === 'blocked') ? 1 : 0;
