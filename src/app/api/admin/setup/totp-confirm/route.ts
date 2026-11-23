import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { setupConfirmTotp, flowError } from "@/lib/admin-auth-flow";
import { boundedJson, bodyError } from "@/lib/request-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await boundedJson<{ token?: string; pin?: string | null; code?: string } | null>(request).catch(bodyError);
  if (body instanceof NextResponse) return body;
  const h = await headers();
  const result = await setupConfirmTotp({
    tokenId: "",
    rawToken: String(body?.token || ""),
    pin: body?.pin ?? null,
    code: String(body?.code || ""),
    ctx: {
      ip: (h.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100) || "unknown",
      userAgent: h.get("user-agent"),
    },
  });
  if (!result.ok) return NextResponse.json({ error: flowError(result) }, { status: 400 });
  return NextResponse.json({ ok: true, recoveryCodes: result.recoveryCodes });
}
