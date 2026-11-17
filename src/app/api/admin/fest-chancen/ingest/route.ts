import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { festChances, festOpportunities, festRuns } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 100;

const LEAD_TYPES = ["open", "watch", "signal"] as const;
const PLANNING_SIGNALS = ["none", "festausschuss", "termin", "presse"] as const;

const ItemSchema = z.object({
  sourceUrl: z.string().url(),
  sourceUrlNormalized: z.string().optional(),
  title: z.string().nullable().optional().default(null),
  organizer: z.string().nullable().optional().default(null),
  location: z.string().nullable().optional().default(null),
  region: z.string().nullable().optional().default(null),
  eventDate: z.string().nullable().optional().default(null),
  sourceDate: z.string().nullable().optional().default(null),
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
  // Neue optionale Felder (Task 1)
  leadType: z.enum(LEAD_TYPES).optional().default("open"),
  eventKey: z.string().nullable().optional().default(null),
  eventYear: z.number().int().nullable().optional().default(null),
  dateAssumed: z.boolean().optional().default(false),
  foundingYear: z.number().int().nullable().optional().default(null),
  incumbentFestwirt: z.string().nullable().optional().default(null),
  brauereiPartner: z.string().nullable().optional().default(null),
  contactRole: z.string().nullable().optional().default(null),
  planningSignal: z.enum(PLANNING_SIGNALS).optional().default("none"),
  recurring: z.boolean().optional().default(false),
  recheckAt: z.string().nullable().optional().default(null),
});

const LEAD_PRIORITY: Record<string, number> = { watch: 1, signal: 2, open: 3 };

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

const DAY_MS = 24 * 60 * 60 * 1000;
// Kulanz für mehrtägige Feste / ungenaue Datumsangaben (dateAssumed)
const STALE_EVENT_GRACE_MS = 31 * DAY_MS;
const MAX_SOURCE_AGE_MS = Math.round(24 * 30.44 * DAY_MS);

