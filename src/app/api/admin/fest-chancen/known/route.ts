import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import { festChances, vereinsRadar } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getToken(request: Request): string {
  const auth = request.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  return (
    request.headers.get("x-api-key") ||
    request.headers.get("x-n8n-api-key") ||
    ""
  ).trim();
}

function expectedTokens(): string[] {
  return [process.env.MAURER_API_KEY, process.env.FEST_CHANCEN_INGEST_TOKEN]
    .map((v) => (v || "").trim())
    .filter(Boolean);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function isAuthorized(provided: string, expected: string[]): boolean {
  return expected.some((tok) => safeEqual(provided, tok));
}

const RADAR_REVERIFY_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const expected = expectedTokens();
  if (expected.length === 0) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 500 });
  }
  const provided = getToken(request);
  if (!provided || !isAuthorized(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const reverifyCutoff = now.getTime() - RADAR_REVERIFY_MS;

  const [chanceRows, radarRows] = await Promise.all([
    db
      .select({
        sourceUrlNormalized: festChances.sourceUrlNormalized,
        eventKey: festChances.eventKey,
        status: festChances.status,
      })
      .from(festChances),
    db
      .select({
        domain: vereinsRadar.domain,
        leadKey: vereinsRadar.leadKey,
        status: vereinsRadar.status,
        verifiedAt: vereinsRadar.verifiedAt,
        lastSeenAt: vereinsRadar.lastSeenAt,
      })
      .from(vereinsRadar),
  ]);

  const urls = Array.from(
    new Set(chanceRows.map((r) => r.sourceUrlNormalized).filter(Boolean)),
  );
  const eventKeys = Array.from(
    new Set(chanceRows.map((r) => r.eventKey).filter((v): v is string => Boolean(v))),
  );

  // Skip radar domains that are either soft-deleted OR already verified within the last 90 days.
  // Unverified or older (>90d) domains stay eligible for fresh event enrichment.
  const radarSkipDomains = Array.from(
    new Set(
      radarRows
        .filter((r) => {
          if (!r.domain) return false;
          if (r.status === "deleted") return true;
          if (r.verifiedAt && r.verifiedAt.getTime() >= reverifyCutoff) return true;
          return false;
        })
        .map((r) => r.domain as string),
    ),
  );
  const radarDeletedLeadKeys = Array.from(
    new Set(radarRows.filter((r) => r.status === "deleted").map((r) => r.leadKey)),
  );

  return NextResponse.json({
    ok: true,
    today,
    urls,
    eventKeys,
    radarDomains: radarSkipDomains,
    radarDeletedLeadKeys,
  });
}

export async function POST() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
