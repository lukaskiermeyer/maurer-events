// No dotenv, live DB, real Stripe requests or email delivery. This runner creates
// and drops ONLY its own randomly named database on a fixed loopback test port.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, after, before } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql, count } from 'drizzle-orm';
import type Stripe from 'stripe';
import * as schema from '../src/db/schema';
import type { db as appDb } from '../src/db';
import { createCheckoutService, parseCheckout } from '../src/lib/checkout';
import { getBookingConfirmation } from '../src/lib/booking-confirmation';
import { reservationAdmin } from '../src/lib/reservation-admin';
import { processReservationWebhook } from '../src/lib/stripe-webhook';
import { reconcileExpiredReservations } from '../src/lib/reservation-cleanup';
import { assertBookingWindow, bookingInstant, bookingPrice, calendarDate, BookingError } from '../src/lib/reservation-policy';
import { validateEventSettings } from '../src/lib/event-settings';
import { activeReservation, lockLayout } from '../src/lib/reservation-db';
import { takeRateLimit } from '../src/lib/rate-limit';
import { assertEventUpdate, validateEventUpdate } from '../src/lib/event-policy';
import { consumeAdminOtp } from '../src/lib/admin-otp';
import { isAdminEmail, otpHash } from '../src/lib/admin-identity';
import { assertStaffPermission, grantScannerAccess, revokeScannerAccess, resolveStaffAccess, staffSession, scanForStaff } from '../src/lib/staff-access';
import { deliverTicket } from '../src/lib/ticket-delivery';
import { boundedBody } from '../src/lib/request-body';
import { verifyTurnstile } from '../src/lib/turnstile';
import { enterWaitlist } from '../src/lib/waitlist';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import ReservationSection from '../src/components/ReservationSection';

const databaseName = `reservation_security_${randomUUID().replaceAll('-', '')}`;
const admin = postgres('postgres://reservation_test@127.0.0.1:55439/postgres', { max: 1, connect_timeout: 5 });
let client: ReturnType<typeof postgres>;
let connection: typeof appDb;
let created = false;
before(async () => {
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`); created = true;
  client = postgres(`postgres://reservation_test@127.0.0.1:55439/${databaseName}`, { max: 16, connect_timeout: 5 });
  connection = drizzle(client, { schema }) as unknown as typeof appDb;
  const journal = JSON.parse(await readFile('src/db/migrations/meta/_journal.json', 'utf8'));
  for (const entry of journal.entries) {
    const migration = await readFile(`src/db/migrations/${entry.tag}.sql`, 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement);
  }
});
after(async () => {
  if (client) await client.end();
  if (created) await admin.unsafe(`DROP DATABASE "${databaseName}"`);
  await admin.end();
});

async function fixture(options: { capacity?: number; full?: boolean; table?: boolean; maxBookings?: number } = {}) {
  const day = calendarDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [event] = await connection.insert(schema.events).values({ title: 'Security test', date: day, location: 'Test', description: 'Test', reservable: true, allowTableSelection: options.table ?? true, maxCapacity: options.capacity ?? 100 }).returning();
  await connection.insert(schema.eventSettings).values({ eventId: event.id, requireFullTable: options.full ?? false, maxBookingsPerEmail: options.maxBookings ?? 100 });
  const [table] = await connection.insert(schema.tables).values({ name: randomUUID(), capacity: options.capacity ?? 8 }).returning();
  const input = { eventId: event.id, tableId: event.allowTableSelection ? table.id : null, reservationDate: day.toISOString().slice(0, 10), selectedTime: '18:00', selectedPackage: 'brotzeit', guestCount: 1, name: 'Test Guest', email: `${randomUUID()}@example.com`, idempotencyKey: randomUUID(), turnstileToken: 'fake-test-captcha' };
  return { event, table, day, input };
}
function fakeStripe() {
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const keys = new Map<string, { params: string; session: Stripe.Checkout.Session }>();
  let loseResponse = false;
  const stripe = { checkout: { sessions: {
    async create(params: Stripe.Checkout.SessionCreateParams, options: { idempotencyKey: string }) {
      const previous = keys.get(options.idempotencyKey);
      if (previous) { assert.equal(JSON.stringify(params), previous.params); return previous.session; }
      if (params.expires_at <= Date.now() / 1000) throw Object.assign(new Error('Expired'), { type: 'StripeInvalidRequestError', param: 'expires_at' });
      const session = { id: `cs_${randomUUID()}`, client_reference_id: params.client_reference_id, metadata: params.metadata, mode: 'payment', currency: 'eur', payment_status: 'unpaid', status: 'open', amount_total: params.line_items.reduce((total, item) => total + item.quantity * item.price_data.unit_amount, 0), url: `https://checkout.stripe.com/${randomUUID()}` } as Stripe.Checkout.Session;
      keys.set(options.idempotencyKey, { params: JSON.stringify(params), session }); sessions.set(session.id, session);
      if (loseResponse) { loseResponse = false; throw new Error('Lost response after accepted payment request'); }
      return session;
    },
    async retrieve(id: string) { assert.ok(sessions.has(id)); return sessions.get(id); },
    async expire(id: string) { const session = sessions.get(id); session.status = 'expired'; return session; },
  } } } as unknown as Pick<Stripe, 'checkout'>;
  return { stripe, sessions, keys, loseNextResponse() { loseResponse = true; } };
}
const captcha = async () => {};
const webhook = (type = 'checkout.session.completed', id = randomUUID()) => ({ id, type }) as Stripe.Event;
const paidSession = (reservation: typeof schema.reservations.$inferSelect, overrides = {}) => ({ id: reservation.stripeSessionId || `cs_${randomUUID()}`, client_reference_id: reservation.id, metadata: { reservationId: reservation.id, requestHash: reservation.requestHash }, mode: 'payment', currency: 'eur', amount_total: reservation.amountTotal, status: 'complete', payment_status: 'paid', ...overrides }) as unknown as Stripe.Checkout.Session;
async function rows(eventId: string) { return connection.select().from(schema.reservations).where(eq(schema.reservations.eventId, eventId)); }
async function booked(f: Awaited<ReturnType<typeof fixture>>, extra: Partial<typeof schema.reservations.$inferInsert> = {}) {
  const [reservation] = await connection.insert(schema.reservations).values({ eventId: f.event.id, tableId: f.input.tableId, guestName: 'Test Guest', email: `${randomUUID()}@example.com`, guestCount: 1, reservationDate: f.day, status: 'pending', amountTotal: 2563, stripeSessionId: `cs_${randomUUID()}`, ...extra }).returning();
  return reservation;
}

