// Creates/reuses one dedicated staging event for table selection and waitlist UI.
// No payment, email or existing event/table changes.
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import postgres from 'postgres';
const env = dotenv.parse(await fs.readFile('.env.local'));
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Staging test mode required');
const db = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 10 });
const path = 'test-results/staging-table-fixture.json';
try {
  const saved = await fs.readFile(path, 'utf8').then(JSON.parse).catch(() => null);
  if (saved) {
    const [event] = await db`SELECT id FROM public.events WHERE id=${saved.eventId} AND title='Produktionsabnahme – Tischwahl und Warteliste'`;
    if (!event) throw new Error('Existing fixture no longer matches');
    console.log(JSON.stringify({ url: `${env.NEXT_PUBLIC_BASE_URL}/termine/${saved.eventId}`, table: saved.tableName, capacity: saved.capacity }));
  } else {
    const day = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
    const [table] = await db`SELECT t.id,t.name,t.capacity FROM public.tables t WHERE t.capacity>0 AND NOT EXISTS (
      SELECT 1 FROM public.reservations r WHERE r.table_id=t.id AND r.reservation_date::date=${day}::date AND r.status::text IN ('pending','payment_pending','paid','confirmed','checked_in')
    ) ORDER BY t.capacity,t.name LIMIT 1`;
    if (!table) throw new Error('No free table for dedicated fixture day');
    const id = randomUUID();
    await db.begin(async tx => {
      await tx`INSERT INTO public.events (id,title,date,location,description,reservable,allow_table_selection,max_capacity)
        VALUES (${id},'Produktionsabnahme – Tischwahl und Warteliste',${day}::date,'Staging','Dediziertes Testevent für Tischwahl und Warteliste.',true,true,100)`;
      await tx`INSERT INTO public.event_settings (event_id,require_full_table,max_bookings_per_email) VALUES (${id},true,10)`;
    });
    const fixture = { eventId: id, day, tableId: table.id, tableName: table.name, capacity: table.capacity };
    await fs.writeFile(path, JSON.stringify(fixture, null, 2));
    console.log(JSON.stringify({ url: `${env.NEXT_PUBLIC_BASE_URL}/termine/${id}`, table: table.name, capacity: table.capacity }));
  }
} finally { await db.end({ timeout: 3 }); }
