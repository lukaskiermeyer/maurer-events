import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { markStepUp, flowError } from "@/lib/admin-auth-flow";
import { boundedJson, bodyError } from "@/lib/request-body";

export const runtime = "nodejs";

// Frisches TOTP (<= 5 min) für kritische Aktionen im Admin-Bereich.
export async function POST(request: Request) {
  const body = await boundedJson<{ code?: string } | null>(request).catch(bodyError);
  if (body instanceof NextResponse) return body;
  const token = (await cookies()).get("__Host-adm_session")?.value;
  if (!token) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const h = await headers();
  const result = await markStepUp(token, String(body?.code || ""), {
    ip: (h.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100) || "unknown",
    userAgent: h.get("user-agent"),
  });
  if (!result.ok) return NextResponse.json({ error: flowError(result) }, { status: 401 });
  return NextResponse.json({ ok: true });
}
