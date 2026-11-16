import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { festChances, festOpportunities, festRuns } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 200;

const ItemSchema = z.object({
  sourceUrl: z.string().url(),
  sourceUrlNormalized: z.string().optional(),
  title: z.string().nullable().optional().default(null),
  organizer: z.string().nullable().optional().default(null),
  location: z.string().nullable().optional().default(null),
  region: z.string().nullable().optional().default(null),
  eventDate: z.string().nullable().optional().default(null),
  monthsAhead: z.number().int().nullable().optional().default(null),
  jubileeYears: z.number().int().nullable().optional().default(null),
  festwirtStatus: z.enum(["open", "taken", "unknown", "closed"]).default("unknown"),
  eventType: z.enum(["volksfest", "schuetzen", "trachten", "feuerwehr", "musik", "kirchweih", "other"]).default("other"),
  contactName: z.string().nullable().optional().default(null),
  contactEmail: z.string().nullable().optional().default(null),
  contactPhone: z.string().nullable().optional().default(null),
  emergency: z.boolean().default(false),
  score: z.number().int().min(0).max(100).default(0),
  scoreReason: z.string().nullable().optional().default(null),
  nimModel: z.string().nullable().optional().default(null),
  runId: z.string().nullable().optional().default(null),
  status: z.string().nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
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
  return (
    process.env.FEST_CHANCEN_INGEST_TOKEN ||
    process.env.MAURER_N8N_KEY ||
    process.env.MAURER_API_KEY ||
    ""
  );
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function normalizeUrl(raw: string): string {
  let url = raw.trim().toLowerCase();
  url = url.split("#")[0];
  url = url.split("?")[0];
  url = url.replace(/\/+$/, "");
  return url;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function methodNotAllowed() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function syncFestOpportunity(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  item: z.infer<typeof ItemSchema>,
  normalized: string,
  hash: string,
  itemRunId: string | null,
  now: Date,
) {
  const sourceUrl = item.sourceUrl.trim();
  const existing = await tx
    .select()
    .from(festOpportunities)
    .where(
      or(
        eq(festOpportunities.urlHash, hash),
        eq(festOpportunities.sourceUrlNormalized, normalized),
        eq(festOpportunities.sourceUrl, sourceUrl),
      ),
    )
    .limit(1);
  const eventDateTs = item.eventDate
    ? item.eventDate.includes("T")
      ? new Date(item.eventDate)
      : new Date(item.eventDate + "T00:00:00Z")
    : null;
  if (existing.length > 0) {
    await tx
      .update(festOpportunities)
      .set({
        urlHash: hash,
        sourceUrl,
        sourceUrlNormalized: normalized,
        score: item.score,
        scoreReason: item.scoreReason,
        festwirtStatus: item.festwirtStatus,
        eventDate: eventDateTs,
        monthsAhead: item.monthsAhead,
        jubileeYears: item.jubileeYears,
        contactName: item.contactName,
        contactEmail: item.contactEmail,
        contactPhone: item.contactPhone,
        n8nRunId: itemRunId,
        updatedAt: now,
      })
      .where(eq(festOpportunities.id, existing[0].id));
  } else {
    await tx.insert(festOpportunities).values({
      title: item.title,
      organizer: item.organizer,
      location: item.location,
      region: item.region,
      eventDate: eventDateTs,
      jubileeYears: item.jubileeYears,
      categories: [],
      contactName: item.contactName,
      contactEmail: item.contactEmail,
      contactPhone: item.contactPhone,
      sourceUrl,
      sourceUrlNormalized: normalized,
      urlHash: hash,
      notes: item.notes,
      festwirtStatus: item.festwirtStatus,
      score: item.score,
      scoreReason: item.scoreReason,
      monthsAhead: item.monthsAhead,
      status: "new",
      discoveredAt: item.discoveredAt ? new Date(item.discoveredAt) : now,
      n8nRunId: itemRunId,
      updatedAt: now,
    });
  }
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
        errors.push({
          index,
          path: issue.path.length ? issue.path.join(".") : "item",
          message: issue.message,
        });
      }
      parsedItems.push(null);
    } else {
      parsedItems.push(result.data);
    }
  });

  const validItems = parsedItems.filter(
    (v): v is z.infer<typeof ItemSchema> => v !== null,
  );
  const invalidCount = parsedItems.length - validItems.length;

  // If nothing is processable, report validation errors (backwards-compatible 400).
  if (validItems.length === 0 && errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const now = new Date();
  const runId = validItems.length > 0 ? (validItems[0].runId ?? null) : null;

  let inserted = 0;
  let updated = 0;
  let skipped = invalidCount;

  try {
    await db.transaction(async (tx) => {
      for (const item of validItems) {
        const normalized = item.sourceUrlNormalized
          ? item.sourceUrlNormalized
          : normalizeUrl(item.sourceUrl);
        const hash = sha256Hex(normalized);
        const itemRunId = item.runId ?? runId;
        await tx.execute(sql`SAVEPOINT item_sp`);
        try {
            const [upsertResult] = await tx
            .insert(festChances)
            .values({
              urlHash: hash,
              sourceUrl: item.sourceUrl.trim(),
              sourceUrlNormalized: normalized,
              title: item.title,
              organizer: item.organizer,
              location: item.location,
              region: item.region,
              eventDate: item.eventDate,
              monthsAhead: item.monthsAhead,
              jubileeYears: item.jubileeYears,
              festwirtStatus: item.festwirtStatus,
              eventType: item.eventType,
              contactName: item.contactName,
              contactEmail: item.contactEmail,
              contactPhone: item.contactPhone,
              emergency: item.emergency,
              score: item.score,
              scoreReason: item.scoreReason,
              nimModel: item.nimModel,
              runId: itemRunId,
              status: "new",
              notes: item.notes,
              discoveredAt: item.discoveredAt ? new Date(item.discoveredAt) : now,
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: festChances.urlHash,
              set: {
                score: item.score,
                scoreReason: item.scoreReason,
                festwirtStatus: item.festwirtStatus,
                eventType: item.eventType,
                eventDate: item.eventDate,
                monthsAhead: item.monthsAhead,
                jubileeYears: item.jubileeYears,
                contactName: item.contactName,
                contactEmail: item.contactEmail,
                contactPhone: item.contactPhone,
                emergency: item.emergency,
                nimModel: item.nimModel,
                runId: itemRunId,
                lastSeenAt: now,
                updatedAt: now,
                sourceUrl: item.sourceUrl.trim(),
                sourceUrlNormalized: normalized,
              },
            })
            .returning({ inserted: sql<boolean>`(xmax = 0)` });
          const wasInserted = upsertResult?.inserted === true;

          // Keep legacy fest_opportunities in sync for admin UI.
          await syncFestOpportunity(tx, item, normalized, hash, itemRunId, now);

          if (wasInserted) inserted++;
          else updated++;
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

  // Record run (best effort).
  if (runId) {
    try {
      await db
        .insert(festRuns)
        .values({
          runId,
          startedAt: now,
          foundCount: validItems.length,
          syncedCount: inserted + updated,
          error: null,
        })
        .onConflictDoUpdate({
          target: festRuns.runId,
          set: {
            foundCount: validItems.length,
            syncedCount: inserted + updated,
            error: null,
          },
        });
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    ok: true,
    received: body.length,
    inserted,
    updated,
    skipped,
    runId,
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