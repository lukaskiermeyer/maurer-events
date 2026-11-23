import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { timingSafeEqualHex } from "@/lib/admin-crypto";
import { completeTotpLogin, csrfTokenFor, flowError } from "@/lib/admin-auth-flow";
import { boundedJson, bodyError } from "@/lib/request-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await boundedJson<{ code?: string; trustDevice?: boolean; csrf?: string } | null>(request).catch(bodyError);
  if (body instanceof NextResponse) return body;
  const cookieStore = await cookies();
  const mfaToken = cookieStore.get("__Host-adm_mfa")?.value;
  if (!mfaToken) return NextResponse.json({ error: "Bitte zuerst mit E-Mail und Passwort anmelden." }, { status: 401 });
  const expected = csrfTokenFor(mfaToken);
  if (!body?.csrf || !timingSafeEqualHex(expected, String(body.csrf))) {
    return NextResponse.json({ error: "Sitzung abgelaufen. Bitte neu anmelden." }, { status: 403 });
  }
  const h = await headers();
  const flowCtx = {
    ip: (h.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100) || "unknown",
    userAgent: h.get("user-agent"),
  };
  const result = await completeTotpLogin({
    mfaToken,
    code: String(body.code || ""),
    trustDevice: body.trustDevice === true,
    ctx: flowCtx,
  });
  if (!result.ok) return NextResponse.json({ error: flowError(result) }, { status: 401 });

  const res = NextResponse.json({ ok: true, recoveryLeft: result.recoveryLeft });
  res.headers.set("Cache-Control", "no-store");
  res.cookies.delete("__Host-adm_mfa");
  res.cookies.set("__Host-adm_session", result.sessionToken, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 30 * 86400 });
  if (result.trustedDeviceToken) {
    res.cookies.set("__Host-adm_trusted", result.trustedDeviceToken, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 30 * 86400 });
  }
  return res;
}
