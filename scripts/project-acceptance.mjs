// Local, disposable application acceptance. Never loads provider credentials.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import postgres from 'postgres';
import dotenv from 'dotenv';
import net from 'node:net';

const database = `project_acceptance_${randomUUID().replaceAll('-', '')}`;
const admin = postgres('postgres://reservation_test@127.0.0.1:55439/postgres', { max: 1, connect_timeout: 5 });
const portProbe = net.createServer();
await new Promise((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(0, 'localhost', resolve); });
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const origin = `http://localhost:${port}`;
const dir = 'test-results/project-acceptance';
await fs.mkdir(dir, { recursive: true });
const localNames = Object.keys(dotenv.parse(await fs.readFile('.env.local').catch(() => '')));
const env = {
  ...process.env,
  ...Object.fromEntries(localNames.map(name => [name, ''])),
  DATABASE_URL: `postgres://reservation_test@127.0.0.1:55439/${database}`,
  NODE_ENV: 'production', PORT: String(port), HOSTNAME: 'localhost',
  NEXT_PUBLIC_BASE_URL: origin, ALLOW_DEV_LOGIN: 'false',
  ADMIN_EMAILS: 'admin@example.com', AUTH_SECRET: randomUUID(), CRON_SECRET: randomUUID(),
  STRIPE_SECRET_KEY: 'sk_test_local_acceptance_only', STRIPE_WEBHOOK_SECRET: 'whsec_local_acceptance_only',
  RESEND_API_KEY: '', CLOUDINARY_API_SECRET: '', TURNSTILE_SECRET_KEY: '', GEMINI_API_KEY: '',
  ACCEPTANCE_URL: origin, ACCEPTANCE_REPORT: `${dir}/browser-report.json`, ACCEPTANCE_ARTIFACTS: `${dir}/browser`,
  FORCE_COLOR: '0',
};
// Captured logs need no ANSI colors; avoid conflicting inherited color flags.
delete env.NO_COLOR;
let created = false, client, server, serverClosed;
const results = [];
async function run(name, args) {
  const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const log = createWriteStream(`${dir}/${name}.log`);
  child.stdout.pipe(log); child.stderr.pipe(log);
  const [code] = await once(child, 'close');
  log.end();
  if (code !== 0) throw new Error(`${name} failed; see ${dir}/${name}.log`);
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
try {
  // Never silently test a different, already running application.
  try {
    await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
    throw new Error('Acceptance port is in use. Retry with a new free port.');
  } catch (error) { if (error.message.includes('Acceptance port')) throw error; }
  await admin.unsafe(`CREATE DATABASE "${database}"`); created = true;
  client = postgres(env.DATABASE_URL, { max: 1 });
  await run('migrations-fresh', ['scripts/db-migrate.mjs']);
  await run('migrations-repeat', ['scripts/db-migrate.mjs']);
  const [{ count }] = await client`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
  if (count !== 9) throw new Error('Unexpected migration ledger.');
  const eventId = randomUUID(), albumId = randomUUID(), adminToken = randomUUID();
  const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await client`INSERT INTO public.events (id,title,date,location,description,reservable,allow_table_selection,max_capacity,reservable_dates)
    VALUES (${eventId},'Abnahme Sommerfest',${day},'Testzelt','Veranstaltung für die lokale Projektabnahme.',true,true,100,${JSON.stringify([day])})`;
  await client`INSERT INTO public.events (id,title,date,location,description,type,image_url)
    VALUES (${albumId},'Abnahme Galerie','2025-08-01','Testzelt','Galerie für die lokale Projektabnahme.','gallery','/maennchen.svg')`;
  await client`INSERT INTO public.galleries (event_id,image_url) VALUES (${albumId},'/maennchen.svg'),(${albumId},'/Logo.png')`;
  await client`INSERT INTO public.tables (name,capacity,position_x,position_y) VALUES ('Tisch 1',8,0,0),('Tisch 2',10,1,0)`;
  await client`INSERT INTO public.waitlists (event_id,name,email,guest_count) VALUES
    (${eventId},'Alexandra Beispiel','alexandra.beispiel.mit.langer.adresse@example.com',8)`;
  await client`INSERT INTO public.reservations (event_id,reservation_date,guest_name,email,guest_count,selected_time,amount_total,status) VALUES
    (${eventId},${day},'Bestätigter Gast','confirmed@example.com',3,'18:00',7500,'confirmed'),
    (${eventId},${day},'Eingecheckter Gast','checked-in@example.com',2,'18:00',5000,'checked_in'),
    (${eventId},${day},'Stornierter Gast','cancelled@example.com',8,'18:00',20000,'cancelled')`;
  await client`INSERT INTO public.admin_sessions (id,email,valid_until) VALUES (${adminToken},'admin@example.com',NOW() + INTERVAL '1 hour')`;
  Object.assign(env, { ACCEPTANCE_EVENT_ID: eventId, ACCEPTANCE_ALBUM_ID: albumId, ACCEPTANCE_ADMIN_TOKEN: adminToken });
  await fs.cp('public', '.next/standalone/public', { recursive: true });
  await fs.cp('.next/static', '.next/standalone/.next/static', { recursive: true });
  // Mirror the Docker runtime tooling to check tracing and migration imports.
  await fs.cp('node_modules/drizzle-orm', '.next/standalone/node_modules/drizzle-orm', { recursive: true });
  await fs.cp('src/db/migrations', '.next/standalone/src/db/migrations', { recursive: true });
  await fs.mkdir('.next/standalone/scripts', { recursive: true });
  await fs.copyFile('scripts/db-migrate.mjs', '.next/standalone/scripts/db-migrate.mjs');
  await run('migrations-standalone', ['.next/standalone/scripts/db-migrate.mjs']);
  const log = createWriteStream(`${dir}/server.log`);
  server = spawn(process.execPath, ['.next/standalone/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  server.stdout.pipe(log); server.stderr.pipe(log);
  serverClosed = once(server, 'close');
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('Application exited before readiness.');
    try { if ((await fetch(`${origin}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Application did not become ready; see ${dir}/server.log`);
  await run('browser', ['node_modules/@playwright/test/cli.js', 'test']);
  await run('admin-roles', ['scripts/admin-role-browser-check.mjs', '--confirmed-test-database']);
  await run('booking-components', ['scripts/booking-browser-check.mjs', `--app-origin=${origin}`]);
  await run('image-upload', ['scripts/image-upload-browser-check.mjs']);
  await client`ALTER TABLE public.scanner_access RENAME TO acceptance_missing_scanner_access`;
  try {
    const response = await fetch(`${origin}/api/health`);
    if (response.status !== 503 || !response.headers.get('cache-control')?.includes('no-store')) throw new Error('Missing schema was reported healthy.');
    results.push({ name: 'readiness-fails-with-missing-schema', passed: true });
  } finally { await client`ALTER TABLE public.acceptance_missing_scanner_access RENAME TO scanner_access`; }
  if (!(await fetch(`${origin}/api/health`)).ok) throw new Error('Readiness did not recover.');
  results.push({ name: 'readiness-recovers', passed: true });
} catch (error) {
  results.push({ name: 'acceptance', passed: false, error: error.message });
  console.error(error.message); process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) { server.kill(); await serverClosed; }
  await client?.end({ timeout: 5 });
  if (created) await admin.unsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
  await fs.writeFile(`${dir}/report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), target: origin, scope: 'Disposable local PostgreSQL; production standalone; no external writes, mail or payment', results }, null, 2));
}
