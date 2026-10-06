import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { reservations, stripeEvents } from '@/db/schema';
import { assertCapacity, lockLayout, lockReservation } from './reservation-db';
import { BookingError, UUID_PATTERN } from './reservation-policy';
import { toCalendarDay } from './date';

export const RESERVATION_EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired', 'charge.refunded', 'charge.dispute.created']);

export async function processReservationWebhook(connection: typeof db, event: Stripe.Event, session: Stripe.Checkout.Session | null, fullyRefunded = false) {
  if (!RESERVATION_EVENTS.has(event.type)) return;
  const reservationId = session?.metadata?.reservationId;
  return connection.transaction(async tx => {
    // Event claim and reservation mutation commit together. Duplicate deliveries
    // wait for the winning transaction and return without mutating any state.
    const [claim] = await tx.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning();
    if (!claim) return reservationId;
    if (!reservationId || !UUID_PATTERN.test(reservationId)) return;
    await lockLayout(tx);
    const { event: bookingEvent, reservation } = await lockReservation(tx, reservationId);
    if (!session || (reservation.stripeSessionId && reservation.stripeSessionId !== session.id) || (!reservation.stripeSessionId && !reservation.checkoutParams)) return;
    if (!reservation.stripeSessionId && (session.client_reference_id !== reservation.id || session.metadata?.requestHash !== reservation.requestHash)) return;
    const validPayment = session.currency === 'eur' && session.mode === 'payment' && session.amount_total === reservation.amountTotal;
    let status = reservation.status;
    if (!validPayment) {
      if (['pending', 'expired', 'payment_pending', 'cancelled'].includes(status)) status = 'payment_review';
    } else if (event.type === 'charge.refunded') {
      if (fullyRefunded) status = 'refunded';
    } else if (event.type === 'charge.dispute.created') {
      if (status !== 'refunded') status = 'disputed';
    } else if (session.payment_status === 'paid' && session.status === 'complete') {
      if (status === 'cancelled') {
        status = 'payment_review';
      } else if (['pending', 'expired', 'payment_pending'].includes(status)) {
        try {
          await assertCapacity(tx, bookingEvent, toCalendarDay(reservation.reservationDate), reservation.guestCount, reservation.tableId, reservation.id);
          status = 'paid';
        } catch (error) {
          if (!(error instanceof BookingError) || error.status !== 409) throw error;
          status = 'payment_review';
        }
      }
    } else if (session.status === 'complete' && ['pending', 'expired'].includes(status)) {
      // SEPA/Klarna can settle days later. Never release an accepted payment hold
      // based on the checkout session's expiration timestamp.
      if (event.type === 'checkout.session.async_payment_failed') status = 'cancelled';
      else {
        try {
          await assertCapacity(tx, bookingEvent, toCalendarDay(reservation.reservationDate), reservation.guestCount, reservation.tableId, reservation.id);
          status = 'payment_pending';
        } catch (error) {
          if (!(error instanceof BookingError) || error.status !== 409) throw error;
          status = 'payment_review';
        }
      }
    } else if (event.type === 'checkout.session.async_payment_failed' && status === 'payment_pending') {
      status = 'cancelled';
    } else if (session.status === 'expired' && status === 'pending') {
      status = 'expired';
    }
    const invalidTicket = ['cancelled', 'expired', 'refunded', 'disputed', 'payment_review'].includes(status);
    await tx.update(reservations).set({ status, stripeSessionId: session.id, updatedAt: new Date(),
      qrCodeText: invalidTicket ? null : reservation.qrCodeText, pdfUrl: invalidTicket ? null : reservation.pdfUrl,
    }).where(eq(reservations.id, reservation.id));
    return reservation.id;
  });
}
