import { NextResponse } from 'next/server';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admins = await db.select({
    id: adminUsers.id,
    email: adminUsers.email,
    displayName: adminUsers.displayName,
    role: adminUsers.role,
    status: adminUsers.status,
    lastLoginAt: adminUsers.lastLoginAt,
    removedAt: adminUsers.removedAt,
    passwordSetAt: adminUsers.passwordSetAt,
    totpEnrolledAt: adminUsers.totpEnrolledAt,
  }).from(adminUsers);

  const res = NextResponse.json({ admins });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
