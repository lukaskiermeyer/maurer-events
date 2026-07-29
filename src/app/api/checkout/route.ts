import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { events, reservations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

// 1. Verhindert die statische Datensammlung beim Build
export const dynamic = 'force-dynamic';

// 2. Fallback-String, falls STRIPE_SECRET_KEY beim Build nicht vorhanden ist
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key_for_build', {
  apiVersion: '2026-06-24.dahlia',
});

export async function POST(req: Request) {
  try {
    const { eventId, guestCount, name, email } = await req.json();

    if (!eventId || !guestCount || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Hole Event-Details aus der DB
    const eventList = await db.select().from(events).where(eq(events.id, eventId));
    if (eventList.length === 0) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 });
    }
    const event = eventList[0];

    const minimumConsumption = event.minimumConsumption || 5000; // in Cent
    const amountTotal = minimumConsumption * guestCount;

    // Erstelle Stripe Checkout Session
    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paypal', 'klarna', 'sepa_debit'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Reservierung: ${event.title}`,
              description: `Mindestabnahme für ${guestCount} Personen`,
            },
            unit_amount: minimumConsumption,
          },
          quantity: guestCount,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      customer_email: email,
    });

    // Speichere Reservierung als 'pending'
    await db.insert(reservations).values({
      eventId: event.id,
      guestName: name,
      email: email,
      guestCount: guestCount,
      amountTotal: amountTotal,
      stripeSessionId: session.id,
      status: 'pending'
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}