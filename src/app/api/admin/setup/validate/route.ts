import { NextResponse } from "next/server";
import { setupValidate } from "@/lib/admin-auth-flow";
import { boundedJson, bodyError } from "@/lib/request-body";

export const runtime = "nodejs";

// GET verbraucht den Token bewusst nicht – nur POST darf das.
export async function POST(request: Request) {
  const body = await boundedJson<{ token?: string; pin?: string | null } | null>(request).catch(bodyError);
  if (body instanceof NextResponse) return body;
  const result = await setupValidate({ rawToken: String(body?.token || ""), pin: body?.pin ?? null });
  if (!result.ok) return NextResponse.json({ error: "Link ungültig, abgelaufen oder PIN falsch." }, { status: 400 });
  return NextResponse.json({ ok: true, purpose: result.purpose, email: result.email, needsPin: result.needsPin, tokenId: result.tokenId });
}