test('Strict date, guest, UUID, time and cent validation', () => {
  for (const value of ['2026-02-30', '2026-2-01', '2026-01-01T00:00:00Z', null, 42]) assert.throws(() => calendarDate(value));
  assert.throws(() => bookingPrice(25.001, 1));
  assert.throws(() => parseCheckout(null));
  assert.throws(() => parseCheckout({ eventId: 'invalid', name: [], email: 'x', guestCount: 1 }));
  assert.deepEqual(bookingPrice(25, 8, 1000), { unitAmount: 2500, subtotal: 21000, fee: 340, total: 21340 });
});
test('German booking time respects summer, winter and DST ambiguity', () => {
  assert.equal(bookingInstant('2026-07-01', '18:00').toISOString(), '2026-07-01T16:00:00.000Z');
  assert.equal(bookingInstant('2026-12-01', '18:00').toISOString(), '2026-12-01T17:00:00.000Z');
  assert.throws(() => bookingInstant('2026-03-29', '02:30'));
  assert.throws(() => bookingInstant('2026-10-25', '02:30'));
  assert.doesNotThrow(() => assertBookingWindow(bookingInstant('2026-10-10', '18:00'), 90, 2, new Date('2026-10-10T12:00:00Z')));
});
test('Settings reject mass assignment, fractional cents and duplicate IDs', () => {
  assert.throws(() => validateEventSettings({ eventId: randomUUID() }));
  assert.throws(() => validateEventSettings({ maxBookingsPerEmail: 0 }));
  assert.throws(() => validateEventSettings({ timeSlots: ['18:00', '18:00 Uhr'] }));
  assert.throws(() => validateEventSettings({ packages: [{ id: 'x', name: 'X', description: '', price: 0.001 }] }));
});

