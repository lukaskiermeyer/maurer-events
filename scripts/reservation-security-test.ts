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
import { reservationBadge, reservationMailto, reservationStatusLabel, resolveReservationMode } from '../src/lib/reservation-mode';
import { packageTax } from '../src/lib/pricing';
import { redeemVoucher } from '../src/lib/vouchers';
import { mapImportRows, normalizeEmail, normalizePhone, parseCsv } from '../src/lib/customer-import';
import { ensureCustomerForReservation, linkReservationCustomer } from '../src/lib/customers';
import { hashPassword, verifyPassword, hashToken, randomToken } from '../src/lib/staff-auth';
import { decryptField, encryptField, maskField } from '../src/lib/secure-fields';
import { renderContract } from '../src/lib/contracts';
import { demandFor, planStaffing, shiftHours } from '../src/lib/staffing';
import { buildPayrollCsv, missingPayrollFields, payrollRow } from '../src/lib/payroll';
import { runRetentionCleanup } from '../src/lib/retention';
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
import PlanSvg from '../src/app/[locale]/admin/events/[id]/tischplan/PlanSvg';
import SlipCard from '../src/app/[locale]/admin/events/[id]/zettel/SlipCard';
import EventDocuments from '../src/components/EventDocuments';
import type { EventDocument } from '../src/types/domain';
import type { ReservationRow, TableRecord } from '../src/types/domain';

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
  const [event] = await connection.insert(schema.events).values({ title: 'Security test', date: day, location: 'Test', description: 'Test', reservable: true, reservationMode: 'online', allowTableSelection: options.table ?? true, maxCapacity: options.capacity ?? 100 }).returning();
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
  const previousAllowedHostnames = process.env.TURNSTILE_ALLOWED_HOSTNAMES;
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
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = ',';
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-url-invalid'));
    delete process.env.TURNSTILE_SECRET_KEY;
    await assert.rejects(verifyTurnstile('test', 'checkout'), reason('captcha-secret-missing'));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = previousSecret;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL; else process.env.NEXT_PUBLIC_BASE_URL = previousUrl;
    if (previousAllowedHostnames === undefined) delete process.env.TURNSTILE_ALLOWED_HOSTNAMES; else process.env.TURNSTILE_ALLOWED_HOSTNAMES = previousAllowedHostnames;
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
test('Reservation modes map to public badges and a prefilled mailto link', () => {
  assert.equal(resolveReservationMode({ reservable: true, reservationMode: 'email' }), 'email');
  assert.equal(resolveReservationMode({ reservable: true, reservationMode: 'none' }), 'none');
  assert.equal(resolveReservationMode({ reservable: true }), 'online');
  assert.equal(resolveReservationMode({ reservable: false }), 'none');
  assert.equal(reservationBadge('email', 'de'), 'Reservierung per E-Mail');
  assert.equal(reservationBadge('email', 'en'), 'Reservation by email');
  assert.equal(reservationBadge('online', 'de'), 'Tische reservierbar');
  assert.equal(reservationBadge('none', 'de'), null);
  assert.equal(reservationStatusLabel('none', 'de'), 'Freie Platzwahl');
  assert.equal(reservationStatusLabel('email', 'en'), 'Reservation by email');

  const href = reservationMailto({
    title: 'Vereinsfest', date: new Date('2026-09-03T12:00:00Z'), location: 'Zelt',
    reservationEmail: 'verein@example.com',
  }, 'de');
  assert.ok(href.startsWith('mailto:verein@example.com?subject='));
  assert.ok(decodeURIComponent(href).includes('Reservierungsanfrage: Vereinsfest'));
  assert.ok(decodeURIComponent(href).includes('03.09.2026'));
});

test('Event policy accepts reservation mode fields and rejects invalid values', () => {
  const accepted = validateEventUpdate({
    reservationMode: 'email',
    reservationEmail: 'Verein@Example.com',
    reservationNote: 'Nur für Vereine',
    reservationDeadline: new Date('2026-08-30T12:00:00Z'),
    expectedGuests: 120,
  });
  assert.equal(accepted.reservationMode, 'email');
  assert.equal(accepted.expectedGuests, 120);
  assert.throws(() => validateEventUpdate({ reservationMode: 'bogus' }), /Reservierungsmodus/);
  assert.throws(() => validateEventUpdate({ reservationEmail: 'keine-mail' }), /Reservierungs-E-Mail/);
  assert.throws(() => validateEventUpdate({ reservationNote: 'x'.repeat(2001) }), /zu lang/);
  assert.throws(() => validateEventUpdate({ reservationDeadline: new Date('invalid') }), /Eventdatum/);
  assert.throws(() => validateEventUpdate({ expectedGuests: -1 }), /Kapazität/);
});

