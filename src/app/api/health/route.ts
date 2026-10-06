import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
    try {
        // A connected database with missing booking migrations is not ready.
        await db.execute(sql`SELECT r.request_hash, r.checkout_params, r.ticket_email_payload, r.ticket_sent_at,
          a.attempts, l.reset_at, 'payment_pending'::public.reservation_status
          FROM public.reservations r CROSS JOIN public.admin_auth a CROSS JOIN public.security_rate_limits l LIMIT 0`);
        return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers });
    } catch {
        return NextResponse.json(
            { status: 'error', error: 'Database unavailable or migrations missing' },
            { status: 503, headers }
        );
    }
}
