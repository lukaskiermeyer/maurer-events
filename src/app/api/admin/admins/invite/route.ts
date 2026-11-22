import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireAdminStepUp } from '@/lib/auth';
import { inviteAdmin, flowError } from '@/lib/admin-auth-flow';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let actor: Awaited<ReturnType<typeof requireAdminStepUp>>;
  try {
    actor = await requireAdminStepUp();
  } catch {
    return NextResponse.json({ error: 'Frische TOTP-Bestätigung erforderlich.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const h = await headers();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
  const result = await inviteAdmin({
    email: String(body?.email || ''),
    actorAdminId: actor.adminId,
    baseUrl,
    ctx: { ip: (h.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 100) || 'unknown', userAgent: h.get('user-agent') },
  });
  if (!result.ok) return NextResponse.json({ error: flowError(result) }, { status: 400 });
  // PIN wird EINMALIG hier gezeigt – Hinweis: separat durchgeben, nicht in die Mail.
  return NextResponse.json({ ok: true, link: result.link, pin: result.pin, expiresAt: result.expiresAt });
}
