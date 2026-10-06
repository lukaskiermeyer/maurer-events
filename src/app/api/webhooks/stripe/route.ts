import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { eventSettings, reservations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { processReservationWebhook, RESERVATION_EVENTS } from '@/lib/stripe-webhook';
import { reservationAdmin } from '@/lib/reservation-admin';
import { deliverTicket } from '@/lib/ticket-delivery';
import { boundedBody } from '@/lib/request-body';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: 'Webhook nicht konfiguriert.' }, { status: 503 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia', timeout: 15000, maxNetworkRetries: 1 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await boundedBody(req, 1048576), req.headers.get('stripe-signature') || '', process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return NextResponse.json({ error: 'Ungültige Webhook-Signatur.' }, { status: 400 }); }
  if (!RESERVATION_EVENTS.has(event.type)) return NextResponse.json({ received: true });
  try {
    let session: Stripe.Checkout.Session | null = null;
    let fullyRefunded = false;
    if (event.type.startsWith('checkout.session.')) {
      // Read current Stripe state: delayed/out-of-order events cannot regress a payment.
      session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
    } else {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute;
      const chargeId = event.type === 'charge.dispute.created' ? (object as Stripe.Dispute).charge : (object as Stripe.Charge).id;
      const charge = await stripe.charges.retrieve(typeof chargeId === 'string' ? chargeId : chargeId.id);
      fullyRefunded = charge.refunded && charge.amount_refunded === charge.amount;
      const intent = charge.payment_intent;
      if (intent) {
        const result = await stripe.checkout.sessions.list({ payment_intent: typeof intent === 'string' ? intent : intent.id, limit: 2 });
        if (result.data.length === 1) session = result.data[0];
      }
    }
    const reservationId = await processReservationWebhook(db, event, session, fullyRefunded);
    if (reservationId) {
      // Ticket failures must not roll back a confirmed payment. Duplicate delivery
      // also retries ticket delivery with a stable provider idempotency key.
      try {
        const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId));
        if (reservation && ['paid', 'confirmed'].includes(reservation.status)) {
          const [settings] = await db.select().from(eventSettings).where(eq(eventSettings.eventId, reservation.eventId));
          if (settings?.autoSendTicket ?? true) {
            await reservationAdmin(db).status(reservationId, 'confirmed');
            const warning = await deliverTicket(reservationId);
            if (warning) console.error('Ticket delivery needs retry:', reservationId);
          }
        }
      } catch { console.error('Ticket confirmation needs retry:', reservationId); }
    }
    return NextResponse.json({ received: true });
  } catch {
    console.error('Reservation webhook failed:', event.id);
    return NextResponse.json({ error: 'Webhook vorübergehend nicht verarbeitbar.' }, { status: 503 });
  }
}
