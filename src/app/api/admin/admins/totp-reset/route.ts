import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { requireAdminStepUp } from '@/lib/auth';
import { resetTotpForAdmin, flowError } from '@/lib/admin-auth-flow';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let actor: Awaited<ReturnType<typeof requireAdminStepUp>>;
  try {
    actor = await requireAdminStepUp();
  } catch {
    return NextResponse.json({ error: 'Frische TOTP-Bestätigung erforderlich.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = String(body?.email || '').trim().toLowerCase();
  const [target] = await db.select().from(adminUsers).where(sql`lower(trim(${adminUsers.email})) = ${email}`);
  if (!target) return NextResponse.json({ error: 'Admin nicht gefunden.' }, { status: 404 });
  const h = await headers();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
  const result = await resetTotpForAdmin({
    targetAdminId: target.id,
    actorAdminId: actor.adminId,
    baseUrl,
    ctx: { ip: (h.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 100) || 'unknown', userAgent: h.get('user-agent') },
  });
  if (!result.ok) return NextResponse.json({ error: flowError(result) }, { status: 400 });
  return NextResponse.json({ ok: true, link: result.link });
}
