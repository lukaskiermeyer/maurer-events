import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { setupStartTotp, setupValidate, flowError } from "@/lib/admin-auth-flow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; pin?: string | null } | null;
  const validation = await setupValidate({ rawToken: String(body?.token || ""), pin: body?.pin ?? null });
  if (!validation.ok) return NextResponse.json({ error: "Link ungültig oder abgelaufen." }, { status: 400 });
  const h = await headers();
  const result = await setupStartTotp({
    tokenId: validation.tokenId,
    rawToken: String(body?.token || ""),
    pin: body?.pin ?? null,
    ctx: {
      ip: (h.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100) || "unknown",
      userAgent: h.get("user-agent"),
    },
  });
  if (!result.ok) return NextResponse.json({ error: flowError(result) }, { status: 400 });
  return NextResponse.json({ ok: true, secret: result.secret, qrDataUrl: result.qrDataUrl });
}