test('Package tax options calculate gross, net and VAT and validate voucher bundles', () => {
  const gross = packageTax({ price: 120, priceIncludesVat: true, vatRate: 19 }, 'standard');
  assert.equal(gross?.grossCents, 12000);
  assert.equal(gross?.netCents, 10084);
  assert.equal(gross?.vatCents, 1916);

  const net = packageTax({ price: 120, priceIncludesVat: false, vatRate: 19 }, 'standard');
  assert.equal(net?.grossCents, 14280);
  assert.equal(net?.vatCents, 2280);

  const seven = packageTax({ price: 107, priceIncludesVat: true, vatRate: 7 }, 'standard');
  assert.equal(seven?.netCents, 10000);
  assert.equal(seven?.vatCents, 700);

  const small = packageTax({ price: 120, vatRate: 19 }, 'small_business');
  assert.equal(small?.grossCents, 12000);
  assert.equal(small?.vatCents, 0);

  const voucher = {
    id: 'getraenke', name: 'Getränkepaket', description: '10 Gutscheine', price: 120,
    unit: 'per_table', type: 'voucher_bundle', priceIncludesVat: true, vatRate: 19,
    vatNote: 'Getränke', voucherCount: 10, voucherValueCents: 1200, active: true,
  };
  const valid = validateEventSettings({ packages: [voucher] });
  assert.equal(valid.packages?.[0]?.voucherCount, 10);
  assert.equal(valid.packages?.[0]?.unit, 'per_table');
  assert.throws(
    () => validateEventSettings({ packages: [{ ...voucher, unit: 'per_person' }] }),
    /pro Tisch/,
  );
  assert.throws(
    () => validateEventSettings({ packages: [{ ...voucher, vatRate: 12 }] }),
    /MwSt./,
  );
  const slip = validateEventSettings({ slipNote: 'Bitte freihalten.', slipFreeAfterMinutes: 20 });
  assert.equal(slip.slipFreeAfterMinutes, 20);
  assert.equal(slip.slipNote, 'Bitte freihalten.');
  assert.throws(() => validateEventSettings({ slipFreeAfterMinutes: 721 }), /Ungültige Einstellung/);
});

test('Table plan renders internal names and hides them in the public version', () => {
  const table = {
    id: randomUUID(), name: 'Tisch 1', capacity: 10, positionX: 1, positionY: 2,
    section: 'Mittelschiff', rowLabel: '10', displayNumber: 'T120', shape: 'rect',
    widthM: null, heightM: null, rotation: 0, isBlocked: false, isVip: false, vipPrice: 0,
  } as TableRecord;
  const row = {
    reservation: {
      id: randomUUID(), eventId: randomUUID(), tableId: table.id, reservationDate: new Date(),
      guestName: 'Max Mustermann', email: 'max@example.com', phone: null, guestCount: 8,
      selectedTime: '18:00', amountTotal: 0, status: 'confirmed', source: 'email',
      groupLabel: 'SV Test', groupSize: 1,
    },
    eventTitle: 'Vereinsfest', eventDate: new Date(), tableName: table.name,
  } as unknown as ReservationRow;
  const tent = { width: 10, height: 10, cellSizeM: 1.2 };
  const internal = renderToString(createElement(PlanSvg, { tables: [table], reservations: [row], tent, mode: 'internal' }));
  assert.ok(internal.includes('T120'));
  assert.ok(internal.includes('Mittelschiff'));
  assert.ok(internal.includes('Max Mustermann'));
  const publicHtml = renderToString(createElement(PlanSvg, { tables: [table], reservations: [row], tent, mode: 'public' }));
  assert.ok(publicHtml.includes('T120'));
  assert.ok(publicHtml.includes('reserviert'));
  assert.ok(!publicHtml.includes('Max Mustermann'));
});

