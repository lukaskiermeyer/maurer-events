import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { vereinsRadar } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 100;

const STATUS_VALUES = ["connecten", "jetzt_anbieten", "beobachten"] as const;

const ItemSchema = z.object({
  leadKey: z.string().min(1),
  vereinName: z.string().nullable().optional().default(null),
  ort: z.string().nullable().optional().default(null),
  region: z.string().nullable().optional().default(null),
  vereinsTyp: z.string().nullable().optional().default(null),
  foundingYear: z.number().int().nullable().optional().default(null),
  mitglieder: z.number().int().nullable().optional().default(null),
  eventYear: z.number().int().nullable().optional().default(null),
  jubileeYears: z.number().int().nullable().optional().default(null),
  monthsAhead: z.number().int().nullable().optional().default(null),
  dateAssumed: z.boolean().optional().default(false),
  phase: z.string().nullable().optional().default(null),
  status: z.enum(STATUS_VALUES).optional().default("beobachten"),
  score: z.number().int().min(0).max(100).default(0),
  scoreReason: z.string().nullable().optional().default(null),
  planningSignals: z.array(z.string()).optional().default([]),
  incumbentFestwirt: z.string().nullable().optional().default(null),
  brauereiPartner: z.string().nullable().optional().default(null),
  contactName: z.string().nullable().optional().default(null),
  contactRole: z.string().nullable().optional().default(null),
  contactEmail: z.string().nullable().optional().default(null),
  contactPhone: z.string().nullable().optional().default(null),
  nextAction: z.string().nullable().optional().default(null),
  sourceUrl: z.string().nullable().optional().default(null),
  domain: z.string().nullable().optional().default(null),
  contentHash: z.string().nullable().optional().default(null),
  queryType: z.string().nullable().optional().default(null),
  runId: z.string().nullable().optional().default(null),
  discoveredAt: z.string().datetime().optional(),
});

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

