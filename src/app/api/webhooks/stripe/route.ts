import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { reservations } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 1. ZWINGEND: Verhindert, dass Next.js diese Route beim Build statisch verarbeitet
export const dynamic = 'force-dynamic';

// 2. Fallback-String für Stripe, damit der Build bei leerem Secret-Key nicht crashed
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key_for_build', {
  apiVersion: '2026-06-24.dahlia',
});

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable.');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Update reservation status in database
      await db.update(reservations)
          .set({ status: 'paid' })
          .where(eq(reservations.stripeSessionId, session.id));

      console.log(`Payment successful for session ${session.id}. Reservation updated.`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Stripe Webhook Exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}