import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { events, reservations } from '@/db/schema';
import { eq } from 'drizzle-orm';



// 1. Verhindert die statische Datensammlung beim Build
export const dynamic = 'force-dynamic';

// 2. Fallback-String, falls STRIPE_SECRET_KEY beim Build nicht vorhanden ist
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key_for_build', {
  apiVersion: '2026-06-24.dahlia',
});

export async function POST(req: Request) {
  try {
    const { eventId, tableId, guestCount, name, email, reservationDate, selectedPackage, selectedTime, turnstileToken } = await req.json();

    if (!eventId || !guestCount || !name || !email || !reservationDate || !turnstileToken) {
      return NextResponse.json({ error: 'Missing required fields or spam protection token' }, { status: 400 });
    }

    // Turnstile Verify
    if (process.env.TURNSTILE_SECRET_KEY) {
      const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
      const verifyData = new URLSearchParams();
      verifyData.append('secret', process.env.TURNSTILE_SECRET_KEY);
      verifyData.append('response', turnstileToken);

      try {
        const turnstileResponse = await fetch(verifyUrl, { method: 'POST', body: verifyData });
        const turnstileOutcome = await turnstileResponse.json();
        if (!turnstileOutcome.success) {
          return NextResponse.json({ error: 'Spam-Schutz fehlgeschlagen.' }, { status: 400 });
        }
      } catch (error) {
        return NextResponse.json({ error: 'Verbindungsfehler beim Spam-Schutz.' }, { status: 500 });
      }
    }

    // Ghost cleanup (Delete pending reservations older than 15 mins)
    try {
      const { and, lt, eq } = await import('drizzle-orm');
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      await db.delete(reservations).where(
        and(
          eq(reservations.status, 'pending'),
          lt(reservations.createdAt, thirtyMinsAgo)
        )
      );
    } catch (cleanupErr) {
      console.error('Failed to cleanup ghost reservations:', cleanupErr);
    }

    // Timezone safe date parsing (Use selectedTime or fallback to noon UTC)
    let timeString = '12:00';
    if (selectedTime) {
      timeString = selectedTime.split(' ')[0];
    }
    const safeDateStr = reservationDate.includes('T') ? reservationDate.split('T')[0] + `T${timeString}:00Z` : `${reservationDate}T${timeString}:00Z`;
    const parsedDate = new Date(safeDateStr);

    // Hole Event-Details aus der DB
    const eventList = await db.select().from(events).where(eq(events.id, eventId));
    if (eventList.length === 0) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 });
    }
    const event = eventList[0];

    // Prüfe ob Tables veröffentlicht sind
    if (event.publishTablesAt && new Date() < new Date(event.publishTablesAt)) {
      return NextResponse.json({ error: 'Reservierungen sind noch nicht freigeschaltet.' }, { status: 403 });
    }

    const { tables } = await import('@/db/schema');
    let table = null;
    
    let packagePriceCents = event.minimumConsumption || 5000;
    if (selectedPackage === 'brotzeit') {
      packagePriceCents = 2500;
    } else if (selectedPackage === 'vollgas') {
      packagePriceCents = 5000;
    }
    
    let amountTotal = packagePriceCents * guestCount; // in Cent
    
    if (tableId) {
      const tableList = await db.select().from(tables).where(eq(tables.id, tableId));
      if (tableList.length === 0) {
        return NextResponse.json({ error: 'Tisch nicht gefunden' }, { status: 404 });
      }
      table = tableList[0];

      if (guestCount > table.capacity) {
        return NextResponse.json({ error: `Tisch hat nur Kapazität für ${table.capacity} Personen.` }, { status: 400 });
      }
      
      if (table.isVip) {
        amountTotal += table.vipPrice || 0;
      }
    }

    let reservationId: string | undefined;

    const { and, sql } = await import('drizzle-orm');

    // 1. Transaction für Atomarität und Lock
    try {
      await db.transaction(async (tx) => {
        if (event.maxCapacity && event.maxCapacity > 0) {
          // Event Lock (verhindert Race Conditions auf die globale Kapazität)
          await tx.execute(sql`SELECT 1 FROM ${events} WHERE id = ${event.id} FOR UPDATE`);
          
          const allRes = await tx.select().from(reservations).where(
            and(
              eq(reservations.eventId, event.id),
              eq(reservations.reservationDate, parsedDate)
            )
          );
          
          let currentTotal = 0;
          for (const r of allRes) {
            if (r.status === 'cancelled') continue;
            if (r.status === 'paid' || r.status === 'confirmed') {
              currentTotal += r.guestCount;
            } else if (r.status === 'pending') {
              const diffMs = new Date().getTime() - new Date(r.createdAt).getTime();
              if (diffMs < 30 * 60 * 1000) {
                currentTotal += r.guestCount;
              }
            }
          }
          
          if (currentTotal + guestCount > event.maxCapacity) {
            throw new Error('Leider sind für diesen Tag nicht mehr ausreichend Plätze verfügbar.');
          }
        }

        if (table) {
          // Table Lock (verhindert Race Conditions: parallel Requests auf denselben Tisch warten nacheinander)
          await tx.execute(sql`SELECT 1 FROM ${tables} WHERE id = ${table.id} FOR UPDATE`);

          const existingRes = await tx.select().from(reservations).where(
            and(
              eq(reservations.eventId, event.id),
              eq(reservations.reservationDate, parsedDate),
              eq(reservations.tableId, table.id)
            )
          );
          
          // Blockiere nur, wenn 'paid'/'confirmed', oder wenn 'pending' und jünger als 15 Minuten
          const activeRes = existingRes.filter(r => {
            if (r.status === 'cancelled') return false;
            if (r.status === 'paid' || r.status === 'confirmed') return true;
            if (r.status === 'pending') {
              const diffMs = new Date().getTime() - new Date(r.createdAt).getTime();
              return diffMs < 30 * 60 * 1000; // 30 Minuten blockiert
            }
            return false;
          });

          if (activeRes.length > 0) {
            throw new Error('Dieser Tisch ist an diesem Datum bereits reserviert oder wird gerade gebucht.');
          }
        }

        // Vorläufig als 'pending' speichern
        const inserted = await tx.insert(reservations).values({
          eventId: event.id,
          tableId: table ? table.id : null,
          guestName: name,
          email: email,
          guestCount: guestCount,
          amountTotal: amountTotal,
          reservationDate: parsedDate,
          status: 'pending'
        }).returning({ id: reservations.id });

        reservationId = inserted[0].id;
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // 2. Erstelle Stripe Checkout Session (außerhalb der DB Transaction!)
    try {
      const origin = req.headers.get('origin') || 'http://localhost:3000';

      const lineItems: any[] = [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Reservierung: ${event.title}`,
              description: `Paket: ${selectedPackage === 'brotzeit' ? 'Brotzeit' : selectedPackage === 'vollgas' ? 'Vollgas' : 'Standard'} für ${guestCount} Personen`,
            },
            unit_amount: packagePriceCents,
          },
          quantity: guestCount,
        },
      ];

      if (table && table.isVip && table.vipPrice && table.vipPrice > 0) {
        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: `VIP Aufpreis`,
              description: `Tisch: ${table.name}`,
            },
            unit_amount: table.vipPrice,
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'paypal', 'klarna', 'sepa_debit'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?canceled=true`,
        customer_email: email,
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
        metadata: {
          reservationId: reservationId!
        }
      });

      // Session ID in der DB hinterlegen
      await db.update(reservations)
        .set({ stripeSessionId: session.id })
        .where(eq(reservations.id, reservationId!));

      return NextResponse.json({ url: session.url });
    } catch (stripeErr: any) {
      // Rollback: Wenn Stripe fehlschlägt, lösche die vorläufige Reservierung wieder
      if (reservationId) {
        await db.delete(reservations).where(eq(reservations.id, reservationId));
      }
      throw stripeErr;
    }
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}