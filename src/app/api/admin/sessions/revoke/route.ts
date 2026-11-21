import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { adminPasskeySessions } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getAdminSession, revokeAdminSession } from '@/lib/admin-session';
import { appendAuditEvent } from '@/lib/admin-audit';
import { ipHash } from '@/lib/admin-crypto';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-adm_session')?.value;
  const sess = await getAdminSession(token);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!sess.stepUpValid) return NextResponse.json({ error: 'step_up_required' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const targetHash = body?.tokenHash;
  if (!targetHash) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // revoke by tokenHash if belongs to same admin
  await db.update(adminPasskeySessions)
    .set({ revokedAt: new Date(), revokeReason: 'admin_revoke' })
    .where(and(eq(adminPasskeySessions.tokenHash, targetHash), eq(adminPasskeySessions.adminId, sess.adminId)));

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  await appendAuditEvent({
    actorAdminId: sess.adminId,
    subjectAdminId: sess.adminId,
    eventType: 'session.revoked',
    ipHash: ipHash(ip),
    userAgent: req.headers.get('user-agent'),
    metadata: { targetHash },
  });

  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}