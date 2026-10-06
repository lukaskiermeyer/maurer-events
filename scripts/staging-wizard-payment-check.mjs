// Read-only check of the operator's real browser test payment on the dedicated fixture.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
import Stripe from 'stripe';

const env = dotenv.parse(await fs.readFile('.env.local'));
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Staging test mode required');
const fixture = JSON.parse(await fs.readFile('test-results/staging-provider-fixture.json', 'utf8'));
const db = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 10 });
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia', timeout: 10000, maxNetworkRetries: 0 });
try {
  const reservations = await db`SELECT id,status::text,selected_time,guest_count,amount_total,stripe_session_id,qr_code_text,ticket_sent_at,created_at
    FROM public.reservations WHERE event_id=${fixture.eventId} AND id<>${fixture.reservationId} AND lower(trim(email))='hello@madebylui.net' ORDER BY created_at DESC LIMIT 10`;
  const results = [];
  for (const row of reservations) {
    const session = row.stripe_session_id ? await stripe.checkout.sessions.retrieve(row.stripe_session_id) : null;
    const events = session ? await stripe.events.list({ type: 'checkout.session.completed', limit: 100 }) : { data: [] };
    const event = events.data.find(item => item.data.object.id === session.id);
    const [{ count }] = event ? await db`SELECT count(*)::int AS count FROM public.stripe_events WHERE id=${event.id}` : [{ count: 0 }];
    results.push({ reservationId: row.id, applicationStatus: row.status, time: row.selected_time, guests: row.guest_count, totalCents: row.amount_total,
      stripeStatus: session?.status, stripePayment: session?.payment_status, test: session ? !session.livemode : undefined,
      ticketIssued: !!row.qr_code_text, ticketSent: !!row.ticket_sent_at, realCompletedEventRecorded: count === 1 });
  }
  const report = { checkedAt: new Date().toISOString(), eventId: fixture.eventId, scope: 'read-only provider/database follow-up to operator wizard test', results };
  await fs.writeFile('test-results/staging-wizard-payment.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.end({ timeout: 3 }); }
