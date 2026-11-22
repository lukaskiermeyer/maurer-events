import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminSession } from '@/lib/admin-session';
import { hmacSha256 } from '@/lib/admin-crypto';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-adm_session')?.value;
  const sess = await getAdminSession(token);
  if (!sess) {
    const res = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  const csrfToken = hmacSha256(token!, 'csrf');
  const res = NextResponse.json({
    admin: {
      id: sess.admin.id,
      email: sess.admin.email,
      displayName: sess.admin.displayName,
      status: sess.admin.status,
    },
    csrfToken,
    session: {
      idleExpiresAt: sess.session.idleExpiresAt,
      absoluteExpiresAt: sess.session.absoluteExpiresAt,
      stepUpValid: sess.stepUpValid,
    },
    credentialCount: null,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}