test('Reservation slips support full, initial and club name modes', () => {
  const table = {
    id: randomUUID(), name: 'Tisch 1', capacity: 10, positionX: 1, positionY: 2,
    section: 'Mittelschiff', rowLabel: '10', displayNumber: 'T120', shape: 'rect',
    widthM: null, heightM: null, rotation: 0, isBlocked: false, isVip: false, vipPrice: 0,
  } as TableRecord;
  const row = {
    reservation: {
      id: randomUUID(), eventId: randomUUID(), tableId: table.id, reservationDate: new Date(),
      guestName: 'Max Mustermann', email: 'max@example.com', phone: null, guestCount: 8,
      selectedTime: '18:00', amountTotal: 0, status: 'confirmed', source: 'email',
      groupLabel: 'SV Müchsmünster', groupSize: 1,
    },
    eventTitle: 'Vereinsfest', eventDate: new Date(), tableName: table.name,
  } as unknown as ReservationRow;
  const render = (nameMode: 'full' | 'initial' | 'club') => renderToString(createElement(SlipCard, {
    row, table, nameMode, note: 'Bitte freihalten.', format: 'a6', eventTitle: 'Vereinsfest',
  }));
  const full = render('full');
  assert.ok(full.includes('Max Mustermann'));
  assert.ok(full.includes('T120'));
  assert.ok(full.includes('Mittelschiff'));
  const initial = render('initial');
  assert.ok(initial.includes('Max M.'));
  assert.ok(!initial.includes('Max Mustermann'));
  const club = render('club');
  assert.ok(club.includes('SV Müchsmünster'));
  assert.ok(!club.includes('Max Mustermann'));
});

test('Public event documents render menu and program quick actions', () => {
  const base = {
    eventId: randomUUID(), fileUrl: 'https://example.com/file.pdf', previewUrl: 'https://example.com/preview.webp',
    publicId: randomUUID(), mimeType: 'application/pdf', sizeBytes: 1000, isPublic: true,
    sortOrder: 0, createdBy: null, createdAt: new Date(), updatedAt: new Date(),
  };
  const documents = [
    { ...base, id: randomUUID(), kind: 'menu', title: 'Speisekarte 2026', titleEn: null },
    { ...base, id: randomUUID(), kind: 'program', title: 'Programm', titleEn: null },
  ] as EventDocument[];
  const html = renderToString(createElement(EventDocuments, { documents, title: 'Vereinsfest', locale: 'de' })).replaceAll('<!-- -->', '');
  assert.ok(html.includes('Speisekarte &amp;'));
  assert.ok(html.includes('>Programm</span>'));
  assert.ok(html.includes('>Speisekarte<'));
  assert.ok(html.includes('Programm / Bands'));
});

test('Customer CSV import maps headers, quoted cells and normalizes contact data', () => {
  const parsed = parseCsv('Name;E-Mail;Telefon;Verein\n"Mustermann, Max";max@example.com;0170 123456;SV Test\n"Zweiter";;0841 999;');
  assert.deepEqual(parsed.headers, ['Name', 'E-Mail', 'Telefon', 'Verein']);
  assert.equal(parsed.rows.length, 2);
  const mapped = mapImportRows(parsed.headers, parsed.rows, { displayName: 0, email: 1, phone: 2, company: 3 });
  assert.equal(mapped[0].displayName, 'Mustermann, Max');
  assert.equal(mapped[0].email, 'max@example.com');
  assert.equal(mapped[1].displayName, 'Zweiter');
  assert.equal(normalizeEmail(' MAX@Example.com '), 'max@example.com');
  assert.equal(normalizeEmail('keine-mail'), null);
  assert.equal(normalizePhone('+49 (0) 170 123 456'), '490170123456');
});

test('Confirming a request creates or reuses one customer and links the reservation', async () => {
  const f = await fixture();
  const reservation = await booked(f, { guestName: 'Max Mustermann', email: 'max@example.com', guestCount: 4, status: 'requested', source: 'email' });
  const first = await ensureCustomerForReservation(connection, reservation);
  const second = await ensureCustomerForReservation(connection, reservation);
  assert.equal(first.id, second.id);
  assert.equal(first.displayName, 'Max Mustermann');
  assert.equal(first.email, 'max@example.com');
  await linkReservationCustomer(connection, reservation.id, first.id);
  const [linked] = await rows(f.event.id);
  assert.equal(linked.customerId, first.id);
});