function parseDateOnly(raw: string | null): Date | null {
  if (!raw) return null;
  const d = raw.includes("T") ? new Date(raw) : new Date(raw + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

// Alte Quellen (z.B. Presseberichte von 2021) und vergangene Feste sind keine
// Bewerbungskandidaten; der Filter greift unabhängig von der n8n-Version.
function staleReason(item: z.infer<typeof ItemSchema>, now: Date): string | null {
  const eventDate = parseDateOnly(item.eventDate);
  if (eventDate && eventDate.getTime() < now.getTime() - STALE_EVENT_GRACE_MS) return "event_date_past";
  if (item.eventYear != null && item.eventYear < now.getUTCFullYear()) return "event_year_past";
  if (item.monthsAhead != null && item.monthsAhead < 0) return "months_ahead_negative";
  const sourceDate = parseDateOnly(item.sourceDate);
  if (sourceDate && sourceDate.getTime() < now.getTime() - MAX_SOURCE_AGE_MS) return "source_too_old";
  return null;
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
    // Archivierte Zeilen bleiben archiviert und werden nicht aktualisiert.
    if (existing[0].status === "ignore" || existing[0].status === "deleted") return;
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

interface NotifyCandidate {
  item: z.infer<typeof ItemSchema>;
  isNew: boolean;
  oldScore: number;
  oldEmergency: boolean;
}

async function notifyLead(candidate: NotifyCandidate) {
  const { item, isNew, oldScore, oldEmergency } = candidate;
  if (item.leadType !== "open") return;
  if (!(item.score >= 85 || item.emergency)) return;
  // Spam-Schutz: nur bei Insert, neuem emergency-Flag oder Score-Sprung >= 10
  if (!isNew) {
    const newEmergency = item.emergency && !oldEmergency;
    const scoreJump = item.score - oldScore >= 10;
    if (!newEmergency && !scoreJump) return;
  }

  const subject = `Neuer Fest-Lead: ${item.title || item.sourceUrl}`;
  const text = `Neuer Fest-Lead (Score ${item.score})\n\nTitel: ${item.title || "-"}\nRegion: ${item.region || "-"}\nURL: ${item.sourceUrl}\nEmergency: ${item.emergency}\n${item.scoreReason || ""}`;
  // E-Mail
  const recipient = process.env.FEST_CHANCEN_NOTIFY_EMAIL || process.env.CONTACT_EMAIL;
  if (recipient && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const { emailFrom } = await import("@/lib/email");
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: emailFrom(),
        to: [recipient],
        subject,
        text,
      });
    } catch { /* best effort */ }
  }
  // Telegram
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChat) {
    try {
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text: `${subject}\n${text}` }),
      });
    } catch { /* best effort */ }
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

  if (validItems.length === 0 && errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const now = new Date();
  const runId = validItems.length > 0 ? (validItems[0].runId ?? null) : null;

  let inserted = 0;
  let updated = 0;
  let stale = 0;
  let skipped = invalidCount;

  const notifyCandidates: NotifyCandidate[] = [];

  try {
    await db.transaction(async (tx) => {
      for (const item of validItems) {
        const normalized = item.sourceUrlNormalized
          ? item.sourceUrlNormalized
          : normalizeUrl(item.sourceUrl);
        const hash = sha256Hex(normalized);
        const itemRunId = item.runId ?? runId;

        if (staleReason(item, now)) {
          stale++;
          skipped++;
          continue;
        }

        await tx.execute(sql`SAVEPOINT item_sp`);
        try {
          // Matching: eventKey first, else sourceUrlNormalized
          let existing: (typeof festChances.$inferSelect)[] = [];
          if (item.eventKey) {
            existing = await tx
              .select()
              .from(festChances)
              .where(eq(festChances.eventKey, item.eventKey))
              .limit(1);
          }
          if (existing.length === 0) {
            existing = await tx
              .select()
              .from(festChances)
              .where(eq(festChances.sourceUrlNormalized, normalized))
              .limit(1);
          }

          // Gelöschte Chancen bleiben gelöscht: kein Update, kein Sync, keine Notify.
          if (existing.length > 0 && existing[0].status === "deleted") {
            skipped++;
            continue;
          }

          const recheckDate = item.recheckAt ? new Date(item.recheckAt + "T00:00:00Z") : null;

          if (existing.length > 0) {
            const old = existing[0];
            const oldScore = old.score ?? 0;
            const oldEmergency = !!old.emergency;
            const oldLeadType = old.leadType || "open";
            const newLeadType = item.leadType || "open";
            const newPriority = LEAD_PRIORITY[newLeadType] ?? 1;
            const oldPriority = LEAD_PRIORITY[oldLeadType] ?? 1;

            // leadType-Priorität: watch darf open nicht downgraden
            const canOverwriteTypeScore =
              newPriority >= oldPriority && item.score >= oldScore;

            // sourceUrls append
            const oldUrls: string[] = Array.isArray(old.sourceUrls) ? old.sourceUrls : [];
            const srcUrl = item.sourceUrl.trim();
            const newUrls = oldUrls.includes(srcUrl) ? oldUrls : [...oldUrls, srcUrl];

            const updateSet: Partial<typeof festChances.$inferInsert> = {
              sourceUrl: srcUrl,
              sourceUrlNormalized: normalized,
              urlHash: hash,
              lastSeenAt: now,
              updatedAt: now,
              sourceUrls: newUrls,
            };
            if (canOverwriteTypeScore) {
              updateSet.leadType = newLeadType;
              updateSet.score = item.score;
            }
            // Update other metadata fields (contact, etc.) always (non-null preferred)
            if (item.title != null) updateSet.title = item.title;
            if (item.organizer != null) updateSet.organizer = item.organizer;
            if (item.location != null) updateSet.location = item.location;
            if (item.region != null) updateSet.region = item.region;
            if (item.eventDate != null) updateSet.eventDate = item.eventDate;
            if (item.monthsAhead != null) updateSet.monthsAhead = item.monthsAhead;
            if (item.jubileeYears != null) updateSet.jubileeYears = item.jubileeYears;
            if (item.festwirtStatus) updateSet.festwirtStatus = item.festwirtStatus;
            if (item.eventType) updateSet.eventType = item.eventType;
            if (item.contactName != null) updateSet.contactName = item.contactName;
            if (item.contactEmail != null) updateSet.contactEmail = item.contactEmail;
            if (item.contactPhone != null) updateSet.contactPhone = item.contactPhone;
            if (item.contactRole != null) updateSet.contactRole = item.contactRole;
            if (item.incumbentFestwirt != null) updateSet.incumbentFestwirt = item.incumbentFestwirt;
            if (item.brauereiPartner != null) updateSet.brauereiPartner = item.brauereiPartner;
            if (item.scoreReason != null) updateSet.scoreReason = item.scoreReason;
            if (item.nimModel != null) updateSet.nimModel = item.nimModel;
            if (item.runId != null) updateSet.runId = item.runId;
            if (item.notes != null) updateSet.notes = item.notes;
            if (item.eventKey != null) updateSet.eventKey = item.eventKey;
            if (item.eventYear != null) updateSet.eventYear = item.eventYear;
            if (item.dateAssumed !== undefined) updateSet.dateAssumed = item.dateAssumed;
            if (item.foundingYear != null) updateSet.foundingYear = item.foundingYear;
            if (item.planningSignal) updateSet.planningSignal = item.planningSignal;
            if (item.recurring !== undefined) updateSet.recurring = item.recurring;
            if (recheckDate) updateSet.recheckAt = recheckDate;
            if (item.emergency !== undefined) updateSet.emergency = item.emergency;

            await tx
              .update(festChances)
              .set(updateSet)
              .where(eq(festChances.id, old.id));

            // sync legacy
            await syncFestOpportunity(tx, item, normalized, hash, itemRunId, now);

            updated++;
            notifyCandidates.push({ item, isNew: false, oldScore, oldEmergency });
          } else {
            // Insert
            await tx.insert(festChances).values({
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
              status: item.status || "new",
              notes: item.notes,
              discoveredAt: item.discoveredAt ? new Date(item.discoveredAt) : now,
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now,
              leadType: item.leadType || "open",
              eventKey: item.eventKey,
              eventYear: item.eventYear,
              dateAssumed: item.dateAssumed,
              foundingYear: item.foundingYear,
              incumbentFestwirt: item.incumbentFestwirt,
              brauereiPartner: item.brauereiPartner,
              contactRole: item.contactRole,
              planningSignal: item.planningSignal || "none",
              recurring: item.recurring,
              recheckAt: recheckDate,
              sourceUrls: [item.sourceUrl.trim()],
              wirtStatus: "neu",
            });

            await syncFestOpportunity(tx, item, normalized, hash, itemRunId, now);

            inserted++;
            notifyCandidates.push({ item, isNew: true, oldScore: 0, oldEmergency: false });
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

  // Record run
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
    } catch { /* ignore */ }
  }

  // Notifications (best effort, after commit)
  for (const c of notifyCandidates) {
    // Only notify on insert or new emergency/score jump
    if (!c.isNew) {
      const newEmergency = c.item.emergency && !c.oldEmergency;
      const scoreJump = c.item.score - c.oldScore >= 10;
      if (!newEmergency && !scoreJump) continue;
    }
    // fire and forget
    notifyLead(c).catch(() => {});
  }

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