function expectedToken(): string {
  return (process.env.MAURER_API_KEY || "").trim();
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function monthsAheadFromEventYear(year: number | null | undefined): number | null {
  if (!year) return null;
  const now = new Date();
  const eventDate = new Date(Date.UTC(year, 5, 1)); // 1. Juni
  const diffMs = eventDate.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
}

function methodNotAllowed() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const expected = expectedToken();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 500 });
  }
  const provided = getToken(request);
  if (!provided || !safeEqual(provided, expected)) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, errors: [{ index: 0, path: "body", message: "Invalid JSON" }] },
      { status: 400 },
    );
  }

  if (!Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, errors: [{ index: 0, path: "body", message: "Expected JSON array" }] },
      { status: 400 },
    );
  }
  if (body.length > MAX_ITEMS) {
    return NextResponse.json(
      { ok: false, errors: [{ index: 0, path: "body", message: `Too many items (max ${MAX_ITEMS})` }] },
      { status: 400 },
    );
  }

  const errors: { index: number; path: string; message: string }[] = [];
  const parsedItems: (z.infer<typeof ItemSchema> | null)[] = [];
  body.forEach((raw, index) => {
    const result = ItemSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ index, path: issue.path.length ? issue.path.join(".") : "item", message: issue.message });
      }
      parsedItems.push(null);
    } else {
      parsedItems.push(result.data);
    }
  });

  const validItems = parsedItems.filter((v): v is z.infer<typeof ItemSchema> => v !== null);
  const invalidCount = parsedItems.length - validItems.length;

  if (validItems.length === 0 && errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const now = new Date();

  let inserted = 0;
  let updated = 0;
  let skipped = invalidCount;

  try {
    await db.transaction(async (tx) => {
      for (const item of validItems) {
        await tx.execute(sql`SAVEPOINT item_sp`);
        try {
          const existing = await tx
            .select()
            .from(vereinsRadar)
            .where(eq(vereinsRadar.leadKey, item.leadKey))
            .limit(1);

          // contentHash identical AND no new planningSignals -> skipped
          const newSignals = item.planningSignals || [];
          const oldSignals: string[] = Array.isArray(existing[0]?.planningSignals) ? existing[0].planningSignals : [];
          const mergedSignals = Array.from(new Set([...oldSignals, ...newSignals]));
          const hasNewSignals = newSignals.some((s) => !oldSignals.includes(s));

          if (existing.length > 0) {
            const old = existing[0];
            if (item.contentHash && old.contentHash === item.contentHash && !hasNewSignals) {
              // skipped: nur lastSeenAt
              await tx.update(vereinsRadar).set({ lastSeenAt: now, updatedAt: now }).where(eq(vereinsRadar.id, old.id));
              skipped++;
              continue;
            }

            // Upsert
            const updateSet: Partial<typeof vereinsRadar.$inferInsert> = {
              lastSeenAt: now,
              updatedAt: now,
              planningSignals: mergedSignals,
            };
            if (item.vereinName != null) updateSet.vereinName = item.vereinName;
            if (item.ort != null) updateSet.ort = item.ort;
            if (item.region != null) updateSet.region = item.region;
            if (item.vereinsTyp != null) updateSet.vereinsTyp = item.vereinsTyp;
            if (item.foundingYear != null) updateSet.foundingYear = item.foundingYear;
            if (item.mitglieder != null) updateSet.mitglieder = item.mitglieder;
            if (item.eventYear != null) updateSet.eventYear = item.eventYear;
            if (item.jubileeYears != null) updateSet.jubileeYears = item.jubileeYears;
            if (item.phase != null) updateSet.phase = item.phase;
            if (item.status) updateSet.status = item.status;
            if (item.score !== undefined) updateSet.score = item.score;
            if (item.scoreReason != null) updateSet.scoreReason = item.scoreReason;
            if (item.incumbentFestwirt != null) updateSet.incumbentFestwirt = item.incumbentFestwirt;
            if (item.brauereiPartner != null) updateSet.brauereiPartner = item.brauereiPartner;
            if (item.contactName != null) updateSet.contactName = item.contactName;
            if (item.contactRole != null) updateSet.contactRole = item.contactRole;
            if (item.contactEmail != null) updateSet.contactEmail = item.contactEmail;
            if (item.contactPhone != null) updateSet.contactPhone = item.contactPhone;
            if (item.nextAction != null) updateSet.nextAction = item.nextAction;
            if (item.sourceUrl != null) updateSet.sourceUrl = item.sourceUrl;
            if (item.domain != null) updateSet.domain = item.domain;
            if (item.contentHash != null) updateSet.contentHash = item.contentHash;
            if (item.queryType != null) updateSet.queryType = item.queryType;
            if (item.runId != null) updateSet.runId = item.runId;
            if (item.dateAssumed !== undefined) updateSet.dateAssumed = item.dateAssumed;
            // monthsAhead dynamisch aus eventYear neu berechnen
            const ey = item.eventYear ?? old.eventYear;
            const ma = monthsAheadFromEventYear(ey);
            if (ma !== null) updateSet.monthsAhead = ma;
            if (item.discoveredAt) updateSet.discoveredAt = new Date(item.discoveredAt);

            await tx.update(vereinsRadar).set(updateSet).where(eq(vereinsRadar.id, old.id));
            updated++;
          } else {
            const ey = item.eventYear;
            const ma = item.monthsAhead ?? monthsAheadFromEventYear(ey);
            await tx.insert(vereinsRadar).values({
              leadKey: item.leadKey,
              vereinName: item.vereinName,
              ort: item.ort,
              region: item.region,
              vereinsTyp: item.vereinsTyp,
              foundingYear: item.foundingYear,
              mitglieder: item.mitglieder,
              eventYear: item.eventYear,
              jubileeYears: item.jubileeYears,
              monthsAhead: ma,
              dateAssumed: item.dateAssumed,
              phase: item.phase,
              status: item.status || "beobachten",
              score: item.score,
              scoreReason: item.scoreReason,
              planningSignals: newSignals,
              incumbentFestwirt: item.incumbentFestwirt,
              brauereiPartner: item.brauereiPartner,
              contactName: item.contactName,
              contactRole: item.contactRole,
              contactEmail: item.contactEmail,
              contactPhone: item.contactPhone,
              nextAction: item.nextAction,
              sourceUrl: item.sourceUrl,
              domain: item.domain,
              contentHash: item.contentHash,
              queryType: item.queryType,
              runId: item.runId,
              discoveredAt: item.discoveredAt ? new Date(item.discoveredAt) : now,
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now,
              wirtStatus: "neu",
            });
            inserted++;
          }
        } catch {
          await tx.execute(sql`ROLLBACK TO SAVEPOINT item_sp`);
          skipped++;
        } finally {
          await tx.execute(sql`RELEASE SAVEPOINT item_sp`);
        }
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }

  // Record run? vereins_radar has no festRuns table; skip.

  return NextResponse.json({
    ok: true,
    received: body.length,
    inserted,
    updated,
    skipped,
  });
}

export async function GET(request?: Request) {
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