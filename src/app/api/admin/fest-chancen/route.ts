import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import { festChances } from "@/db/schema";
import { and, eq, gte, ilike, ne, or, sql, desc, asc } from "drizzle-orm";
import { csvCell } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function expectedToken(): string {
  return (process.env.MAURER_API_KEY || "").trim();
}

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

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function methodNotAllowed() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

const CSV_COLUMNS = [
  "id",
  "urlHash",
  "sourceUrl",
  "sourceUrlNormalized",
  "title",
  "organizer",
  "location",
  "region",
  "eventDate",
  "monthsAhead",
  "jubileeYears",
  "festwirtStatus",
  "eventType",
  "contactName",
  "contactEmail",
  "contactPhone",
  "emergency",
  "score",
  "scoreReason",
  "nimModel",
  "runId",
  "status",
  "leadType",
  "wirtStatus",
  "wiedervorlage",
  "eventKey",
  "notes",
  "discoveredAt",
  "lastSeenAt",
  "createdAt",
  "updatedAt",
];



export async function GET(request: Request) {
  const expected = expectedToken();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 500 });
  }
  const provided = getToken(request);
  if (!provided || !safeEqual(provided, expected)) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const region = url.searchParams.get("region");
  const leadType = url.searchParams.get("leadType");
  const wirtStatus = url.searchParams.get("wirtStatus");
  const minScoreRaw = url.searchParams.get("minScore");
  const q = url.searchParams.get("q");
  const sort = url.searchParams.get("sort") || "-score";
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const format = url.searchParams.get("format");

  const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(offsetRaw || "0", 10) || 0, 0);
  const minScore = minScoreRaw !== null ? parseInt(minScoreRaw, 10) : null;

  const conditions = [];
  if (status) conditions.push(eq(festChances.status, status));
  else conditions.push(ne(festChances.status, "deleted"));
  if (region) conditions.push(eq(festChances.region, region));
  if (leadType) conditions.push(eq(festChances.leadType, leadType));
  if (wirtStatus) conditions.push(eq(festChances.wirtStatus, wirtStatus));
  if (minScore !== null && !Number.isNaN(minScore)) conditions.push(gte(festChances.score, minScore));
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(festChances.title, like),
        ilike(festChances.organizer, like),
        ilike(festChances.location, like),
        ilike(festChances.sourceUrl, like),
      ),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy = [];
  const descSort = sort.startsWith("-");
  const field = descSort ? sort.slice(1) : sort;
  const col =
    field === "discoveredAt"
      ? festChances.discoveredAt
      : field === "createdAt"
        ? festChances.createdAt
        : field === "score"
          ? festChances.score
          : festChances.score;
  orderBy.push(descSort ? desc(col) : asc(col));
  if (field !== "discoveredAt") orderBy.push(desc(festChances.discoveredAt));

  const [totalRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(festChances)
    .where(where);
  const total = totalRow?.n ?? 0;

  const items = await db
    .select()
    .from(festChances)
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

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
        "content-disposition": 'attachment; filename="fest-chancen.csv"',
      },
    });
  }

  return NextResponse.json({ ok: true, total, items });
}

export async function POST(request?: Request) {
  void request;
  return methodNotAllowed();
}
export async function PUT(request?: Request) {
  void request;
  return methodNotAllowed();
}
export async function PATCH(request?: Request) {
  void request;
  return methodNotAllowed();
}
export async function DELETE(request?: Request) {
  void request;
  return methodNotAllowed();
}
export async function HEAD(request?: Request) {
  void request;
  return methodNotAllowed();
}
export async function OPTIONS(request?: Request) {
  void request;
  return methodNotAllowed();
}