test('Staff passwords and invite tokens are hashed, not stored in plain text', async () => {
  process.env.AUTH_SECRET = 'test-auth-secret-that-is-long-enough-123456';
  const hash = await hashPassword('sicheres-passwort-123');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(await verifyPassword('sicheres-passwort-123', hash), true);
  assert.equal(await verifyPassword('falsch', hash), false);
  assert.equal(await verifyPassword('sicheres-passwort-123', null), false);
  const token = randomToken();
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
  assert.equal(hashToken(token).length, 64);
});

test('Sensitive staff fields are encrypted, decryptable and maskable', () => {
  process.env.STAFF_DATA_KEY = 'test-staff-data-key-32-characters';
  const encrypted = encryptField('DE89370400440532013000');
  assert.ok(encrypted?.startsWith('v1:'));
  assert.equal(decryptField(encrypted), 'DE89370400440532013000');
  assert.equal(decryptField(null), null);
  assert.ok(maskField(encrypted, 4).endsWith('3000'));
  assert.ok(!maskField(encrypted, 4).includes('DE893704'));
});

test('Contract rendering fills staff variables and remains a versioned snapshot', () => {
  const staff = {
    firstName: 'Max', lastName: 'Mustermann', email: 'max@example.com', phone: null,
    street: 'Hauptstraße 1', zip: '80331', city: 'München', hourlyRateCents: 1500,
    entryDate: new Date('2026-09-01'),
  } as unknown as typeof schema.staff.$inferSelect;
  const role = { name: 'Bedienung' } as unknown as typeof schema.staffRoles.$inferSelect;
  const templateV1 = '<p>{{name}} · {{rolle}} · {{stundensatz}} € · {{adresse}}</p>';
  const contractV1 = renderContract(templateV1, staff, role);
  assert.ok(contractV1.includes('Max Mustermann'));
  assert.ok(contractV1.includes('Bedienung'));
  assert.ok(contractV1.includes('15,00 €'));
  assert.ok(contractV1.includes('Hauptstraße 1'));
  const templateV2 = '<p>Neue Fassung für {{name}}</p>';
  assert.notEqual(renderContract(templateV2, staff, role), contractV1);
  assert.ok(contractV1.includes('Bedienung'));
  assert.ok(!contractV1.includes('Neue Fassung'));
});

test('Staffing demand and assignment respect qualification, availability and gaps', () => {
  assert.equal(demandFor(100, { guestsPerStaff: 40, minStaff: 2, fixedStaff: 0 }), 3);
  assert.equal(demandFor(10, { guestsPerStaff: 40, minStaff: 2, fixedStaff: 1 }), 3);
  const requirements = [{ id: 'req-1', roleId: 'role-1', date: '2026-09-03', startTime: '18:00', endTime: '23:00', requiredCount: 2 }];
  const availability = [
    { staffId: 'staff-1', eventId: 'event-1', date: '2026-09-03', startTime: '17:00', endTime: '23:30', kind: 'preferred' as const },
    { staffId: 'staff-2', eventId: 'event-1', date: '2026-09-03', startTime: '17:00', endTime: '23:30', kind: 'unavailable' as const },
  ];
  const staff = [
    { id: 'staff-1', firstName: 'Anna', lastName: 'A', roleId: 'role-1', status: 'active', employmentType: 'minijob', birthDate: '1990-01-01', hourlyRateCents: 1500 },
    { id: 'staff-2', firstName: 'Ben', lastName: 'B', roleId: 'role-1', status: 'active', employmentType: 'minijob', birthDate: '1990-01-01', hourlyRateCents: 1500 },
  ];
  const rules = [{ roleId: 'role-1', guestsPerStaff: 40, minStaff: 1, fixedStaff: 0, maxHoursPerDay: 10, minRestHours: 11, minAge: 18, active: true }];
  const plan = planStaffing({ eventId: 'event-1', requirements, availability, staff, rules });
  assert.equal(shiftHours('18:00', '23:00'), 5);
  assert.equal(plan.assignments.length, 1);
  assert.equal(plan.assignments[0].staffId, 'staff-1');
  assert.equal(plan.assignments[0].costCents, 7500);
  assert.equal(plan.gaps[0].missing, 1);
  assert.equal(plan.coverage, 50);

  const minor = planStaffing({
    eventId: 'event-1', requirements, availability,
    staff: [{ ...staff[0], birthDate: '2012-01-01' }], rules,
  });
  assert.equal(minor.assignments.length, 0);
  assert.ok(minor.warnings.some(warning => warning.type === 'minor'));

  const noAvailability = planStaffing({ eventId: 'event-1', requirements, availability: [], staff, rules });
  assert.equal(noAvailability.assignments.length, 0);
  assert.ok(noAvailability.warnings.some(warning => warning.type === 'no_availability'));
});

