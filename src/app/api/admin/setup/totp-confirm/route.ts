import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { setupConfirmTotp, setupValidate, flowError } from "@/lib/admin-auth-flow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; code?: string } | null;
  const validation = await setupValidate({ rawToken: String(body?.token || "") });
  if (!validation.ok) return NextResponse.json({ error: "Link ungültig oder abgelaufen." }, { status: 400 });
  const h = await headers();
  const result = await setupConfirmTotp({
    tokenId: validation.tokenId,
    rawToken: String(body?.token || ""),
    code: String(body?.code || ""),
    ctx: {
      ip: (h.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100) || "unknown",
      userAgent: h.get("user-agent"),
    },
  });
  if (!result.ok) return NextResponse.json({ error: flowError(result) }, { status: 400 });
  return NextResponse.json({ ok: true, recoveryCodes: result.recoveryCodes });
}
