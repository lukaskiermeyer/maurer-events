import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { vereinsRadar } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { boundedJson, bodyError } from "@/lib/request-body";

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
  nextVisitEvent: z.string().nullable().optional().default(null),
  nextVisitDate: z.string().nullable().optional().default(null),
  nextVisitUrl: z.string().nullable().optional().default(null),
  tentHistory: z.string().nullable().optional().default(null),
  verificationSummary: z.string().nullable().optional().default(null),
  verifiedAt: z.string().datetime().nullable().optional().default(null),
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

function parseDateOnly(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const iso = de ? `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}` : s;
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeFutureIsoDate(raw: string | null | undefined, now: Date): string | null {
  const d = parseDateOnly(raw);
  if (!d) return null;
  const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (d.getTime() < todayStartUtc) return null;
  return d.toISOString().slice(0, 10);
}

function monthsAheadFromEventYear(year: number | null | undefined, now = new Date()): number | null {
  if (!year) return null;
  const eventDate = new Date(Date.UTC(year, 5, 1)); // 1. Juni
  const diffMs = eventDate.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
}

function deriveRadarPhaseAndStatus(months: number | null): { phase: string; status: (typeof STATUS_VALUES)[number] } | null {
  if (months === null) return null;
  if (months >= 18 && months <= 42) return { phase: "connecten", status: "connecten" };
  if (months < 18) return { phase: months < 6 ? "reaktiv" : "angebot", status: "jetzt_anbieten" };
  return { phase: "beobachten", status: "beobachten" };
}

function methodNotAllowed() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const expected = expectedTokens();
  if (expected.length === 0) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 500 });
  }
  const provided = getToken(request);
  if (!provided || !isAuthorized(provided, expected)) {
    return unauthorized();
  }

  const body = await boundedJson<unknown>(request, 2 * 1024 * 1024).catch(bodyError);
  if (body instanceof NextResponse) return body;

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
  let stale = 0;
  let skipped = invalidCount;

  try {
    await db.transaction(async (tx) => {
      for (const item of validItems) {
        // Dynamischer Datums-Check gegen `now`: vergangene Jubiläumsjahre sofort abweisen
        const computedMonths = monthsAheadFromEventYear(item.eventYear, now);
        if (
          (item.eventYear != null && item.eventYear < now.getUTCFullYear()) ||
          (computedMonths !== null && computedMonths < 0) ||
          (item.monthsAhead != null && item.monthsAhead < 0)
        ) {
          stale++;
          skipped++;
          continue;
        }

        const futureVisitDate = normalizeFutureIsoDate(item.nextVisitDate, now);
        const verifiedAtDate = item.verifiedAt ? new Date(item.verifiedAt) : null;

        await tx.execute(sql`SAVEPOINT item_sp`);
        try {
          const existing = await tx
            .select()
            .from(vereinsRadar)
            .where(eq(vereinsRadar.leadKey, item.leadKey))
            .limit(1);

          // Gelöschte Leads bleiben gelöscht: kein Update, keine Wiederanlage.
          if (existing.length > 0 && existing[0].status === "deleted") {
            skipped++;
            continue;
          }

          // contentHash identical AND no new planningSignals AND no new enrichment -> skipped
          const newSignals = item.planningSignals || [];
          const oldSignals: string[] = Array.isArray(existing[0]?.planningSignals) ? existing[0].planningSignals : [];
          const mergedSignals = Array.from(new Set([...oldSignals, ...newSignals]));
          const hasNewSignals = newSignals.some((s) => !oldSignals.includes(s));
          const hasNewEnrichment = Boolean(
            (verifiedAtDate && !existing[0]?.verifiedAt) ||
            (item.nextVisitEvent && item.nextVisitEvent !== existing[0]?.nextVisitEvent) ||
            (futureVisitDate && futureVisitDate !== existing[0]?.nextVisitDate),
          );

          if (existing.length > 0) {
            const old = existing[0];
            if (item.contentHash && old.contentHash === item.contentHash && !hasNewSignals && !hasNewEnrichment) {
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
            if (item.nextVisitEvent != null) updateSet.nextVisitEvent = item.nextVisitEvent;
            if (futureVisitDate != null) updateSet.nextVisitDate = futureVisitDate;
            if (item.nextVisitUrl != null) updateSet.nextVisitUrl = item.nextVisitUrl;
            if (item.tentHistory != null) updateSet.tentHistory = item.tentHistory;
            if (item.verificationSummary != null) updateSet.verificationSummary = item.verificationSummary;
            if (verifiedAtDate) updateSet.verifiedAt = verifiedAtDate;
            // monthsAhead & Phase dynamisch aus eventYear gegen `now` neu berechnen
            const ey = item.eventYear ?? old.eventYear;
            const ma = monthsAheadFromEventYear(ey, now);
            if (ma !== null) {
              updateSet.monthsAhead = ma;
              const derived = deriveRadarPhaseAndStatus(ma);
              if (derived) {
                updateSet.phase = item.phase ?? derived.phase;
                updateSet.status = item.status ?? derived.status;
              }
            }
            if (item.discoveredAt) updateSet.discoveredAt = new Date(item.discoveredAt);

            await tx.update(vereinsRadar).set(updateSet).where(eq(vereinsRadar.id, old.id));
            updated++;
          } else {
            const ey = item.eventYear;
            const ma = monthsAheadFromEventYear(ey, now) ?? item.monthsAhead;
            const derived = deriveRadarPhaseAndStatus(ma);
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
              phase: item.phase ?? derived?.phase ?? null,
              status: item.status || derived?.status || "beobachten",
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
              nextVisitEvent: item.nextVisitEvent,
              nextVisitDate: futureVisitDate,
              nextVisitUrl: item.nextVisitUrl,
              tentHistory: item.tentHistory,
              verificationSummary: item.verificationSummary,
              verifiedAt: verifiedAtDate,
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
    stale,
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