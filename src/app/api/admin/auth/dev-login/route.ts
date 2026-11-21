import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { adminSessions } from '@/db/schema';
import { isAdminEmailWithDb } from '@/lib/admin-identity';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const email = (process.env.ADMIN_EMAILS || 'servus@maurer-events.com').split(',')[0].trim().toLowerCase();
  const ok = await isAdminEmailWithDb(db, email);
  if (!ok) {
    return NextResponse.json({ error: 'Admin email not allowed' }, { status: 403 });
  }
  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [session] = await db.insert(adminSessions).values({ email, validUntil }).returning();
  const cookieStore = await cookies();
  cookieStore.set('admin_token', session.id, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    expires: validUntil,
    path: '/',
  });
  return NextResponse.redirect(new URL('/de/admin', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
}