test('Application queries use public schema when pooled search_path is empty', async () => {
  await connection.transaction(async tx => {
    await tx.execute(sql`SET LOCAL search_path = ''`);
    await tx.select().from(schema.events).limit(1);
    await tx.select().from(schema.galleries).limit(1);
    await tx.select().from(schema.reservations).limit(1);
    await tx.select().from(schema.adminAuth).limit(1);
  });
});
test('50 simultaneous bookings for 8 seats create exactly 8 holds', async () => {
  const f = await fixture({ capacity: 8 }); const fake = fakeStripe();
  const checkout = createCheckoutService(connection, fake.stripe, captcha);
  const results = await Promise.allSettled(Array.from({ length: 50 }, () => checkout({ ...f.input, email: `${randomUUID()}@example.com`, idempotencyKey: randomUUID() })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 8);
  assert.equal((await rows(f.event.id)).length, 8);
});
test('Concurrent full-table bookings have exactly one winner', async () => {
  const f = await fixture({ capacity: 8, full: true }); const fake = fakeStripe();
  const checkout = createCheckoutService(connection, fake.stripe, captcha);
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => checkout({ ...f.input, guestCount: 8, email: `${randomUUID()}@example.com`, idempotencyKey: randomUUID() })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});

test('Checkout returns to the booking confirmation in the selected language', async () => {
  for (const locale of [undefined, 'de', 'en']) {
    const f = await fixture({ table: false }); const fake = fakeStripe();
    await createCheckoutService(connection, fake.stripe, captcha)({ ...f.input, locale });
    const [reservation] = await rows(f.event.id);
    const url = new URL(reservation.checkoutParams.success_url as string);
    assert.equal(url.pathname, `${locale === 'en' ? '/en' : ''}/reservierung/erfolgreich`);
    assert.equal(url.searchParams.get('session_id'), '{CHECKOUT_SESSION_ID}');
  }
  const f = await fixture();
  assert.throws(() => parseCheckout({ ...f.input, locale: 'https://attacker.example' }), /Sprache/);
});

test('Booking confirmation relies on stored payment status and exposes no guest data', async () => {
  const f = await fixture();
  for (const status of ['pending', 'payment_pending', 'paid', 'confirmed', 'checked_in', 'payment_review', 'cancelled', 'expired', 'refunded', 'disputed'] as const) {
    const reservation = await booked(f, { status });
    const expected = ['paid', 'confirmed', 'checked_in'].includes(status) ? 'success'
      : ['pending', 'payment_pending'].includes(status) ? 'pending' : 'unavailable';
    assert.equal(await getBookingConfirmation(reservation.stripeSessionId, connection), expected);
  }
  for (const id of [undefined, '', true, ['cs_test_1234567890'], 'success=true', `cs_${randomUUID()}`]) {
    assert.equal(await getBookingConfirmation(id, connection), 'unavailable');
  }
});
test('20 duplicate requests produce a single reservation and Stripe session', async () => {
  const f = await fixture(); const fake = fakeStripe();
  const checkout = createCheckoutService(connection, fake.stripe, captcha);
  const results = await Promise.all(Array.from({ length: 20 }, () => checkout(f.input)));
  assert.equal(new Set(results.map(r => r.url)).size, 1);
  assert.equal((await rows(f.event.id)).length, 1); assert.equal(fake.keys.size, 1);
  await assert.rejects(checkout({ ...f.input, guestCount: 2 }), /anderen Anfrage/);
});
test('Email quota is atomic for bookings without table selection', async () => {
  const f = await fixture({ table: false, maxBookings: 2 }); const fake = fakeStripe();
  const checkout = createCheckoutService(connection, fake.stripe, captcha);
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => checkout({ ...f.input, idempotencyKey: randomUUID() })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
});
test('Lost Stripe response keeps the hold and retries frozen parameters', async () => {
  const f = await fixture(); const fake = fakeStripe(); fake.loseNextResponse();
  const checkout = createCheckoutService(connection, fake.stripe, captcha);
  await assert.rejects(checkout(f.input), /Zahlungsdienst/);
  assert.equal((await rows(f.event.id))[0].status, 'pending');
  await connection.update(schema.eventSettings).set({ packages: [{ id: 'brotzeit', name: 'Changed', price: 75, description: '' }] }).where(eq(schema.eventSettings.eventId, f.event.id));
  await checkout(f.input); assert.equal(fake.keys.size, 1); assert.equal((await rows(f.event.id)).length, 1);
});
test('Checked-in guests and un-reconciled expired holds block seats', async () => {
  const f = await fixture({ capacity: 2 }); await booked(f, { status: 'checked_in' }); await booked(f, { expiresAt: new Date(0) });
  await assert.rejects(createCheckoutService(connection, fakeStripe().stripe, captcha)(f.input), /Plätze/);
});
test('Physical table capacity is shared across events on the same day', async () => {
  const a = await fixture({ capacity: 1 }); const b = await fixture({ capacity: 1 });
  await booked(a, { status: 'paid' });
  await assert.rejects(createCheckoutService(connection, fakeStripe().stripe, captcha)({ ...b.input, tableId: a.table.id }), /Tisch/);
});
test('Reject unconfigured package/time and bypass of required table choice', async () => {
  const f = await fixture(); const checkout = createCheckoutService(connection, fakeStripe().stripe, captcha);
  await assert.rejects(checkout({ ...f.input, selectedPackage: 'cheap-fake' }), /Paket/);
  await assert.rejects(checkout({ ...f.input, selectedTime: '01:00' }), /Uhrzeit/);
  await assert.rejects(checkout({ ...f.input, tableId: null }), /Tisch/);
  await assert.rejects(checkout({ ...f.input, reservationDate: '2026-01-01' }), /Datum/);
});
test('Manual booking is capacity checked and idempotent', async () => {
  const f = await fixture({ capacity: 1 }); const service = reservationAdmin(connection);
  const input = { eventId: f.event.id, guestName: 'Manual Guest', email: 'manual@example.com', guestCount: 1, reservationDate: f.input.reservationDate, idempotencyKey: randomUUID() };
  const results = await Promise.all(Array.from({ length: 10 }, () => service.manual(input)));
  assert.equal(new Set(results.map(r => r.id)).size, 1);
  await assert.rejects(service.manual({ ...input, idempotencyKey: randomUUID() }), /Plätze/);
});
test('Concurrent manual creation and checkout respect the same event limit', async () => {
  const f = await fixture({ capacity: 1, table: false });
  const results = await Promise.allSettled([
    createCheckoutService(connection, fakeStripe().stripe, captcha)(f.input),
    reservationAdmin(connection).manual({ eventId: f.event.id, guestName: 'Manual Guest', email: 'mixed@example.com', guestCount: 1, reservationDate: f.input.reservationDate, idempotencyKey: randomUUID() }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('Table assignment is idempotent, shared capacity is summed and own row excluded', async () => {
  const f = await fixture({ capacity: 2 }); const service = reservationAdmin(connection);
  const first = await booked(f, { status: 'paid', tableId: null }); const second = await booked(f, { status: 'paid', tableId: null });
  await service.assign(first.id, f.table.id); await service.assign(first.id, f.table.id); await service.assign(second.id, f.table.id);
  assert.equal((await rows(f.event.id)).filter(r => r.tableId === f.table.id).length, 2);
});
test('Concurrent Webhook duplicates commit exactly one ledger entry', async () => {
  const f = await fixture(); const reservation = await booked(f); const event = webhook(); const session = paidSession(reservation);
  await Promise.all(Array.from({ length: 20 }, () => processReservationWebhook(connection, event, session)));
  assert.equal((await rows(f.event.id))[0].status, 'paid');
  const [ledger] = await connection.select({ count: count() }).from(schema.stripeEvents).where(eq(schema.stripeEvents.id, event.id)); assert.equal(ledger.count, 1);
});
test('Failed Webhook transaction leaves no ledger entry and can retry', async () => {
  const event = webhook(); const session = paidSession({ id: randomUUID(), stripeSessionId: null, amountTotal: 2563 } as typeof schema.reservations.$inferSelect);
  await assert.rejects(processReservationWebhook(connection, event, session));
  assert.equal((await connection.select().from(schema.stripeEvents).where(eq(schema.stripeEvents.id, event.id))).length, 0);
});
test('Webhook rejects another session and mismatched currency/amount', async () => {
  const f = await fixture(); const reservation = await booked(f);
  await processReservationWebhook(connection, webhook(), paidSession(reservation, { id: 'cs_other' }));
  assert.equal((await rows(f.event.id))[0].status, 'pending');
  await processReservationWebhook(connection, webhook(), paidSession(reservation, { currency: 'usd' }));
  assert.equal((await rows(f.event.id))[0].status, 'payment_review');
});
test('Late payment cannot overbook a formerly pending hold', async () => {
  const f = await fixture({ capacity: 1 }); const late = await booked(f, { status: 'expired' }); await booked(f, { status: 'checked_in' });
  await processReservationWebhook(connection, webhook(), paidSession(late));
  assert.equal((await rows(f.event.id)).find(r => r.id === late.id).status, 'payment_review');
});
test('Cancellation is never resurrected by a successful payment', async () => {
  const f = await fixture(); const reservation = await booked(f, { status: 'cancelled' });
  await processReservationWebhook(connection, webhook(), paidSession(reservation));
  assert.equal((await rows(f.event.id))[0].status, 'payment_review');
});
test('Asynchronous payment holds survive session expiry and settle to paid', async () => {
  const f = await fixture({ capacity: 1 }); const reservation = await booked(f);
  await processReservationWebhook(connection, webhook(), paidSession(reservation, { payment_status: 'unpaid' }));
  assert.equal((await rows(f.event.id))[0].status, 'payment_pending');
  await assert.rejects(createCheckoutService(connection, fakeStripe().stripe, captcha)(f.input), /Plätze/);
  await processReservationWebhook(connection, webhook('checkout.session.async_payment_succeeded'), paidSession(reservation));
  assert.equal((await rows(f.event.id))[0].status, 'paid');
});
test('Partial refunds keep ticket/capacity; complete refunds invalidate it', async () => {
  const f = await fixture(); const reservation = await booked(f, { status: 'confirmed', qrCodeText: randomUUID() });
  await processReservationWebhook(connection, webhook('charge.refunded'), paidSession(reservation), false);
  assert.equal((await rows(f.event.id))[0].status, 'confirmed');
  await processReservationWebhook(connection, webhook('charge.refunded'), paidSession(reservation), true);
  assert.equal((await rows(f.event.id))[0].status, 'refunded'); assert.equal((await rows(f.event.id))[0].qrCodeText, null);
});
test('Concurrent QR scans admit exactly once and reject ID fallback', async () => {
  const f = await fixture(); const reservation = await booked(f, { status: 'confirmed', qrCodeText: randomUUID() }); const service = reservationAdmin(connection);
  await assert.rejects(service.scan(reservation.id, f.event.id));
  const results = await Promise.allSettled(Array.from({ length: 15 }, () => service.scan(reservation.qrCodeText, f.event.id)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal((await rows(f.event.id))[0].status, 'checked_in');
});
test('Admin cannot mark an unpaid Stripe checkout as paid', async () => {
  const f = await fixture(); const reservation = await booked(f);
  await assert.rejects(reservationAdmin(connection).status(reservation.id, 'paid'), /Zahlungsdienst/);
});
test('Rate limit survives concurrent callers with exactly five winners', async () => {
  const key = randomUUID();
  const results = await Promise.all(Array.from({ length: 20 }, () => takeRateLimit(key, 5, 60000, connection)));
  assert.equal(results.filter(Boolean).length, 5);
});
test('Exclusive layout lock serializes against checkout and catches active holds', async () => {
  const f = await fixture(); const checkout = createCheckoutService(connection, fakeStripe().stripe, captcha);
  await checkout(f.input);
  await connection.transaction(async tx => {
    await lockLayout(tx, true);
    const [active] = await tx.select().from(schema.reservations).where(sql`${schema.reservations.tableId} = ${f.table.id} AND ${activeReservation()}`);
    assert.ok(active);
  });
});
test('Cleanup recovers lost session response and expires only provider-confirmed holds', async () => {
  const f = await fixture(); const fake = fakeStripe(); fake.loseNextResponse();
  await assert.rejects(createCheckoutService(connection, fake.stripe, captcha)(f.input));
  await connection.update(schema.reservations).set({ expiresAt: new Date(0) }).where(eq(schema.reservations.eventId, f.event.id));
  await reconcileExpiredReservations(connection, fake.stripe);
  assert.equal((await rows(f.event.id))[0].status, 'expired'); assert.equal(fake.keys.size, 1);
});

test('Event updates cannot remove booked days, change IDs, or reduce occupied capacity', async () => {
  const f = await fixture({ capacity: 2 }); await booked(f, { guestCount: 2, status: 'paid' });
  assert.throws(() => validateEventUpdate({ id: randomUUID() }));
  await assert.rejects(connection.transaction(tx => assertEventUpdate(tx, f.event, { maxCapacity: 1 })), /Kapazität/);
  await assert.rejects(connection.transaction(tx => assertEventUpdate(tx, f.event, { reservableDates: ['2026-01-01'] })), /Datum/);
});
test('Full-table policy changes preserve previously shared paid allocations', async () => {
  const f = await fixture({ capacity: 2 }); const first = await booked(f, { status: 'paid' }); await booked(f, { status: 'paid' });
  await connection.update(schema.eventSettings).set({ requireFullTable: true }).where(eq(schema.eventSettings.eventId, f.event.id));
  assert.equal((await reservationAdmin(connection).status(first.id, 'confirmed')).status, 'confirmed');
});
test('Failed asynchronous payments release hold; old expiry events cannot regress a paid ticket', async () => {
  const f = await fixture(); const reservation = await booked(f, { status: 'payment_pending' });
  await processReservationWebhook(connection, webhook('checkout.session.async_payment_failed'), paidSession(reservation, { payment_status: 'unpaid' }));
  assert.equal((await rows(f.event.id))[0].status, 'cancelled');
  await processReservationWebhook(connection, webhook('checkout.session.completed'), paidSession(reservation, { payment_status: 'unpaid' }));
  assert.equal((await rows(f.event.id))[0].status, 'cancelled');
  await processReservationWebhook(connection, webhook('checkout.session.async_payment_succeeded'), paidSession(reservation));
  await processReservationWebhook(connection, webhook('checkout.session.expired'), paidSession(reservation));
  assert.equal((await rows(f.event.id))[0].status, 'payment_review');
});
test('Cleanup reconciles asynchronous settlement after a lost webhook', async () => {
  const f = await fixture(); const reservation = await booked(f, { status: 'payment_pending', updatedAt: new Date(0) });
  const session = paidSession(reservation);
  const stripe = { checkout: { sessions: { async retrieve() { return session; } } } } as unknown as Pick<Stripe, 'checkout'>;
  await reconcileExpiredReservations(connection, stripe);
  assert.equal((await rows(f.event.id))[0].status, 'paid');
});
test('Cancel/QR scan race cannot admit more than once or restore a cancellation', async () => {
  const f = await fixture(); const r = await booked(f, { status: 'confirmed', qrCodeText: randomUUID() }); const service = reservationAdmin(connection);
  const results = await Promise.allSettled([service.scan(r.qrCodeText, f.event.id), service.status(r.id, 'cancelled')]);
  assert.ok(['cancelled', 'checked_in'].includes((await rows(f.event.id))[0].status));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
});
test('OTP is hashed, consumed once and limits wrong attempts atomically', async () => {
  const previous = { admins: process.env.ADMIN_EMAILS, secret: process.env.AUTH_SECRET };
  process.env.ADMIN_EMAILS = 'admin@example.com'; process.env.AUTH_SECRET = 'a'.repeat(64);
  try {
    const email = 'admin@example.com'; const hash = otpHash(email, '123456'); assert.notEqual(hash, '123456');
    await connection.insert(schema.adminAuth).values({ email, otpCode: hash, expiresAt: new Date(Date.now() + 60000) });
    const results = await Promise.all(Array.from({ length: 15 }, () => consumeAdminOtp(connection, email, '123456')));
    assert.equal(results.filter(Boolean).length, 1);
    await connection.insert(schema.adminAuth).values({ email, otpCode: hash, expiresAt: new Date(Date.now() + 60000) });
    await Promise.all(Array.from({ length: 15 }, () => consumeAdminOtp(connection, email, '000000')));
    assert.equal(await consumeAdminOtp(connection, email, '123456'), null);
    assert.equal((await connection.select().from(schema.adminAuth).where(eq(schema.adminAuth.email, email)))[0].attempts, 5);
    process.env.ADMIN_EMAILS = 'another@example.com'; assert.equal(isAdminEmail(email), false);
  } finally {
    if (previous.admins === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = previous.admins;
    if (previous.secret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previous.secret;
  }
});
test('Ticket retry keeps identical PDF/email payload and marks provider errors unsent', async () => {
  const f = await fixture(); const r = await booked(f, { status: 'confirmed', qrCodeText: randomUUID() });
  const deliveries: string[] = []; const sender = async (payload: unknown) => { deliveries.push(JSON.stringify(payload)); return { error: deliveries.length === 1 ? { name: 'unavailable' } : null }; };
  assert.ok(await deliverTicket(r.id, connection, sender));
  assert.equal((await rows(f.event.id))[0].ticketSentAt, null);
  assert.equal(await deliverTicket(r.id, connection, sender), undefined);
  assert.equal(deliveries.length, 2); assert.equal(deliveries[0], deliveries[1]);
  await deliverTicket(r.id, connection, sender); assert.equal(deliveries.length, 2);
});

test('Scanner role signs in with one-use OTP but cannot manage events or scan another event', async () => {
  const previous = { admins: process.env.ADMIN_EMAILS, secret: process.env.AUTH_SECRET };
  process.env.ADMIN_EMAILS = 'owner@example.com'; process.env.AUTH_SECRET = 'a'.repeat(64);
  try {
    const f = await fixture(); const other = await fixture();
    const owner = { email: 'owner@example.com', role: 'admin' as const, eventIds: [] };
    const email = 'helper@example.com';
    await grantScannerAccess(connection, owner, { eventId: f.event.id, email: ' HELPER@example.com ', validUntil: new Date(Date.now() + 86400000).toISOString() });
    const helper = await resolveStaffAccess(connection, email); assert.ok(helper); assert.equal(helper.role, 'scanner');
    assert.throws(() => assertStaffPermission(helper, 'admin'));
    assert.throws(() => assertStaffPermission(helper, 'scan', other.event.id));
    await assert.rejects(grantScannerAccess(connection, helper, { eventId: f.event.id, email: 'new@example.com', validUntil: new Date(Date.now() + 86400000).toISOString() }));
    await connection.insert(schema.adminAuth).values({ email, otpCode: otpHash(email, '123456'), expiresAt: new Date(Date.now() + 60000) });
    const session = await consumeAdminOtp(connection, email, '123456'); assert.ok(session);
    assert.equal((await staffSession(connection, session.id))?.role, 'scanner');
    assert.equal(await consumeAdminOtp(connection, email, '123456'), null);
    const allowed = await booked(f, { status: 'confirmed', qrCodeText: randomUUID() });
    const denied = await booked(other, { status: 'confirmed', qrCodeText: randomUUID() });
    await assert.rejects(scanForStaff(connection, helper, denied.qrCodeText!));
    assert.equal((await rows(other.event.id))[0].status, 'confirmed');
    await scanForStaff(connection, helper, allowed.qrCodeText!);
    await assert.rejects(scanForStaff(connection, helper, allowed.qrCodeText!));
    const [grant] = await connection.select().from(schema.scannerAccess).where(eq(schema.scannerAccess.email, email));
    await revokeScannerAccess(connection, owner, f.event.id, grant.id);
    assert.equal(await staffSession(connection, session.id), null);
    const unscanned = await booked(f, { status: 'confirmed', qrCodeText: randomUUID() });
    await assert.rejects(scanForStaff(connection, helper, unscanned.qrCodeText!));
    assert.equal((await connection.select().from(schema.reservations).where(eq(schema.reservations.id, unscanned.id)))[0].status, 'confirmed');
  } finally {
    if (previous.admins === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = previous.admins;
    if (previous.secret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previous.secret;
  }
});

test('Expired scanner access, deleted events and expired sessions fail closed', async () => {
  const f = await fixture(); const email = `${randomUUID()}@example.com`;
  await connection.insert(schema.scannerAccess).values({ eventId: f.event.id, email, createdBy: 'owner@example.com', validUntil: new Date(Date.now() - 1000) });
  assert.equal(await resolveStaffAccess(connection, email), null);
  await connection.update(schema.scannerAccess).set({ validUntil: new Date(Date.now() + 86400000) }).where(eq(schema.scannerAccess.email, email));
  const [expired] = await connection.insert(schema.adminSessions).values({ email, validUntil: new Date(Date.now() - 1000) }).returning();
  assert.equal(await staffSession(connection, expired.id), null);
  await connection.update(schema.events).set({ deletedAt: new Date() }).where(eq(schema.events.id, f.event.id));
  assert.equal(await resolveStaffAccess(connection, email), null);
});
test('Moving a confirmed reservation rotates and invalidates the old ticket code', async () => {
  const f = await fixture(); const r = await booked(f, { status: 'confirmed', qrCodeText: randomUUID() });
  await reservationAdmin(connection).assign(r.id, null);
  assert.notEqual((await rows(f.event.id))[0].qrCodeText, r.qrCodeText);
  await assert.rejects(reservationAdmin(connection).scan(r.qrCodeText, f.event.id));
});
test('Bound request streams before parsing, including absent content-length', async () => {
  assert.equal(await boundedBody(new Request('http://localhost', { method: 'POST', body: '{}' }), 16), '{}');
  await assert.rejects(boundedBody(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(17) }), 16), /groß/);
});
test('Turnstile verifies hostname/action and fails closed on service errors', async () => {
  const previousFetch = globalThis.fetch; const previousSecret = process.env.TURNSTILE_SECRET_KEY; const previousUrl = process.env.NEXT_PUBLIC_BASE_URL;
  process.env.TURNSTILE_SECRET_KEY = 'test'; process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.com';
  try {
    const reason = (code: string) => (error: unknown) => error instanceof BookingError && error.code === code;
    globalThis.fetch = async () => Response.json({ success: true, hostname: 'test.example.com', action: 'checkout' });
    await verifyTurnstile('test', 'checkout');
    await assert.rejects(verifyTurnstile('test', 'admin-login'), reason('captcha-action-mismatch'));
    globalThis.fetch = async () => Response.json({ success: true, hostname: 'attacker.example.com', action: 'checkout' });
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-hostname-mismatch'));
    globalThis.fetch = async () => { throw new Error('Network unavailable'); };
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-service-network'));
    globalThis.fetch = async () => { throw new Error('Secret must not appear', { cause: { code: 'ENOTFOUND' } }); };
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-service-network-ENOTFOUND'));
    globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-service-timeout'));
    globalThis.fetch = async () => new Response('Service unavailable', { status: 503 });
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-service-http-503'));
    globalThis.fetch = async () => new Response('invalid JSON');
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-response-invalid'));
    globalThis.fetch = async () => Response.json(null);
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-response-invalid'));
    globalThis.fetch = async () => Response.json({ success: false, 'error-codes': ['invalid-input-secret'] });
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-secret-invalid'));
    process.env.NEXT_PUBLIC_BASE_URL = 'invalid-url';
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-url-invalid'));
    delete process.env.TURNSTILE_SECRET_KEY;
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-secret-missing'));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = previousSecret;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL; else process.env.NEXT_PUBLIC_BASE_URL = previousUrl;
  }
});
test('Parallel waitlist requests are unique and cannot overwrite another guest', async () => {
  const f = await fixture();
  const data = { eventId: f.event.id, name: 'First Guest', email: ' Unique@example.com ', guestCount: 2 };
  await Promise.all(Array.from({ length: 15 }, () => enterWaitlist(connection, data)));
  await enterWaitlist(connection, { ...data, name: 'Impersonator', email: 'unique@example.com', guestCount: 99 });
  const entries = await connection.select().from(schema.waitlists).where(eq(schema.waitlists.eventId, f.event.id));
  assert.equal(entries.length, 1); assert.equal(entries[0].name, 'First Guest'); assert.equal(entries[0].guestCount, 2);
  await assert.rejects(enterWaitlist(connection, { ...data, guestCount: -1 }));
});
test('Stripe failure during cleanup keeps inventory unavailable', async () => {
  const f = await fixture({ capacity: 1 }); const r = await booked(f, { expiresAt: new Date(0) });
  const unavailable = { checkout: { sessions: { async retrieve() { throw new Error('Network failure'); } } } } as unknown as Pick<Stripe, 'checkout'>;
  await reconcileExpiredReservations(connection, unavailable);
  assert.equal((await rows(f.event.id)).find(row => row.id === r.id).status, 'pending');
  await assert.rejects(createCheckoutService(connection, fakeStripe().stripe, captcha)(f.input), /Plätze/);
});
test('Payment before session-ID persistence is matched to frozen request metadata', async () => {
  const f = await fixture(); const fake = fakeStripe(); fake.loseNextResponse();
  await assert.rejects(createCheckoutService(connection, fake.stripe, captcha)(f.input));
  const reservation = (await rows(f.event.id))[0]; const session = [...fake.sessions.values()][0];
  await processReservationWebhook(connection, webhook(), { ...session, status: 'complete', payment_status: 'paid', metadata: { reservationId: reservation.id, requestHash: 'wrong' } });
  assert.equal((await rows(f.event.id))[0].status, 'pending');
  await processReservationWebhook(connection, webhook(), { ...session, status: 'complete', payment_status: 'paid' });
  assert.equal((await rows(f.event.id))[0].status, 'paid');
});
test('Concurrent ticket sends reuse a single frozen payload and provider key', async () => {
  const f = await fixture(); const reservation = await booked(f, { status: 'confirmed', qrCodeText: randomUUID() });
  const payloads = new Set<string>(); const keys = new Set<string>();
  await Promise.all(Array.from({ length: 4 }, () => deliverTicket(reservation.id, connection, async (payload, key) => {
    payloads.add(JSON.stringify(payload)); keys.add(key); return { error: null };
  })));
  assert.equal(payloads.size, 1); assert.equal(keys.size, 1);
});
test('A new event cannot share a physical table reserved by an exclusive event', async () => {
  const exclusive = await fixture({ full: true, capacity: 8 }); const shared = await fixture({ full: false, capacity: 8 });
  // Admin-assigned partial group on an exclusive event reserves the whole table.
  await booked(exclusive, { guestCount: 1, status: 'paid' });
  await assert.rejects(createCheckoutService(connection, fakeStripe().stripe, captcha)({ ...shared.input, tableId: exclusive.table.id }), /reserviert/);
});
test('A confirmed expiry permits a new attempt, and the old key never creates another session', async () => {
  const f = await fixture(); const fake = fakeStripe(); const checkout = createCheckoutService(connection, fake.stripe, captcha);
  await checkout(f.input);
  const [reservation] = await rows(f.event.id);
  await connection.update(schema.reservations).set({ status: 'expired' }).where(eq(schema.reservations.id, reservation.id));
  await assert.rejects(checkout(f.input), error => error instanceof Error && (error as { code?: string }).code === 'new_attempt_allowed');
  await checkout({ ...f.input, idempotencyKey: randomUUID() });
  assert.equal(fake.keys.size, 2);
});
test('Reservation wizard renders single-day events with actual RSC Date values', async () => {
  const messages = JSON.parse(await readFile('messages/de.json', 'utf8'));
  // The provider declares children as required, so React's createElement overload
  // requires it in props even though JSX ordinarily supplies it implicitly.
  for (const table of [false, true]) {
    const f = await fixture({ table });
    // eslint-disable-next-line react/no-children-prop
    const html = renderToString(createElement(NextIntlClientProvider, { locale: 'de', messages, timeZone: 'Europe/Berlin', now: new Date(), children:
      createElement(ReservationSection, { initialEvents: [f.event], initialSelectedEvent: f.event.id }) }));
    assert.ok(html.includes('reservation-wizard'));
    assert.ok(html.includes('Weiter'));
    assert.ok(!html.includes('Uhrzeit ist wegen'));
    assert.ok(html.replaceAll('<!-- -->', '').includes(`${table ? 10 : 1} Personen`));
  }
});
