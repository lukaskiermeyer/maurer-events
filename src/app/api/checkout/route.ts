import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { createCheckoutService } from '@/lib/checkout';
import { BookingError } from '@/lib/reservation-policy';
import { boundedBody } from '@/lib/request-body';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    const expected = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').origin;
    if (origin && origin !== expected) throw new BookingError('Ungültiger Ursprung.', 403);
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new BookingError('JSON-Anfrage erforderlich.', 415);
    if (!process.env.STRIPE_SECRET_KEY) throw new BookingError('Zahlungsdienst nicht konfiguriert.', 503);
    const raw = await boundedBody(req, 16384);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new BookingError('Ungültiges JSON.'); }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia', timeout: 15000, maxNetworkRetries: 1 });
    return NextResponse.json(await createCheckoutService(db, stripe)(body), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Checkout failed:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Checkout vorübergehend nicht verfügbar.' }, { status: 503 });
  }
}
