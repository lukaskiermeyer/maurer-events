import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { adminAuditLog } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-adm_session')?.value;
  const sess = await getAdminSession(token);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') || 50);
  const offsetParam = Number(url.searchParams.get('offset') || 0);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 200) : 50;
  const offset = Number.isFinite(offsetParam) ? Math.max(Math.trunc(offsetParam), 0) : 0;

  const rows = await db.select().from(adminAuditLog)
    .orderBy(desc(adminAuditLog.id))
    .limit(limit)
    .offset(offset);

  const res = NextResponse.json({ entries: rows });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}