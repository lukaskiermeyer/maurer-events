import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { consumePasswordReset, setupSetPassword, setupValidate, flowError } from "@/lib/admin-auth-flow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; pin?: string | null; password?: string } | null;
  const h = await headers();
  const ctx = {
    ip: (h.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100) || "unknown",
    userAgent: h.get("user-agent"),
  };
  const result = await setupSetPassword({
    tokenId: "",
    rawToken: String(body?.token || ""),
    pin: body?.pin ?? null,
    password: String(body?.password || ""),
    ctx,
  });
  if (!result.ok) return NextResponse.json({ error: flowError(result) }, { status: 400 });
  const validation = await setupValidate({ rawToken: String(body?.token || ""), pin: body?.pin ?? null });
  if (validation.ok && validation.purpose === "password_reset") {
    // Kerninvariante: Reset setzt NUR das Passwort, TOTP bleibt Pflicht, Sessions weg.
    await consumePasswordReset({ tokenId: validation.tokenId, ctx });
    return NextResponse.json({ ok: true, next: "login" });
  }
  return NextResponse.json({ ok: true, next: "totp" });
}
