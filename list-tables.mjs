import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const r = await s`SELECT id, name, capacity, section, row_label, display_number FROM tables ORDER BY name LIMIT 20`;
  console.log('TABLES (first 20)', JSON.stringify(r, null, 2));
  const c = await s`SELECT count(*)::int AS c FROM tables`;
  console.log('TOTAL', JSON.stringify(c));
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await s.end();
}