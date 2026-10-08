import { createHash, randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { and, eq, sql, count } from 'drizzle-orm';
import { db } from '@/db';
import { eventSettings, reservations } from '@/db/schema';
import { activeReservation, assertCapacity, lockEvent, lockLayout } from './reservation-db';
import { assertBookingWindow, assertEventDay, bookingInstant, bookingPrice, BookingError, calendarDate, cleanTime, DEFAULT_PACKAGES, DEFAULT_TIMES, guestDetails, uuid } from './reservation-policy';
import { verifyTurnstile } from './turnstile';
import { takeRateLimit } from './rate-limit';

export function parseCheckout(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BookingError('Ungültige Anfrage.');
  const input = body as Record<string, unknown>;
  const guests = guestDetails(input.name, input.email, input.guestCount);
  const day = calendarDate(input.reservationDate);
  if (typeof input.selectedPackage !== 'string' || !input.selectedPackage || input.selectedPackage.length > 100) throw new BookingError('Bitte ein gültiges Paket auswählen.');
  const locale = input.locale ?? 'de';
  if (locale !== 'de' && locale !== 'en') throw new BookingError('Ungültige Sprache.');
  return { ...guests, eventId: uuid(input.eventId, 'Event-ID'), tableId: input.tableId === null || input.tableId === undefined || input.tableId === '' ? null : uuid(input.tableId, 'Tisch-ID'),
    day, selectedTime: cleanTime(input.selectedTime), selectedPackage: input.selectedPackage,
    idempotencyKey: uuid(input.idempotencyKey, 'Idempotenz-ID'), turnstileToken: input.turnstileToken, locale };
}

export function createCheckoutService(connection: typeof db, stripe: Pick<Stripe, 'checkout'>, captcha = verifyTurnstile) {
  return async (body: unknown) => {
    const input = parseCheckout(body);
    const requestHash = createHash('sha256').update(JSON.stringify({ eventId: input.eventId, tableId: input.tableId, day: input.day.toISOString(), time: input.selectedTime,
      package: input.selectedPackage, name: input.guestName, email: input.email, guests: input.guestCount })).digest('hex');
    // Random key + identical request allow recovery without reusing a consumed CAPTCHA.
    const [replay] = await connection.select().from(reservations).where(eq(reservations.idempotencyKey, input.idempotencyKey));
    if (!replay) await captcha(input.turnstileToken, 'checkout', input.idempotencyKey);
    const reservation = await connection.transaction(async tx => {
      await lockLayout(tx);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`checkout:${input.idempotencyKey}`}, 0))`);
      const [existing] = await tx.select().from(reservations).where(eq(reservations.idempotencyKey, input.idempotencyKey));
      if (existing) {
        if (existing.requestHash !== requestHash) throw new BookingError('Dieser Buchungsschlüssel gehört zu einer anderen Anfrage.', 409);
        if (['cancelled', 'expired', 'refunded'].includes(existing.status)) throw new BookingError('Diese Buchung ist abgeschlossen. Bitte eine neue Buchung starten.', 409, 'new_attempt_allowed');
        if (existing.status !== 'pending' || !existing.expiresAt || existing.expiresAt <= new Date()) throw new BookingError('Diese Buchung wird bereits bezahlt oder ist abgeschlossen/abgelaufen.', 409);
        if (!existing.checkoutParams) throw new BookingError('Diese Buchung kann nicht erneut gestartet werden.', 409);
        return existing;
      }
      const event = await lockEvent(tx, input.eventId);
      const [settings] = await tx.select().from(eventSettings).where(eq(eventSettings.eventId, event.id));
      assertEventDay(event, input.day);
      if (!event.reservable || event.type !== 'event') throw new BookingError('Event nicht buchbar.');
      if (event.publishTablesAt && event.publishTablesAt > new Date()) throw new BookingError('Reservierungen sind noch nicht verfügbar.', 403);
      if (event.allowTableSelection !== !!input.tableId) throw new BookingError(event.allowTableSelection ? 'Bitte einen Tisch auswählen.' : 'Tischwahl ist für dieses Event nicht verfügbar.');
      if (!(settings?.timeSlots ?? DEFAULT_TIMES).map(cleanTime).includes(input.selectedTime)) throw new BookingError('Uhrzeit nicht buchbar.');
      assertBookingWindow(bookingInstant(input.day.toISOString().slice(0, 10), input.selectedTime), settings?.bookingWindowStartDays, settings?.bookingWindowEndHours);
      const pkg = (settings?.packages ?? DEFAULT_PACKAGES).find(p => p.id === input.selectedPackage);
      if (!pkg) throw new BookingError('Ungültiges Paket.');
      const [bookings] = await tx.select({ count: count() }).from(reservations).where(and(eq(reservations.eventId, event.id), sql`lower(trim(${reservations.email})) = ${input.email}`, activeReservation()));
      if (bookings.count >= (settings?.maxBookingsPerEmail ?? 2)) throw new BookingError(`Maximal ${settings?.maxBookingsPerEmail ?? 2} Buchungen pro E-Mail erlaubt.`, 409);
      if (!await takeRateLimit(`checkout:${input.email}`, 10, 15 * 60000, tx)) throw new BookingError('Zu viele Buchungsversuche. Bitte später erneut versuchen.', 429);
      const table = await assertCapacity(tx, event, input.day, input.guestCount, input.tableId);
      if (table && (settings?.requireFullTable ?? true) && input.guestCount !== table.capacity) throw new BookingError(`Bitte die gesamte Tischkapazität (${table.capacity} Personen) buchen.`);
      const vipCents = table?.isVip ? table.vipPrice ?? 0 : 0;
      const price = bookingPrice(pkg.price, input.guestCount, vipCents, settings?.customServiceFee ? settings.serviceFeePercent : undefined, settings?.customServiceFee ? settings.serviceFeeFixedCents : undefined);
      const baseUrl = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
      if (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:') throw new BookingError('Checkout ist nicht korrekt konfiguriert.', 503);
      const id = randomUUID();
      const expires = Math.floor(Date.now() / 1000) + 31 * 60;
      const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price_data: { currency: 'eur', product_data: { name: `Reservierung: ${event.title}`, description: `${pkg.name} für ${input.guestCount} Personen` }, unit_amount: price.unitAmount }, quantity: input.guestCount }];
      if (vipCents > 0) line_items.push({ price_data: { currency: 'eur', product_data: { name: 'VIP Aufpreis', description: table.name }, unit_amount: vipCents }, quantity: 1 });
      if (price.fee > 0) line_items.push({ price_data: { currency: 'eur', product_data: { name: 'Service- & Buchungsgebühr' }, unit_amount: price.fee }, quantity: 1 });
      const params: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card', 'paypal', 'klarna', 'sepa_debit'], mode: 'payment', line_items,
        success_url: `${baseUrl.origin}${input.locale === 'en' ? '/en' : ''}/reservierung/erfolgreich?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl.origin}/?canceled=true`,
        customer_email: input.email, expires_at: expires, client_reference_id: id, metadata: { reservationId: id, requestHash }, payment_intent_data: { metadata: { reservationId: id } },
      };
      const [created] = await tx.insert(reservations).values({ id, eventId: event.id, tableId: input.tableId,
        guestName: input.guestName, email: input.email, guestCount: input.guestCount, reservationDate: input.day,
        selectedTime: input.selectedTime, amountTotal: price.total, status: 'pending', expiresAt: new Date((expires + 4 * 60) * 1000),
        idempotencyKey: input.idempotencyKey, requestHash, checkoutParams: params as unknown as Record<string, unknown>,
      }).returning();
      return created;
    });
    let session: Stripe.Checkout.Session;
    try {
      session = reservation.stripeSessionId ? await stripe.checkout.sessions.retrieve(reservation.stripeSessionId)
        : await stripe.checkout.sessions.create(reservation.checkoutParams as unknown as Stripe.Checkout.SessionCreateParams, { idempotencyKey: `reservation:${reservation.id}` });
    } catch {
      // The request may have succeeded at Stripe. Keep the hold and frozen parameters.
      throw new BookingError('Zahlungsdienst derzeit nicht erreichbar. Bitte dieselbe Buchung erneut versuchen.', 503);
    }
    if (session.metadata?.reservationId !== reservation.id || session.amount_total !== reservation.amountTotal || session.currency !== 'eur') throw new BookingError('Zahlungszuordnung konnte nicht bestätigt werden.', 503);
    await connection.transaction(async tx => {
      await lockLayout(tx); await lockEvent(tx, reservation.eventId);
      const [current] = await tx.select().from(reservations).where(eq(reservations.id, reservation.id)).for('update');
      if (current.stripeSessionId && current.stripeSessionId !== session.id) throw new BookingError('Zahlungszuordnung steht in Konflikt.', 409);
      if (current.status !== 'pending' || current.expiresAt <= new Date()) throw new BookingError('Buchung ist bereits abgeschlossen oder abgelaufen.', 409);
      await tx.update(reservations).set({ stripeSessionId: session.id, updatedAt: new Date() }).where(eq(reservations.id, current.id));
    });
    if (session.status !== 'open' || !session.url) throw new BookingError('Zahlung wurde bereits gestartet oder abgeschlossen.', 409);
    return { url: session.url };
  };
}