test('DATEV payroll CSV includes required fields, decrypted values and escaping', () => {
  process.env.STAFF_DATA_KEY = 'test-staff-data-key-32-characters';
  const member = {
    id: '12345678-1234-1234-1234-123456789012', firstName: 'Max', lastName: 'Mustermann',
    birthDate: new Date('1990-01-01'), street: 'Hauptstraße 1', zip: '80331', city: 'München',
    entryDate: new Date('2026-09-01'), exitDate: null, employmentType: 'minijob',
    hourlyRateCents: 1500, monthlySalaryCents: 0, taxIdEnc: encryptField('12345'),
    taxClass: '1', childAllowances: 0, socialSecurityEnc: encryptField('12345678'),
    healthInsurance: 'AOK', ibanEnc: encryptField('DE89370400440532013000'), bic: 'COBADEFFXXX',
    status: 'active',
  } as unknown as typeof schema.staff.$inferSelect;
  const role = { name: 'Bedienung' } as unknown as typeof schema.staffRoles.$inferSelect;
  const csv = buildPayrollCsv([payrollRow(member, role)]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Personalnummer;Anrede;Titel;Vorname;Nachname'));
  assert.ok(csv.includes('Max;Mustermann'));
  assert.ok(csv.includes('15,00'));
  assert.ok(csv.includes('12345'));
  assert.ok(csv.includes('DE89370400440532013000'));
  assert.equal(missingPayrollFields(member).length, 0);
  assert.deepEqual(missingPayrollFields({ ...member, ibanEnc: null }), ['IBAN']);
  assert.ok(buildPayrollCsv([['a;b']]).includes('"a;b"'));
});

test('Retention cleanup removes expired invites, sessions and old export/audit records', async () => {
  const [role] = await connection.insert(schema.staffRoles).values({ key: `role-${randomUUID()}`, name: 'Testrolle' }).returning();
  const [member] = await connection.insert(schema.staff).values({ email: `${randomUUID()}@example.com`, firstName: 'Test', lastName: 'Person', roleId: role.id }).returning();
  await connection.insert(schema.staffInvites).values({ staffId: member.id, tokenHash: randomUUID(), expiresAt: new Date(0), createdBy: 'test@example.com' });
  await connection.insert(schema.staffSessions).values({ staffId: member.id, validUntil: new Date(0) });
  await connection.insert(schema.auditLog).values({ actorType: 'test', actorId: 'test', action: 'old', entityType: 'test', entityId: null, createdAt: new Date('2020-01-01') });
  const result = await runRetentionCleanup(connection, new Date());
  assert.ok(result.staffInvites >= 1);
  assert.ok(result.staffSessions >= 1);
  assert.ok(result.auditLogs >= 1);
});

test('Voucher package checkout charges per table and snapshots VAT', async () => {
  const day = calendarDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [event] = await connection.insert(schema.events).values({
    title: 'Gutschein-Checkout', date: day, location: 'Zelt', description: 'Test',
    reservable: true, reservationMode: 'online', maxCapacity: 100,
  }).returning();
  await connection.insert(schema.eventSettings).values({
    eventId: event.id, requireFullTable: false,
    packages: [{
      id: 'getraenke', name: 'Getränkepaket', description: '10 Gutscheine', price: 120,
      unit: 'per_table', type: 'voucher_bundle', priceIncludesVat: true, vatRate: 19,
      vatNote: 'Getränke', voucherCount: 10, voucherValueCents: 1200, active: true,
    }],
  });
  const [table] = await connection.insert(schema.tables).values({ name: randomUUID(), capacity: 10 }).returning();
  const checkout = createCheckoutService(connection, fakeStripe().stripe, captcha);
  await checkout({
    eventId: event.id, tableId: table.id, reservationDate: day.toISOString().slice(0, 10),
    selectedTime: '18:00', selectedPackage: 'getraenke', guestCount: 10,
    name: 'Gutschein Gast', email: `${randomUUID()}@example.com`,
    idempotencyKey: randomUUID(), turnstileToken: 'fake-test-captcha', locale: 'de',
  });
  const [reservation] = await connection.select().from(schema.reservations).where(eq(schema.reservations.eventId, event.id));
  assert.equal(reservation.packageId, 'getraenke');
  assert.equal(reservation.source, 'online');
  assert.equal(reservation.priceGrossCents, 12000);
  assert.equal(reservation.priceNetCents, 10084);
  assert.equal(reservation.vatCents, 1916);
  assert.equal(reservation.vatRate, 19);
  assert.equal(reservation.amountTotal, 12205);
});

test('Event-bound vouchers are issued once, redeemable only at their event and void on cancel', async () => {
  const day = calendarDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [event] = await connection.insert(schema.events).values({
    title: 'Gutschein-Fest', date: day, location: 'Zelt', description: 'Test',
    reservable: true, reservationMode: 'online', maxCapacity: 100,
  }).returning();
  await connection.insert(schema.eventSettings).values({
    eventId: event.id,
    packages: [{
      id: 'getraenke', name: 'Getränkepaket', description: '10 Gutscheine', price: 120,
      unit: 'per_table', type: 'voucher_bundle', priceIncludesVat: true, vatRate: 19,
      vatNote: 'Getränke', voucherCount: 10, voucherValueCents: 1200, active: true,
    }],
  });
  const [table] = await connection.insert(schema.tables).values({ name: randomUUID(), capacity: 10 }).returning();
  const [reservation] = await connection.insert(schema.reservations).values({
    eventId: event.id, tableId: table.id, guestName: 'Gutschein Gast', email: `${randomUUID()}@example.com`,
    guestCount: 10, reservationDate: day, amountTotal: 12000, status: 'paid', source: 'online',
    packageId: 'getraenke', packageName: 'Getränkepaket',
    priceGrossCents: 12000, priceNetCents: 10084, vatCents: 1916, vatRate: 19,
  }).returning();

  const admin = reservationAdmin(connection);
  await admin.status(reservation.id, 'confirmed');
  const issued = await connection.select().from(schema.vouchers).where(eq(schema.vouchers.reservationId, reservation.id));
  assert.equal(issued.length, 10);
  assert.ok(issued.every(voucher => voucher.eventId === event.id && voucher.valueCents === 1200 && voucher.status === 'issued'));

  const code = issued[0].code;
  const redeemed = await redeemVoucher(connection, { code, eventId: event.id, redeemedBy: 'admin@example.com' });
  assert.equal(redeemed.voucher.status, 'redeemed');
  assert.equal(redeemed.voucher.redeemedBy, 'admin@example.com');
  await assert.rejects(redeemVoucher(connection, { code, eventId: event.id, redeemedBy: 'admin@example.com' }), /bereits eingelöst/);

  const [otherEvent] = await connection.insert(schema.events).values({
    title: 'Anderes Fest', date: day, location: 'Zelt', description: 'Test',
    reservable: true, reservationMode: 'online', maxCapacity: 100,
  }).returning();
  await assert.rejects(
    redeemVoucher(connection, { code: issued[1].code, eventId: otherEvent.id, redeemedBy: 'admin@example.com' }),
    /anderen Event/,
  );

  await admin.status(reservation.id, 'confirmed');
  const afterConfirmation = await connection.select().from(schema.vouchers).where(eq(schema.vouchers.reservationId, reservation.id));
  assert.equal(afterConfirmation.length, 10);

  await admin.status(reservation.id, 'cancelled');
  const afterCancel = await connection.select().from(schema.vouchers).where(eq(schema.vouchers.reservationId, reservation.id));
  assert.ok(afterCancel.filter(voucher => voucher.code !== code).every(voucher => voucher.status === 'void'));
  assert.equal(afterCancel.find(voucher => voucher.code === code)?.status, 'redeemed');
});

test('Reservation modes, request status and event-bound vouchers are enforced', async () => {
  const day = calendarDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const hasConstraint = (constraint: string) => (error: unknown) => {
    const stack: unknown[] = [error];
    const seen = new Set<unknown>();
    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== 'object' || seen.has(current)) continue;
      seen.add(current);
      const record = current as { constraint_name?: string; cause?: unknown };
      if (record.constraint_name === constraint) return true;
      if (record.cause) stack.push(record.cause);
    }
    return false;
  };
  const [emailEvent] = await connection.insert(schema.events).values({
    title: 'Vereinsfest', date: day, location: 'Zelt', description: 'Test',
    reservable: true, reservationMode: 'email', maxCapacity: 100,
  }).returning();
  assert.equal(emailEvent.reservationMode, 'email');

  await assert.rejects(
    connection.insert(schema.events).values({ title: 'Invalid', date: day, location: 'Zelt', description: 'Test', reservationMode: 'bogus' }),
    hasConstraint('events_reservation_mode_check'),
  );

  const [request] = await connection.insert(schema.reservations).values({
    eventId: emailEvent.id, guestName: 'Verein', email: `${randomUUID()}@example.com`,
    guestCount: 20, reservationDate: day, amountTotal: 0, status: 'requested', source: 'email',
  }).returning();
  assert.equal(request.status, 'requested');

  const code = `V-${randomUUID()}`;
  const [voucher] = await connection.insert(schema.vouchers).values({
    eventId: emailEvent.id, reservationId: request.id, code, valueCents: 1200,
  }).returning();
  assert.equal(voucher.eventId, emailEvent.id);

  await assert.rejects(
    connection.insert(schema.vouchers).values({ eventId: randomUUID(), code: `V-${randomUUID()}`, valueCents: 1200 }),
    hasConstraint('vouchers_event_id_events_id_fk'),
  );
});

