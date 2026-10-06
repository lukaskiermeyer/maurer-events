import type Stripe from 'stripe';
import { and, eq, isNull, lt, or, asc } from 'drizzle-orm';
import { db } from '@/db';
import { reservations } from '@/db/schema';
import { processReservationWebhook } from './stripe-webhook';

export async function reconcileExpiredReservations(connection: typeof db, stripe: Pick<Stripe, 'checkout'>) {
  const now = new Date();
  const candidates = await connection.select().from(reservations).where(or(
    and(eq(reservations.status, 'pending'), or(lt(reservations.expiresAt, now), and(isNull(reservations.expiresAt), lt(reservations.createdAt, new Date(now.getTime() - 35 * 60000))))),
    and(eq(reservations.status, 'payment_pending'), lt(reservations.updatedAt, new Date(now.getTime() - 15 * 60000)))
  )).orderBy(asc(reservations.updatedAt)).limit(100);
  let reconciled = 0;
  for (const reservation of candidates) {
    try {
      let session: Stripe.Checkout.Session;
      if (reservation.stripeSessionId) session = await stripe.checkout.sessions.retrieve(reservation.stripeSessionId, { expand: ['payment_intent'] });
      else if (reservation.checkoutParams && now.getTime() - reservation.createdAt.getTime() < 23 * 3600000) {
        // Recover a session whose successful response never reached our database.
        try {
          session = await stripe.checkout.sessions.create(reservation.checkoutParams as unknown as Stripe.Checkout.SessionCreateParams, { idempotencyKey: `reservation:${reservation.id}` });
        } catch (error) {
          // Stripe would replay an accepted request. An expires_at rejection means
          // these now-expired frozen parameters never created a checkout session.
          if ((error as Stripe.errors.StripeError)?.type !== 'StripeInvalidRequestError' || (error as Stripe.errors.StripeError).param !== 'expires_at') throw error;
          await connection.update(reservations).set({ status: 'expired', updatedAt: now }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, 'pending'), isNull(reservations.stripeSessionId)));
          reconciled++; continue;
        }
      } else {
        // Unknown legacy sessions or keys older than Stripe's retention must be
        // reconciled manually; a timestamp alone cannot release paid inventory.
        await connection.update(reservations).set({ updatedAt: now }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, 'pending')));
        continue;
      }
      if (session.status === 'open') session = await stripe.checkout.sessions.expire(session.id);
      const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
      const failed = intent && ['requires_payment_method', 'canceled'].includes(intent.status);
      const type = failed ? 'checkout.session.async_payment_failed' : session.status === 'expired' ? 'checkout.session.expired' : 'checkout.session.completed';
      await processReservationWebhook(connection, { id: `cleanup:${session.id}:${session.status}:${session.payment_status}:${intent?.status || 'unknown'}`, type } as Stripe.Event, session);
      await connection.update(reservations).set({ updatedAt: now }).where(eq(reservations.id, reservation.id));
      reconciled++;
    } catch {
      await connection.update(reservations).set({ updatedAt: now }).where(eq(reservations.id, reservation.id));
      console.error('Reservation reconciliation needs retry:', reservation.id);
    }
  }
  return reconciled;
}
