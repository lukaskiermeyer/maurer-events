import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
const env = dotenv.parse(await fs.readFile('.env.local'));
const db = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const domains = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(10000) }).then(r => r.json());
  console.log('Resend domains:', JSON.stringify(domains.data?.map(d => ({ name: d.name, status: d.status })) || []));
  console.log('Test email is admin:', (env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).includes('hello@madebylui.net'));
  const schema = await db`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`;
  console.log('Search path:',JSON.stringify(await db`SHOW search_path`));
  console.log('Role/database settings:',JSON.stringify(await db`SELECT setconfig FROM pg_db_role_setting WHERE setdatabase IN (0,(SELECT oid FROM pg_database WHERE datname=current_database())) AND setrole IN (0,(SELECT oid FROM pg_roles WHERE rolname=current_user))`));
  try {await db`SELECT 1 FROM public.events LIMIT 1`;console.log('Qualified event query: OK')}catch(error){console.log('Qualified event query:',error.code)}
  await fs.mkdir('test-results', { recursive: true });
  await fs.writeFile('test-results/staging-schema-before.json', JSON.stringify(schema, null, 2));
  const baseline = JSON.parse(await fs.readFile('src/db/migrations/meta/0003_snapshot.json','utf8'));
  const constraints = await db`SELECT c.conname,c.contype,c.confdeltype,t.relname AS table_name FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'`;
  for (const table of Object.values(baseline.tables)) {
    const missing=Object.values(table.columns).filter(c=>!schema.some(s=>s.table_name===table.name&&s.column_name===c.name)).map(c=>c.name);
    const missingConstraints=[...Object.keys(table.uniqueConstraints),...Object.keys(table.checkConstraints),...Object.keys(table.foreignKeys)].filter(n=>!constraints.some(c=>c.table_name===table.name&&c.conname===n));
    if(missing.length||missingConstraints.length)console.log('Baseline drift:',JSON.stringify({table:table.name,missing,missingConstraints}));
  }
  console.log('Existing tables:', [...new Set(schema.map(r=>r.table_name))].join(', '));
  for (const route of ['/', '/de', '/en', '/admin', '/admin/login', '/api/health', '/agb', '/widerruf']) {
    const response = await fetch(`https://maurer-events.madebylui.net${route}`, {redirect:'follow',signal:AbortSignal.timeout(10000)});
    console.log(route, response.status, new URL(response.url).pathname);
  }
} finally { await db.end({timeout:3}); }
