import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const url = process.env.DATABASE_URL;
const s = postgres(url, { max: 1, connect_timeout: 10 });
try {
  const r = await s`SELECT id, title, date, reservation_mode, reservable, deleted_at FROM events ORDER BY date`;
  console.log('ALL EVENTS', JSON.stringify(r, null, 2));
  const t = await s`SELECT count(*)::int AS c, status FROM reservations GROUP BY status`;
  console.log('RESERVATIONS BY STATUS', JSON.stringify(t));
  const tabs = await s`SELECT count(*)::int AS c FROM tables`;
  console.log('TABLES', JSON.stringify(tabs));
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await s.end();
}