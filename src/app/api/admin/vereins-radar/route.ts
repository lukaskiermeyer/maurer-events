import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import { vereinsRadar } from "@/db/schema";
import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { csvCell } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const CSV_COLUMNS = [
  "id", "leadKey", "vereinName", "ort", "region", "vereinsTyp", "foundingYear",
  "mitglieder", "eventYear", "jubileeYears", "monthsAhead", "dateAssumed", "phase",
  "status", "score", "scoreReason", "planningSignals", "incumbentFestwirt",
  "brauereiPartner", "contactName", "contactRole", "contactEmail", "contactPhone",
  "nextAction", "sourceUrl", "domain", "contentHash", "queryType", "runId",
  "wirtStatus", "wirtNotiz", "wiedervorlage", "discoveredAt", "lastSeenAt",
];



export async function GET(request: Request) {
  const expected = expectedToken();
  if (!expected) return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 500 });
  const provided = getToken(request);
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const region = url.searchParams.get("region");
  const wirtStatus = url.searchParams.get("wirtStatus");
  const minScoreRaw = url.searchParams.get("minScore");
  const q = url.searchParams.get("q");
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const format = url.searchParams.get("format");

  const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(offsetRaw || "0", 10) || 0, 0);
  const minScore = minScoreRaw !== null ? parseInt(minScoreRaw, 10) : null;

  const conditions = [];
  if (status) conditions.push(eq(vereinsRadar.status, status));
  if (region) conditions.push(eq(vereinsRadar.region, region));
  if (wirtStatus) conditions.push(eq(vereinsRadar.wirtStatus, wirtStatus));
  if (minScore !== null && !Number.isNaN(minScore)) conditions.push(gte(vereinsRadar.score, minScore));
  if (q) {
    const like = `%${q}%`;
    conditions.push(or(ilike(vereinsRadar.vereinName, like), ilike(vereinsRadar.ort, like), ilike(vereinsRadar.sourceUrl, like)));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ n: sql<number>`count(*)::int` }).from(vereinsRadar).where(where);
  const total = totalRow?.n ?? 0;

  const items = await db
    .select()
    .from(vereinsRadar)
    .where(where)
    .orderBy(desc(vereinsRadar.score), desc(vereinsRadar.discoveredAt))
    .limit(limit)
    .offset(offset);

  // monthsAhead dynamisch aus eventYear (Annahme 1. Juni) neu berechnen
  const now = new Date();
  for (const it of items as (typeof items)[number][]) {
    if (it.eventYear) {
      const ev = new Date(Date.UTC(it.eventYear, 5, 1));
      it.monthsAhead = Math.round((ev.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    }
  }

  if (format === "csv") {
    const header = CSV_COLUMNS.join(",");
    const lines = [header];
    for (const row of items) {
      lines.push(CSV_COLUMNS.map((c) => csvCell((row as Record<string, unknown>)[c])).join(","));
    }
    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="vereins-radar.csv"',
      },
    });
  }

  return NextResponse.json({ ok: true, total, items });
}

export async function POST(request?: Request) {
  void request;
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
export async function PUT(request?: Request) {
  void request;
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
export async function PATCH(request?: Request) {
  void request;
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
export async function DELETE(request?: Request) {
  void request;
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
export async function HEAD(request?: Request) {
  void request;
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
export async function OPTIONS(request?: Request) {
  void request;
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}