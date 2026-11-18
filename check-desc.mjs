import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const r = await s`SELECT id, title, description FROM events WHERE description IS NOT NULL ORDER BY created_at DESC LIMIT 3`;
  for (const e of r) {
    console.log('===', e.title);
    console.log(JSON.stringify(e.description));
  }
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await s.end();
}