import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { timingSafeEqualHex } from "@/lib/admin-crypto";
import { loginWithPassword, tryTrustedDevice, flowError } from "@/lib/admin-auth-flow";
import { createAdminSession } from "@/lib/admin-session";
import { rotateTrustedDevice } from "@/lib/admin-mfa";
import { boundedJson, bodyError } from "@/lib/request-body";

export const runtime = "nodejs";

async function ctx() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100) || "unknown",
    userAgent: h.get("user-agent"),
  };
}

export async function POST(request: Request) {
  const body = await boundedJson<{ email?: string; password?: string; csrf?: string } | null>(request).catch(bodyError);
  if (body instanceof NextResponse) return body;
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get("adm_csrf")?.value || "";
  if (!body?.csrf || !csrfCookie || !timingSafeEqualHex(Buffer.from(body.csrf, "utf8").toString("hex"), Buffer.from(csrfCookie, "utf8").toString("hex"))) {
    return NextResponse.json({ error: "Sitzung abgelaufen. Bitte Seite neu laden." }, { status: 403 });
  }
  const flowCtx = await ctx();
  const result = await loginWithPassword({ email: String(body.email || ""), password: String(body.password || ""), ctx: flowCtx });
  if (!result.ok) {
    return NextResponse.json({ error: flowError(result) }, { status: 401 });
  }

  // Trusted Device überspringt nur den TOTP-Schritt (Passwort war bereits korrekt).
  const trustedRaw = cookieStore.get("__Host-adm_trusted")?.value || cookieStore.get("adm_trusted")?.value;
  if (trustedRaw) {
    const [email] = [String(body.email || "").trim().toLowerCase()];
    const device = await tryTrustedDevice({ email, trustedDeviceToken: trustedRaw, ctx: flowCtx });
    if (device) {
      const session = await createAdminSession({ adminId: device.adminId, userAgent: flowCtx.userAgent, ip: flowCtx.ip });
      const rotated = await rotateTrustedDevice(device.deviceId, session.token);
      const res = NextResponse.json({ ok: true, trusted: true });
      res.headers.set("Cache-Control", "no-store");
      res.cookies.set("__Host-adm_session", session.token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 30 * 86400 });
      res.cookies.set("__Host-adm_trusted", rotated, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 30 * 86400 });
      res.cookies.delete("__Host-adm_mfa");
      return res;
    }
  }

  const res = NextResponse.json({ mfaRequired: true, csrfToken: result.csrfToken });
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set("__Host-adm_mfa", result.mfaToken, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 300 });
  return res;
}