test('Email requests can be confirmed or declined without occupying capacity', async () => {
  const day = calendarDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [emailEvent] = await connection.insert(schema.events).values({
    title: 'Vereinsfest', date: day, location: 'Zelt', description: 'Test',
    reservable: false, reservationMode: 'email', maxCapacity: 100,
  }).returning();
  const [table] = await connection.insert(schema.tables).values({ name: randomUUID(), capacity: 10 }).returning();
  const [request] = await connection.insert(schema.reservations).values({
    eventId: emailEvent.id, guestName: 'SV Müchsmünster', email: `${randomUUID()}@example.com`,
    phone: '0123456', guestCount: 5, reservationDate: day, amountTotal: 0,
    status: 'requested', source: 'email', groupLabel: 'SV Müchsmünster', groupSize: 2,
    notes: 'Bitte nebeneinander',
  }).returning();

  const confirmed = await reservationAdmin(connection).confirmRequest(request.id, {
    tableId: table.id, priceCents: 12000, actor: 'admin@example.com',
  });
  assert.equal(confirmed.reservation.status, 'confirmed');
  assert.equal(confirmed.reservation.tableId, table.id);
  assert.equal(confirmed.reservation.agreedPriceCents, 12000);
  assert.equal(confirmed.reservation.confirmedBy, 'admin@example.com');

  const [declineCandidate] = await connection.insert(schema.reservations).values({
    eventId: emailEvent.id, guestName: 'TSV Test', email: `${randomUUID()}@example.com`,
    guestCount: 4, reservationDate: day, amountTotal: 0, status: 'requested', source: 'email',
  }).returning();
  const declined = await reservationAdmin(connection).declineRequest(declineCandidate.id, {
    actor: 'admin@example.com', reason: 'Kein Platz mehr',
  });
  assert.equal(declined.reservation.status, 'declined');
  assert.ok(declined.reservation.internalNotes?.includes('Kein Platz mehr'));

  await assert.rejects(
    reservationAdmin(connection).confirmRequest(declineCandidate.id, { actor: 'admin@example.com' }),
    /offene Anfragen/,
  );
});
