import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeAdminSession } from '@/lib/admin-session';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-adm_session')?.value;
  if (token) {
    await revokeAdminSession(token, 'logout');
  }
  cookieStore.delete('__Host-adm_session');
  cookieStore.delete('__Host-adm_mfa');
  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}