import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { adminPasskeySessions } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin-session';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-adm_session')?.value;
  const sess = await getAdminSession(token);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sessions = await db.select({
    id: adminPasskeySessions.tokenHash,
    createdAt: adminPasskeySessions.createdAt,
    lastSeenAt: adminPasskeySessions.lastSeenAt,
    idleExpiresAt: adminPasskeySessions.idleExpiresAt,
    absoluteExpiresAt: adminPasskeySessions.absoluteExpiresAt,
    userAgent: adminPasskeySessions.userAgent,
    deviceLabel: adminPasskeySessions.deviceLabel,
  }).from(adminPasskeySessions)
    .where(and(eq(adminPasskeySessions.adminId, sess.adminId), isNull(adminPasskeySessions.revokedAt)));

  const res = NextResponse.json({ sessions });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}