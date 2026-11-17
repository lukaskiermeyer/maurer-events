import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { festChances } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  wirtStatus: z.enum(["neu", "kontaktiert", "im_gespraech", "angebot", "gewonnen", "verloren", "vertagt"]).optional(),
  wirtNotiz: z.string().nullable().optional(),
  wiedervorlage: z.string().nullable().optional(),
}).strict();

function getToken(request: Request): string {
  const auth = request.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  return (request.headers.get("x-api-key") || request.headers.get("x-n8n-api-key") || "").trim();
}

function expectedToken(): string {
  return (process.env.MAURER_API_KEY || "").trim();
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

import crypto from "node:crypto";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expected = expectedToken();
  if (!expected) return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 500 });
  const provided = getToken(request);
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation_error", details: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const update: Partial<typeof festChances.$inferInsert> = { updatedAt: new Date() };
  if (data.wirtStatus !== undefined) update.wirtStatus = data.wirtStatus;
  if (data.wirtNotiz !== undefined) update.wirtNotiz = data.wirtNotiz;
  if (data.wiedervorlage !== undefined) update.wiedervorlage = data.wiedervorlage ? new Date(data.wiedervorlage + "T00:00:00Z") : null;

  await db.update(festChances).set(update).where(eq(festChances.id, id));
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  void request; void params;
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}