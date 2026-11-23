import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireAdminStepUp } from '@/lib/auth';
import { requestPasswordReset } from '@/lib/admin-auth-flow';
import { boundedJson, bodyError } from '@/lib/request-body';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let actor: Awaited<ReturnType<typeof requireAdminStepUp>>;
  try {
    actor = await requireAdminStepUp();
  } catch {
    return NextResponse.json({ error: 'Frische TOTP-Bestätigung erforderlich.' }, { status: 403 });
  }
  const body = await boundedJson<{ email?: string } | null>(request).catch(bodyError);
  if (body instanceof NextResponse) return body;
  const h = await headers();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
  // Immer identische Antwort – keine Enumeration.
  await requestPasswordReset({
    email: String(body?.email || ''),
    actorAdminId: actor.adminId,
    baseUrl,
    ctx: { ip: (h.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 100) || 'unknown', userAgent: h.get('user-agent') },
  });
  return NextResponse.json({ ok: true, message: 'Falls das Konto existiert, wurde eine Reset-Mail gesendet. Der Reset ändert nur das Passwort – TOTP bleibt Pflicht.' });
}
